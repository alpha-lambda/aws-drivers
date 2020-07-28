'use strict';

const { expect } = require('chai');
const sinon = require('sinon');
const uuid = require('uuid');

const AwsDriverError = require('../lib/aws-driver-error');
const { DynamoDBDocumentClient } = require('../');
const setupTestHarness = require('./setup-test-harness');

describe('DynamoDBDocumentClientDriver', function() {
  setupTestHarness();

  beforeEach(function() {
    this.driver = new DynamoDBDocumentClient({ level: 'debug' });
    this.client = this.sandbox.stub(this.driver._client);
  });

  ['delete', 'get', 'put', 'update', 'query', 'scan'].forEach(method => {
    describe(`#${method}`, function() {
      it('should call API properly', async function() {
        const params = { param: uuid.v4() };
        const response = { data: uuid.v4() };

        this.client[method].returns(this.awsPromise(response));

        const result = await this.driver[method](this.testContext, params);

        expect(result).to.deep.equal(response);
        sinon.assert.calledWithExactly(this.client[method], params);
      });

      it('should wrap AWS error into AwsDriverError', async function() {
        const params = { param: uuid.v4() };
        const error = new Error('AWS error');

        this.client[method].returns(this.awsPromise(() => Promise.reject(error)));

        const actual = await expect(
          this.driver[method](this.testContext, params)
        ).to.be.rejectedWith(AwsDriverError);

        expect(actual).to.have.property('message', `failed to make DynamoDB ${method} call`);
        expect(actual)
          .to.have.property('cause')
          .that.is.deep.equal(error);
      });
    });
  });

  describe('#batchGet', function() {
    it('should retry and merge results', async function() {
      const firstResponse = this.awsPromise({
        Responses: {
          'table-name': [{ test: true }],
        },
        UnprocessedKeys: {
          'table-name': {
            Keys: [{ key: 'test2' }],
          },
        },
      });

      const secondResponse = this.awsPromise({
        Responses: {
          'table-name': [{ test2: true }],
        },
        UnprocessedKeys: {},
      });

      this.client.batchGet
        .onFirstCall()
        .returns(firstResponse)
        .onSecondCall()
        .returns(secondResponse);

      const result = await this.driver.batchGet(this.testContext, {
        RequestItems: {
          'table-name': {
            Keys: [{ key: 'test' }, { key: 'test2' }],
          },
        },
      });

      expect(result).to.deep.equal({
        Responses: {
          'table-name': [{ test: true }, { test2: true }],
        },
      });

      sinon.assert.calledTwice(this.client.batchGet);
      sinon.assert.calledWith(this.client.batchGet.firstCall, {
        RequestItems: {
          'table-name': {
            Keys: [{ key: 'test' }, { key: 'test2' }],
          },
        },
      });
      sinon.assert.calledWith(this.client.batchGet.secondCall, {
        RequestItems: {
          'table-name': {
            Keys: [{ key: 'test2' }],
          },
        },
      });
    });

    it('should be rejected when retry limit is reached', async function() {
      const params = {
        RequestItems: {
          'table-name': {
            Keys: [{ key: 'test' }, { key: 'test2' }],
          },
        },
      };
      const response = this.awsPromise({
        Responses: {
          'table-name': [{ test: true }],
        },
        UnprocessedKeys: {
          'table-name': {
            Keys: [{ key: 'test2' }],
          },
        },
      });

      this.client.batchGet.returns(response);

      const actual = await expect(
        this.driver.batchGet(this.testContext, params)
      ).to.be.rejectedWith(AwsDriverError);

      expect(actual).to.have.property('message', 'unable to fetch all requested items after too many retries');
    });
  });
});
