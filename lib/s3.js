'use strict';

const assert = require('assert');
const uuid = require('uuid');

const AwsDriverError = require('./aws-driver-error');
const Driver = require('./driver');

class S3Driver extends Driver {
  constructor(options) {
    const clientOpts = {
      apiVersion: '2006-03-01',
      signatureVersion: 'v4'
    };
    super('S3', clientOpts, options);
  }

  getSignedUrl(context, { operation, parameters, urlTTL }) {
    assert(operation, 'missing operation');
    assert(urlTTL !== undefined, 'missing urlTTL');

    const params = {
      Expires: urlTTL,
      ...parameters
    };

    this._logger.log(context, { params, operation }, 'generating signed URL');
    return new Promise((resolve, reject) => {
      this._client.getSignedUrl(operation, params, (err, res) => {
        if (err) {
          reject(err);
        } else {
          resolve(res);
        }
      });
    })
      .catch((err) => {
        const message = 'failed to generate signed URL';
        this._logger.log(context, { err, params, operation }, message);

        throw new AwsDriverError({
          cause: err,
          details: {
            params,
            operation
          },
          message
        });
      });
  }

  putObject(context, { bucket, data, key }) {
    assert(bucket, 'missing bucket');
    assert(data, 'missing data');

    const putParams = {
      Body: typeof data === 'string'
        ? data
        : JSON.stringify(data),
      Bucket: bucket,
      Key: key || uuid.v4()
    };

    this._logger.log(context, {
      bucket: putParams.Bucket,
      key: putParams.Key
    }, 'storing object in S3');

    return this._client
      .putObject(putParams)
      .promise()
      .catch((err) => {
        const message = 'failed to store object in S3';
        this._logger.log(context, {
          err,
          bucket: putParams.Bucket,
          key: putParams.Key
        }, message);

        throw new AwsDriverError({
          cause: err,
          details: {
            bucket: putParams.Bucket,
            key: putParams.Key
          },
          message
        });
      });
  }
}

module.exports = S3Driver;
