'use strict';

const { expect } = require('chai');
const sinon = require('sinon');
const uuid = require('uuid');

const AwsDriverError = require('../lib/aws-driver-error');
const { SQS: SQSDriver } = require('../');
const setupTestHarness = require('./setup-test-harness');

describe('SQSDriver', function() {
  setupTestHarness();

  beforeEach(function() {
    this.driver = new SQSDriver();
    this.client = this.sandbox.stub(this.driver._client);
  });

  describe('parse', function() {
    it('should throw when input lacks required parameters', function() {
      const event = {};

      expect(() => this.driver.parse(this.testContext, event))
        .to.throw(
          '[SQS Event]: should have required property \'Records\', ' +
          '[SQS Message]: should have required property \'body\', ' +
          '[SQS Message]: should have required property \'messageAttributes\', ' +
          '[SQS Message]: should have required property \'messageId\', ' +
          '[input]: should be array, ' +
          '[input]: should match exactly one schema in oneOf'
        );
    });

    it('should be rejected when message lacks required parameters', function() {
      const event = {
        Records: [{}],
      };

      expect(() => this.driver.parse(this.testContext, event))
        .to.throw(
          '[$.Records[0]]: should have required property \'body\', ' +
          '[$.Records[0]]: should have required property \'messageAttributes\', ' +
          '[$.Records[0]]: should have required property \'messageId\', ' +
          '[SQS Message]: should have required property \'body\', ' +
          '[SQS Message]: should have required property \'messageAttributes\', ' +
          '[SQS Message]: should have required property \'messageId\', ' +
          '[input]: should be array, ' +
          '[input]: should match exactly one schema in oneOf'
        );
    });

    it('should not be rejected when input has additional parameters', function() {
      const event = {
        Records: [{
          body: JSON.stringify({}),
          messageId: uuid.v4(),
          messageAttributes: {
            attr: {
              dataType: 'String',
              stringValue: 'test value',
              additional: true,
            },
          },
          additional: true,
        }],
        additional: true,
      };

      expect(() => this.driver.parse(this.testContext, event))
        .to.not.throw();
    });

    it('should support single-message input', function() {
      const body = { data: uuid.v4() };
      const message = {
        body: JSON.stringify(body),
        messageId: uuid.v4(),
        messageAttributes: {},
      };

      expect(this.driver.parse(this.testContext, message))
        .to.deep.equal([{
          body,
          messageId: message.messageId,
          messageAttributes: message.messageAttributes,
        }]);
    });

    it('should support multi-message input', function() {
      const bodies = [
        { data: uuid.v4() },
        { data: uuid.v4() },
      ];
      const messages = bodies.map(b => ({
        body: JSON.stringify(b),
        messageId: uuid.v4(),
        messageAttributes: {},
      }));

      expect(this.driver.parse(this.testContext, messages))
        .to.deep.equal([
          {
            body: bodies[0],
            messageId: messages[0].messageId,
            messageAttributes: messages[0].messageAttributes,
          },
          {
            body: bodies[1],
            messageId: messages[1].messageId,
            messageAttributes: messages[1].messageAttributes,
          },
        ]);
    });

    it('should support SQS event as an input', function() {
      const body = { data: uuid.v4() };
      const message = {
        body: JSON.stringify(body),
        messageId: uuid.v4(),
        messageAttributes: {},
      };
      const event = {
        Records: [message],
      };

      expect(this.driver.parse(this.testContext, event))
        .to.deep.equal([{
          body,
          messageId: message.messageId,
          messageAttributes: message.messageAttributes,
        }]);
    });

    it('should support nested messages', function() {
      const nested = {
        foo: 'baz',
      };
      const message = {
        body: {
          Records: [nested],
        },
        messageId: uuid.v4(),
        messageAttributes: {},
      };
      const event = {
        Records: [Object.assign({}, message, { body: JSON.stringify(message.body) })],
      };

      expect(this.driver.parse(this.testContext, event))
        .to.deep.equal([{
          body: nested,
          messageId: message.messageId,
          messageAttributes: message.messageAttributes,
        }]);
    });

    it('should parse message attributes', function() {
      const message = {
        body: JSON.stringify({ data: uuid.v4() }),
        messageId: uuid.v4(),
        messageAttributes: {
          boolAttribute: {
            dataType: 'String.boolean',
            stringValue: 'false',
          },
          explicitStringAttribute: {
            dataType: 'String.string',
            stringValue: 'explicit string',
          },
          stringAttribute: {
            dataType: 'String.string',
            stringValue: 'regular string',
          },
          unknownAttribute: {
            dataType: 'String.object',
            stringValue: 'unknown attribute',
          },
        },
      };

      expect(this.driver.parse(this.testContext, message))
        .to.deep.equal([{
          body: JSON.parse(message.body),
          messageId: message.messageId,
          messageAttributes: {
            boolAttribute: false,
            explicitStringAttribute: 'explicit string',
            stringAttribute: 'regular string',
            unknownAttribute: 'unknown attribute',
          },
        }]);
    });
  });

  describe('#send', function() {
    it('should send message properly', async function() {
      const queueUrl = 'https://test-queue.com';
      const message = {
        body: { data: uuid.v4() },
      };

      this.client.sendMessageBatch.returns(this.awsPromise({ Successful: [] }));

      await expect(
        this.driver.send(this.testContext, queueUrl, message)
      ).to.eventually.be.fulfilled;

      sinon.assert.calledWithExactly(
        this.client.sendMessageBatch,
        {
          QueueUrl: queueUrl,
          Entries: [{
            Id: '0',
            MessageBody: JSON.stringify(message.body),
          }],
        }
      );
    });

    it('should wrap SQS error into AwsDriverError', async function() {
      const queueUrl = 'https://test-queue.com';
      const message = {
        body: { data: uuid.v4() },
      };
      const error = new Error('SQS error');

      this.client.sendMessageBatch.returns(this.awsPromise(() => Promise.reject(error)));

      const actual = await expect(
        this.driver.send(this.testContext, queueUrl, message)
      ).to.be.rejectedWith(AwsDriverError);

      expect(actual).to.have.property('message', 'failed to send messages to SQS queue');
      expect(actual)
        .to.have.property('cause')
        .that.is.deep.equal(error);
    });
  });

  describe('#sendToDLQ', function() {
    it('should send message properly', async function() {
      const queueUrl = 'https://test-queue.com';
      const error = new Error('horrible error');
      const event = {
        body: {
          data: uuid.v4(),
        },
        messageAttributes: {
          ImportantAttribute: '42',
        },
      };

      this.client.sendMessageBatch.returns(this.awsPromise({ Successful: [] }));

      await expect(
        this.driver.sendToDLQ(this.testContext, queueUrl, { event, error })
      ).to.eventually.be.fulfilled;

      sinon.assert.calledWithExactly(
        this.client.sendMessageBatch,
        {
          QueueUrl: queueUrl,
          Entries: [{
            Id: '0',
            MessageBody: JSON.stringify(event.body),
            MessageAttributes: {
              'err.message': {
                DataType: 'String.string',
                StringValue: error.message,
              },
              'err.stack': {
                DataType: 'String.string',
                StringValue: error.stack,
              },
              'context.awsRequestId': {
                DataType: 'String.string',
                StringValue: this.testContext.awsRequestId,
              },
              ImportantAttribute: {
                DataType: 'String.string',
                StringValue: '42',
              },
            },
          }],
        }
      );
    });

    it('should wrap SQS error into AwsDriverError', async function() {
      const queueUrl = 'https://test-queue.com';
      const event = {
        body: {
          data: uuid.v4(),
        },
      };
      const error = new Error('SQS error');

      this.client.sendMessageBatch.returns(this.awsPromise(() => Promise.reject(error)));

      const actual = await expect(
        this.driver.sendToDLQ(this.testContext, queueUrl, { event, error: new Error() })
      ).to.be.rejectedWith(AwsDriverError);

      expect(actual).to.have.property('message', 'failed to send messages to SQS queue');
      expect(actual)
        .to.have.property('cause')
        .that.is.deep.equal(error);
    });
  });

  describe('#_formatForDLQ', function() {
    it('should add expected message attributes', function() {
      const event = {
        body: 'foo',
        messageId: uuid.v4(),
      };
      const error = {
        message: 'the worst error',
        stack: 'stack-stack',
      };

      const formatted = this.driver._formatForDLQ(this.testContext, { event, error });

      expect(formatted).to.deep.equal({
        body: event.body,
        messageAttributes: {
          'err.message': error.message,
          'err.stack': error.stack,
          'context.awsRequestId': this.testContext.awsRequestId,
          'origin.messageId': event.messageId,
        },
      });
    });

    it('should use event as body when event does not have body', function() {
      const event = {
        data: 'foo',
      };
      const error = {};

      const formatted = this.driver._formatForDLQ(this.testContext, { event, error });

      expect(formatted)
        .to.have.property('body')
        .that.is.deep.equal(event);
    });

    it('should preserve existing message attributes', function() {
      const event = {
        body: 'foo',
        messageAttributes: {
          foo: 'bar',
        },
      };
      const error = {};

      const formatted = this.driver._formatForDLQ(this.testContext, { event, error });

      expect(formatted)
        .to.have.nested.property('messageAttributes.foo', 'bar');
    });

    it('should handle missing data for message attributes', function() {
      const event = {
        body: 'foo',
      };
      const error = {};

      const formatted = this.driver._formatForDLQ({}, { event, error });

      expect(formatted)
        .to.have.property('messageAttributes')
        .that.is.deep.equal({});
    });
  });

  describe('#_sendBatch', function() {
    it('should do nothing if messages array is empty', async function() {
      const queueUrl = 'https://test-queue.com';
      const messages = [];

      this.client.sendMessageBatch.returns(this.awsPromise({ Successful: [] }));

      await expect(
        this.driver._sendBatch(this.testContext, queueUrl, messages)
      ).to.be.fulfilled;

      sinon.assert.notCalled(this.client.sendMessageBatch);
    });

    it('should send messages properly', async function() {
      const queueUrl = 'https://test-queue.com';
      const messages = [
        { body: { data: uuid.v4() } },
        { body: { data: uuid.v4() } },
      ];
      const testResponse = {
        Successful: [
          { Id: '0', MessageId: uuid.v4() },
          { Id: '1', MessageId: uuid.v4() },
        ],
        Failed: [],
      };

      this.client.sendMessageBatch.returns(this.awsPromise(testResponse));

      await expect(
        this.driver._sendBatch(this.testContext, queueUrl, messages)
      ).to.eventually.deep.equal([testResponse.Successful]);

      sinon.assert.calledWithExactly(
        this.client.sendMessageBatch,
        {
          QueueUrl: queueUrl,
          Entries: [
            { Id: '0', MessageBody: JSON.stringify(messages[0].body) },
            { Id: '1', MessageBody: JSON.stringify(messages[1].body) },
          ],
        }
      );
    });

    it('should batch messages', async function() {
      const queueUrl = 'https://test-queue.com';
      const messages = [
        { body: { data: uuid.v4() } },
        { body: { data: uuid.v4() } },
        { body: { data: uuid.v4() } },
        { body: { data: uuid.v4() } },
        { body: { data: uuid.v4() } },
        { body: { data: uuid.v4() } },
        { body: { data: uuid.v4() } },
        { body: { data: uuid.v4() } },
        { body: { data: uuid.v4() } },
        { body: { data: uuid.v4() } },
        { body: { data: uuid.v4() } },
      ];
      this.client.sendMessageBatch.returns(this.awsPromise({}));

      await expect(
        this.driver._sendBatch(this.testContext, queueUrl, messages)
      ).to.eventually.be.fulfilled;

      sinon.assert.calledWithExactly(
        this.client.sendMessageBatch,
        {
          QueueUrl: queueUrl,
          Entries: [
            { Id: '0', MessageBody: JSON.stringify(messages[0].body) },
            { Id: '1', MessageBody: JSON.stringify(messages[1].body) },
            { Id: '2', MessageBody: JSON.stringify(messages[2].body) },
            { Id: '3', MessageBody: JSON.stringify(messages[3].body) },
            { Id: '4', MessageBody: JSON.stringify(messages[4].body) },
            { Id: '5', MessageBody: JSON.stringify(messages[5].body) },
            { Id: '6', MessageBody: JSON.stringify(messages[6].body) },
            { Id: '7', MessageBody: JSON.stringify(messages[7].body) },
            { Id: '8', MessageBody: JSON.stringify(messages[8].body) },
            { Id: '9', MessageBody: JSON.stringify(messages[9].body) },
          ],
        }
      );
      sinon.assert.calledWithExactly(
        this.client.sendMessageBatch,
        {
          QueueUrl: queueUrl,
          Entries: [
            { Id: '0', MessageBody: JSON.stringify(messages[10].body) },
          ],
        }
      );
    });

    it('should retry failed messages', async function() {
      const queueUrl = 'https://test-queue.com';
      const messages = [
        { body: { data: uuid.v4() } },
        { body: { data: uuid.v4() } },
      ];
      const testResponse1 = {
        Successful: [
          { Id: '0', MessageId: uuid.v4() },
        ],
        Failed: [
          { Id: '1' },
        ],
      };
      const testResponse2 = {
        Successful: [
          { Id: '0', MessageId: uuid.v4() },
        ],
        Failed: [],
      };

      this.client.sendMessageBatch
        .onFirstCall().returns(this.awsPromise(testResponse1))
        .onSecondCall().returns(this.awsPromise(testResponse2));

      await expect(
        this.driver._sendBatch(this.testContext, queueUrl, messages)
      ).to.eventually.deep.equal([testResponse1.Successful.concat(testResponse2.Successful)]);

      sinon.assert.calledTwice(this.client.sendMessageBatch);
      sinon.assert.calledWithExactly(
        this.client.sendMessageBatch,
        {
          QueueUrl: queueUrl,
          Entries: [
            { Id: '0', MessageBody: JSON.stringify(messages[0].body) },
            { Id: '1', MessageBody: JSON.stringify(messages[1].body) },
          ],
        }
      );
      sinon.assert.calledWithExactly(
        this.client.sendMessageBatch,
        {
          QueueUrl: queueUrl,
          Entries: [
            { Id: '0', MessageBody: JSON.stringify(messages[1].body) },
          ],
        }
      );
    });

    it('should reject when retry limit is reached', async function() {
      const queueUrl = 'https://test-queue.com';
      const messages = [{
        body: { data: uuid.v4() },
      }];
      const testResponse = {
        Successful: [],
        Failed: [{ Id: '0' }],
      };

      this.client.sendMessageBatch.returns(this.awsPromise(testResponse));

      await expect(
        this.driver._sendBatch(this.testContext, queueUrl, messages)
      ).to.be.rejectedWith(AwsDriverError, 'failed to send messages to SQS queue due to retry limit reached');

      sinon.assert.calledThrice(this.client.sendMessageBatch);
    });

    it('should reject when message was not sent due to sender fault', async function() {
      const queueUrl = 'https://test-queue.com';
      const messages = [{
        body: { data: uuid.v4() },
      }];
      const testResponse = {
        Successful: [],
        Failed: [{ Id: '0', SenderFault: true }],
      };

      this.client.sendMessageBatch.returns(this.awsPromise(testResponse));

      await expect(
        this.driver._sendBatch(this.testContext, queueUrl, messages)
      ).to.be.rejectedWith(AwsDriverError, 'failed to send messages to SQS queue due to sender fault');

      sinon.assert.calledOnce(this.client.sendMessageBatch);
    });

    it('should support delaying messages', async function() {
      const queueUrl = 'test-queue';
      const message = {
        body: { data: uuid.v4() },
        delaySeconds: 100,
      };

      this.client.sendMessageBatch.returns(this.awsPromise({ Successful: [] }));

      await expect(
        this.driver._sendBatch(this.testContext, queueUrl, [message])
      ).to.eventually.be.fulfilled;

      sinon.assert.calledWithExactly(
        this.client.sendMessageBatch,
        {
          QueueUrl: queueUrl,
          Entries: [{
            Id: '0',
            DelaySeconds: 100,
            MessageBody: JSON.stringify(message.body),
          }],
        }
      );
    });

    it('should format message attributes', async function() {
      const queueUrl = 'test-queue';
      const message = {
        body: { data: uuid.v4() },
        messageAttributes: {
          boolAttribute: false,
          stringAttribute: 'random string',
        },
        dedupId: uuid.v4(),
        groupId: uuid.v4(),
      };

      this.client.sendMessageBatch.returns(this.awsPromise({ Successful: [] }));

      await expect(
        this.driver._sendBatch(this.testContext, queueUrl, [message])
      ).to.eventually.be.fulfilled;

      sinon.assert.calledWithExactly(
        this.client.sendMessageBatch,
        {
          QueueUrl: queueUrl,
          Entries: [{
            Id: '0',
            MessageBody: JSON.stringify(message.body),
            MessageAttributes: {
              boolAttribute: {
                DataType: 'String.boolean',
                StringValue: 'false',
              },
              stringAttribute: {
                DataType: 'String.string',
                StringValue: 'random string',
              },
            },
            MessageDeduplicationId: message.dedupId,
            MessageGroupId: message.groupId,
          }],
        }
      );
    });

    it('should wrap SQS error into AwsDriverError', async function() {
      const queueUrl = 'https://test-queue.com';
      const messages = [{
        body: { data: uuid.v4() },
      }];
      const error = new Error('SQS error');

      this.client.sendMessageBatch.returns(this.awsPromise(() => Promise.reject(error)));

      const actual = await expect(
        this.driver._sendBatch(this.testContext, queueUrl, messages)
      ).to.be.rejectedWith(AwsDriverError);

      expect(actual).to.have.property('message', 'failed to send messages to SQS queue');
      expect(actual)
        .to.have.property('cause')
        .that.is.deep.equal(error);
    });
  });
});
