'use strict';

const assert = require('assert');
const AWS = require('aws-sdk');

const AwsDriverError = require('./aws-driver-error');
const Driver = require('./driver');

class DynamoDBDocumentClientDriver extends Driver {
  constructor(options) {
    const clientOpts = {
      apiVersion: '2012-08-10',
    };
    super(AWS.DynamoDB.DocumentClient, clientOpts, options);
  }

  async batchGet(context, params) {
    const results = {};
    let callParams = Object.assign({}, params);
    let attempts = 0;

    /* eslint-disable no-await-in-loop */
    while (attempts < (this._conf.attempts || 3)) {
      attempts += 1;

      const { Responses, UnprocessedKeys } = await this._call(context, callParams, 'batchGet');

      Object.entries(Responses).forEach(([tableName, responses]) => {
        results[tableName] = (results[tableName] || []).concat(responses);
      });

      if (Object.keys(UnprocessedKeys).length > 0) {
        callParams = Object.assign({}, callParams, {
          RequestItems: UnprocessedKeys,
        });
      } else {
        return { Responses: results };
      }
    }
    /* eslint-enable no-await-in-loop */

    throw new AwsDriverError({
      message: 'unable to fetch all requested items after too many retries',
    });
  }

  delete(context, params) {
    return this._call(context, params, 'delete');
  }

  get(context, params) {
    return this._call(context, params, 'get');
  }

  put(context, params) {
    return this._call(context, params, 'put');
  }

  query(context, params) {
    return this._call(context, params, 'query');
  }

  scan(context, params) {
    return this._call(context, params, 'scan');
  }

  update(context, params) {
    return this._call(context, params, 'update');
  }

  _call(context, params, method) {
    assert(params, 'missing params');
    assert(method, 'missing method');

    this._logger.log(context, { params }, `making DynamoDB ${method} call`);
    return this._client[method](params)
      .promise()
      .catch(error => {
        const message = `failed to make DynamoDB ${method} call`;
        this._logger.log(context, { params, error }, message);
        throw new AwsDriverError({
          message,
          details: { params },
          cause: error,
        });
      });
  }
}

module.exports = DynamoDBDocumentClientDriver;
