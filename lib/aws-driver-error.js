'use strict';

class AwsDriverError extends Error {
  constructor({ cause, details, message }) {
    super(message || 'AWS driver error');

    this.name = 'AwsDriverError';
    this.cause = cause || null;
    this.details = details || {};
  }
}

module.exports = AwsDriverError;
