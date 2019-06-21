'use strict';

const sinon = require('sinon');
const uuid = require('uuid');

module.exports = function() {
  before(function() {
    this.sandbox = sinon.createSandbox();
    this.testContext = {
      awsRequestId: uuid.v4()
    };
    this.awsPromise = value => ({
      promise() {
        return Promise.resolve(typeof value === 'function' ? value() : value);
      }
    });
  });

  afterEach(function() {
    this.sandbox.restore();
  });
};
