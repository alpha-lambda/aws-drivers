'use strict';

const { expect } = require('chai');

const Driver = require('../lib/driver');
const setupTestHarness = require('./setup-test-harness');

describe('Driver', function() {
  setupTestHarness();

  beforeEach(function() {
    this.driver = new Driver('S3');
  });

  describe('#constructor', function() {
    it('should throw when service is missing', function() {
      expect(() => new Driver())
        .to.throw('missing service');
    });

    it('should use provided client', function() {
      const client = { foo: 'bar' };

      const driver = new Driver('S3', {}, { client });

      expect(driver._client).to.deep.equal(client);
    });
  });

  describe('#client', function() {
    it('should return configured client', function() {
      const { client } = this.driver;

      expect(client).to.deep.equal(this.driver._client);
    });
  });

  describe('#conf', function() {
    it('should return config', function() {
      const { conf } = this.driver;

      expect(conf).to.deep.equal(this.driver._conf);
    });
  });
});
