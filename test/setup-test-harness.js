'use strict';

const sinon = require('sinon');

module.exports = function() {
  before(function() {
    this.sandbox = sinon.createSandbox();
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
