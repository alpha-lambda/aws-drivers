'use strict';

const assert = require('assert');
const AWS = require('aws-sdk');
const uuid = require('uuid');

const AwsDriverError = require('./aws-driver-error');
const Driver = require('./driver');

class S3Driver extends Driver {
  constructor(options) {
    const clientOpts = {
      apiVersion: '2006-03-01',
      signatureVersion: 'v4',
    };
    super(AWS.S3, clientOpts, options);
  }

  getSignedUrl(context, { operation, parameters, urlTTL }) {
    assert(context, 'missing context');
    assert(operation, 'missing operation');
    assert(urlTTL !== undefined, 'missing urlTTL');

    const params = {
      Expires: urlTTL,
      ...parameters,
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
      .catch(err => {
        const message = 'failed to generate signed URL';
        this._logger.log(context, { err, params, operation }, message);

        throw new AwsDriverError({
          cause: err,
          details: {
            params,
            operation,
          },
          message,
        });
      });
  }

  putObject(context, { bucket, body, key }, params) {
    assert(context, 'missing context');
    assert(bucket, 'missing bucket');
    assert(body, 'missing body');

    const putParams = {
      ...params,
      Body: body,
      Bucket: bucket,
      Key: key || uuid.v4(),
    };

    const { Body, ...otherParams } = putParams; // eslint-disable-line no-unused-vars
    this._logger.log(context, otherParams, 'storing object in S3');

    return this._client
      .putObject(putParams)
      .promise()
      .catch(err => {
        const message = 'failed to store object in S3';
        this._logger.log(context, {
          err,
          ...otherParams,
        }, message);

        throw new AwsDriverError({
          cause: err,
          details: putParams,
          message,
        });
      });
  }

  upload(context, { bucket, body, key, options }, params) {
    assert(context, 'missing context');
    assert(bucket, 'missing bucket');
    assert(body, 'missing body');

    const uploadParams = {
      ...params,
      Body: body,
      Bucket: bucket,
      Key: key || uuid.v4(),
    };

    const { Body, ...otherParams } = uploadParams; // eslint-disable-line no-unused-vars
    this._logger.log(context, {
      params: otherParams,
      options,
    }, 'uploading object to S3');

    return this._client
      .upload(uploadParams, options)
      .promise()
      .catch(err => {
        const message = 'failed to upload object to S3';
        this._logger.log(context, {
          err,
          params: otherParams,
          options,
        }, message);

        throw new AwsDriverError({
          cause: err,
          details: {
            params: uploadParams,
            options,
          },
          message,
        });
      });
  }
}

module.exports = S3Driver;
