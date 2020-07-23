'use strict';

const assert = require('assert');
const AWS = require('aws-sdk');
const chunk = require('lodash.chunk');
const throat = require('throat');

const { ajv, validate } = require('./ajv');
const AwsDriverError = require('./aws-driver-error');
const Driver = require('./driver');

const BATCH_SIZE = 10;
const DATA_TYPE_REGEX = new RegExp('^(String)((\\.)(\\w+))?$');
const RETRY_COUNT = 2;

const MESSAGE_ATTRIBUTE_SCHEMA = {
  type: 'object',
  required: [
    'dataType',
    'stringValue',
  ],
  properties: {
    dataType: {
      type: 'string',
      pattern: DATA_TYPE_REGEX.source,
    },
    stringValue: { type: 'string' },
  },
  additionalProperties: true,
};

const SQS_MESSAGE_SCHEMA = {
  type: 'object',
  title: 'SQS Message',
  required: [
    'body',
    'messageAttributes',
    'messageId',
  ],
  properties: {
    body: { type: 'string' },
    messageAttributes: {
      type: 'object',
      patternProperties: {
        '.': MESSAGE_ATTRIBUTE_SCHEMA,
      },
      additionalProperties: false,
    },
    messageId: { type: 'string' },
    dedupId: { type: 'string' },
    groupId: { type: 'string' },
  },
  additionalProperties: true,
};

const SQS_EVENT_SCHEMA = {
  type: 'object',
  title: 'SQS Event',
  required: [
    'Records',
  ],
  properties: {
    Records: {
      type: 'array',
      items: SQS_MESSAGE_SCHEMA,
    },
  },
  additionalProperties: true,
};

const SQS_INPUT_SCHEMA = ajv.compile({
  title: 'input',
  oneOf: [
    SQS_MESSAGE_SCHEMA,
    {
      type: 'array',
      title: 'input',
      items: SQS_MESSAGE_SCHEMA,
    },
    SQS_EVENT_SCHEMA,
  ],
});

class SQSDriver extends Driver {
  constructor(options) {
    const clientOpts = {
      apiVersion: '2012-11-05',
    };
    super(AWS.SQS, clientOpts, options);
  }

  parse(context, input) {
    assert(context, 'missing context');
    assert(input, 'missing input');

    validate(SQS_INPUT_SCHEMA, input);

    const messages = input.Records || [].concat(input);
    return messages.reduce((acc, message) => {
      const body = JSON.parse(message.body);
      const messageAttributes = Object.keys(message.messageAttributes).reduce((attrAcc, key) => {
        const value = message.messageAttributes[key];
        const { dataType, stringValue } = value;

        const type = dataType.match(DATA_TYPE_REGEX)[4];
        switch (type) {
          case 'boolean':
            attrAcc[key] = stringValue === 'true'; // eslint-disable-line no-param-reassign
            break;
          case 'string':
          case undefined:
            attrAcc[key] = stringValue; // eslint-disable-line no-param-reassign
            break;
          default:
            this._logger.log(context, { value, key, type }, 'unknown message attribute data type');
            attrAcc[key] = stringValue; // eslint-disable-line no-param-reassign
        }

        return attrAcc;
      }, {});

      (body.Records || [body]).forEach(record => {
        acc.push(Object.assign({}, message, { body: record, messageAttributes }));
      });
      return acc;
    }, []);
  }

  send(context, queueUrl, items, retryCount) {
    const messages = [].concat(items);
    return this._sendBatch(context, queueUrl, messages, retryCount);
  }

  sendToDLQ(context, dlqUrl, items, retryCount) {
    const messages = [].concat(items).map(item => this._formatForDLQ(context, item));
    return this._sendBatch(context, dlqUrl, messages, retryCount);
  }

  _formatForDLQ(context, { event, error } = {}) {
    assert(context, 'missing context');
    assert(event, 'missing event');
    assert(error, 'missing error');

    const messageAttributes = Object.assign({}, event.messageAttributes);
    if (error.message) { messageAttributes['err.message'] = error.message; }
    if (error.stack) { messageAttributes['err.stack'] = error.stack; }
    if (context.awsRequestId) { messageAttributes['context.awsRequestId'] = context.awsRequestId; }
    if (event.messageId) { messageAttributes['origin.messageId'] = event.messageId; }

    return {
      body: event.body || event,
      messageAttributes,
    };
  }

  _sendBatch(context, queueUrl, messages, retryCount = RETRY_COUNT) {
    assert(context, 'missing context');
    assert(queueUrl, 'missing queueUrl');
    assert(messages, 'missing messages');

    const chunks = chunk(messages, BATCH_SIZE);
    const concurrency = this._conf.maxConcurrency || Number.MAX_SAFE_INTEGER;
    return Promise.all(chunks.map(throat(concurrency, batch => {
      const params = {
        QueueUrl: queueUrl,
        Entries: batch.map(({ body, delaySeconds, messageAttributes, dedupId, groupId }, index) => {
          const entry = {
            Id: index.toString(),
            MessageBody: JSON.stringify(body),
          };

          if (delaySeconds) {
            entry.DelaySeconds = delaySeconds;
          }

          if (messageAttributes) {
            entry.MessageAttributes = Object.keys(messageAttributes).reduce((acc, key) => {
              const value = messageAttributes[key];
              return Object.assign(acc, {
                [key]: {
                  DataType: `String.${typeof value}`,
                  StringValue: value.toString(),
                },
              });
            }, {});
          }

          if (dedupId) {
            entry.MessageDeduplicationId = dedupId;
          }

          if (groupId) {
            entry.MessageGroupId = groupId;
          }

          return entry;
        }),
      };

      this._logger.log(context, { params }, 'sending SQS messages');
      return this._client.sendMessageBatch(params)
        .promise()
        .then(data => {
          const successful = data.Successful || [];

          if (data.Failed && data.Failed.length) {
            if (!retryCount) {
              throw new AwsDriverError({
                message: 'failed to send messages to SQS queue due to retry limit reached',
                details: {
                  failed: data.Failed,
                  params,
                },
              });
            }

            const failedMessages = data.Failed.map(failed => {
              if (failed.SenderFault) {
                throw new AwsDriverError({
                  message: 'failed to send messages to SQS queue due to sender fault',
                  details: {
                    failed,
                    params,
                  },
                });
              }
              return batch[failed.Id];
            });

            return this._sendBatch(context, queueUrl, failedMessages, retryCount - 1)
              .then(result => successful.concat(result[0]));
          }

          return successful;
        })
        .catch(err => {
          if (err instanceof AwsDriverError) {
            throw err;
          }

          this._logger.log(context, { params }, 'failed to send messages to SQS queue');
          throw new AwsDriverError({
            message: 'failed to send messages to SQS queue',
            cause: err,
            details: { params },
          });
        });
    })));
  }
}

module.exports = SQSDriver;
