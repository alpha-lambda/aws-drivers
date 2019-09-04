'use strict';

const AJV = require('ajv');

const AwsDriverError = require('./aws-driver-error');

const ajv = new AJV({
  allErrors: true,
  verbose: true,
});

const errorString = errorArray => errorArray
  .map(error => {
    const { dataPath, parentSchema = {}, message } = error;
    const path = dataPath
      ? `$${dataPath}`
      : parentSchema.title || '';

    return `[${path}]: ${message}`;
  })
  .sort()
  .join(', ');

const validate = (validator, data) => {
  const valid = validator(data);
  const { errors } = validator;
  if (errors) {
    throw new AwsDriverError({
      message: errorString(errors),
      details: {
        data,
        errors,
      },
    });
  }
  return valid;
};

module.exports = {
  ajv,
  validate,
};
