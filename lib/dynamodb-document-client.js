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

  calculateTTL(retentionTimeMs) {
    return this.msToTTL(Date.now() + retentionTimeMs);
  }

  delete(context, params) {
    return this._call(context, params, 'delete');
  }

  get(context, params) {
    return this._call(context, params, 'get');
  }

  msToTTL(ms) {
    return Math.floor(ms / 1000);
  }

  put(context, params) {
    return this._call(context, params, 'put');
  }

  query(context, params) {
    return this._call(context, params, 'query');
  }

  async queryAll(context, baseParams, callback) {
    assert(!callback || typeof callback === 'function', 'scan callback must be a function when provided');

    const items = [];

    const params = {
      ...baseParams,
      ExclusiveStartKey: null,
    };

    do {
      const results = await this.query(context, params);
      if (results.Count > 0) {
        if (callback) {
          await callback(results.Items);
        } else {
          items.push(...results.Items);
        }
      }
      params.ExclusiveStartKey = results.LastEvaluatedKey;
    } while (params.ExclusiveStartKey);

    if (!callback) {
      return items;
    }
  }

  scan(context, params) {
    return this._call(context, params, 'scan');
  }

  async scanAll(context, baseParams, { concurrency = 1, callback } = {}) {
    assert(!callback || typeof callback === 'function', 'scan callback must be a function when provided');
    assert(concurrency > 0, 'concurrency must be greater than 0');

    const items = [];

    await Promise.all(new Array(concurrency).fill().map(async (val, idx) => {
      const params = {
        ...baseParams,
        Segment: idx,
        TotalSegments: concurrency,
        ExclusiveStartKey: null,
      };

      do {
        const results = await this.scan(context, params);
        if (results.Count > 0) {
          if (callback) {
            await callback(results.Items);
          } else {
            items.push(...results.Items);
          }
        }
        params.ExclusiveStartKey = results.LastEvaluatedKey;
      } while (params.ExclusiveStartKey);
    }));

    if (!callback) {
      return items;
    }
  }

  ttlToMs(ttl) {
    return ttl * 1000;
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
