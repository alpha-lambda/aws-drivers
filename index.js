'use strict';

const DynamoDBDocumentClient = require('./lib/dynamodb-document-client');
const S3 = require('./lib/s3');
const SQS = require('./lib/sqs');
const XRay = require('./lib/xray');

module.exports = {
  DynamoDBDocumentClient,
  S3,
  SQS,
  XRay
};
