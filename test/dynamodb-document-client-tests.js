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
          this.driver[method](this.testContext, params),
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
        this.driver.batchGet(this.testContext, params),
      ).to.be.rejectedWith(AwsDriverError);

      expect(actual).to.have.property('message', 'unable to fetch all requested items after too many retries');
    });
  });

  describe('#scanAll', function() {
    it('should scan in parallel and merge results', async function() {
      const tableName = 'the-table';
      const filterExpression = 'foo is bar';
      const concurrency = 2;

      this.client.scan
        .withArgs({
          TableName: tableName,
          FilterExpression: filterExpression,
          Segment: 0,
          TotalSegments: concurrency,
          ExclusiveStartKey: null,
        })
        .returns(this.awsPromise({
          Count: 2,
          Items: ['call-1-1-first', 'call-1-1-second'],
          LastEvaluatedKey: 12345,
        }))
        .withArgs({
          TableName: tableName,
          FilterExpression: filterExpression,
          Segment: 0,
          TotalSegments: concurrency,
          ExclusiveStartKey: 12345,
        })
        .returns(this.awsPromise({
          Count: 2,
          Items: ['call-1-2-first', 'call-1-2-second'],
        })).withArgs({
          TableName: tableName,
          FilterExpression: filterExpression,
          Segment: 1,
          TotalSegments: concurrency,
          ExclusiveStartKey: null,
        })
        .returns(this.awsPromise({
          Count: 2,
          Items: ['call-2-1-first', 'call-2-1-second'],
        }));

      const result = await this.driver.scanAll(
        this.testContext,
        {
          TableName: tableName,
          FilterExpression: filterExpression,
        },
        {
          concurrency,
        },
      );

      expect(result).to.deep.equal([
        'call-1-1-first',
        'call-1-1-second',
        'call-2-1-first',
        'call-2-1-second',
        'call-1-2-first',
        'call-1-2-second',
      ]);

      sinon.assert.calledThrice(this.client.scan);
    });

    it('should scan in parallel and call callback when passed', async function() {
      const tableName = 'the-table';
      const filterExpression = 'foo is bar';
      const concurrency = 2;
      const callback = sinon.stub();

      this.client.scan
        .withArgs({
          TableName: tableName,
          FilterExpression: filterExpression,
          Segment: 0,
          TotalSegments: concurrency,
          ExclusiveStartKey: null,
        })
        .returns(this.awsPromise({
          Count: 2,
          Items: ['call-1-1-first', 'call-1-1-second'],
          LastEvaluatedKey: 12345,
        }))
        .withArgs({
          TableName: tableName,
          FilterExpression: filterExpression,
          Segment: 0,
          TotalSegments: concurrency,
          ExclusiveStartKey: 12345,
        })
        .returns(this.awsPromise({
          Count: 2,
          Items: ['call-1-2-first', 'call-1-2-second'],
        })).withArgs({
          TableName: tableName,
          FilterExpression: filterExpression,
          Segment: 1,
          TotalSegments: concurrency,
          ExclusiveStartKey: null,
        })
        .returns(this.awsPromise({
          Count: 2,
          Items: ['call-2-1-first', 'call-2-1-second'],
        }));

      const result = await this.driver.scanAll(
        this.testContext,
        {
          TableName: tableName,
          FilterExpression: filterExpression,
        },
        {
          concurrency,
          callback,
        },
      );

      expect(result).to.be.undefined;

      sinon.assert.calledThrice(this.client.scan);

      sinon.assert.calledThrice(callback);
      sinon.assert.calledWithExactly(callback, ['call-1-1-first', 'call-1-1-second']);
      sinon.assert.calledWithExactly(callback, ['call-1-2-first', 'call-1-2-second']);
      sinon.assert.calledWithExactly(callback, ['call-2-1-first', 'call-2-1-second']);
    });

    it('should handle empty response from DynamoDB', async function() {
      const tableName = 'the-table';
      const filterExpression = 'foo is bar';

      this.client.scan
        .returns(this.awsPromise({
          Count: 0,
          Items: [],
        }));

      const result = await this.driver.scanAll(
        this.testContext,
        {
          TableName: tableName,
          FilterExpression: filterExpression,
        },
      );

      expect(result).to.deep.equal([]);

      sinon.assert.called(this.client.scan);
    });

    it('should surface DynamoDB errors', async function() {
      const tableName = 'the-table';
      const filterExpression = 'foo is bar';
      const error = new Error('AWS error');

      this.client.scan.returns(this.awsPromise(() => Promise.reject(error)));

      const actual = await expect(
        this.driver.scanAll(
          this.testContext,
          {
            TableName: tableName,
            FilterExpression: filterExpression,
          },
        ),
      ).to.be.rejectedWith(AwsDriverError);

      expect(actual).to.have.property('message', 'failed to make DynamoDB scan call');
      expect(actual)
        .to.have.property('cause')
        .that.is.deep.equal(error);

      sinon.assert.called(this.client.scan);
    });
  });

  describe('#queryAll', function() {
    it('should query multiple times and merge results', async function() {
      const tableName = 'the-table';
      const filterExpression = 'foo is bar';

      this.client.query
        .withArgs({
          TableName: tableName,
          FilterExpression: filterExpression,
          ExclusiveStartKey: null,
        })
        .returns(this.awsPromise({
          Count: 2,
          Items: ['call-1-first', 'call-1-second'],
          LastEvaluatedKey: 12345,
        }))
        .withArgs({
          TableName: tableName,
          FilterExpression: filterExpression,
          ExclusiveStartKey: 12345,
        })
        .returns(this.awsPromise({
          Count: 2,
          Items: ['call-2-first', 'call-2-second'],
        }));

      const result = await this.driver.queryAll(
        this.testContext,
        {
          TableName: tableName,
          FilterExpression: filterExpression,
        },
      );

      expect(result).to.deep.equal([
        'call-1-first',
        'call-1-second',
        'call-2-first',
        'call-2-second',
      ]);

      sinon.assert.calledTwice(this.client.query);
    });

    it('should query in parallel and call callback when passed', async function() {
      const tableName = 'the-table';
      const filterExpression = 'foo is bar';
      const callback = sinon.stub();

      this.client.query
        .withArgs({
          TableName: tableName,
          FilterExpression: filterExpression,
          ExclusiveStartKey: null,
        })
        .returns(this.awsPromise({
          Count: 2,
          Items: ['call-1-first', 'call-1-second'],
          LastEvaluatedKey: 12345,
        }))
        .withArgs({
          TableName: tableName,
          FilterExpression: filterExpression,
          ExclusiveStartKey: 12345,
        })
        .returns(this.awsPromise({
          Count: 2,
          Items: ['call-2-first', 'call-2-second'],
        }));

      const result = await this.driver.queryAll(
        this.testContext,
        {
          TableName: tableName,
          FilterExpression: filterExpression,
        },
        callback,
      );

      expect(result).to.be.undefined;

      sinon.assert.calledTwice(this.client.query);

      sinon.assert.calledTwice(callback);
      sinon.assert.calledWithExactly(callback, ['call-1-first', 'call-1-second']);
      sinon.assert.calledWithExactly(callback, ['call-2-first', 'call-2-second']);
    });

    it('should handle empty response from DynamoDB', async function() {
      const tableName = 'the-table';
      const filterExpression = 'foo is bar';

      this.client.query
        .returns(this.awsPromise({
          Count: 0,
          Items: [],
        }));

      const result = await this.driver.queryAll(
        this.testContext,
        {
          TableName: tableName,
          FilterExpression: filterExpression,
        },
      );

      expect(result).to.deep.equal([]);

      sinon.assert.called(this.client.query);
    });

    it('should surface DynamoDB errors', async function() {
      const tableName = 'the-table';
      const filterExpression = 'foo is bar';
      const error = new Error('AWS error');

      this.client.query.returns(this.awsPromise(() => Promise.reject(error)));

      const actual = await expect(
        this.driver.queryAll(
          this.testContext,
          {
            TableName: tableName,
            FilterExpression: filterExpression,
          },
        ),
      ).to.be.rejectedWith(AwsDriverError);

      expect(actual).to.have.property('message', 'failed to make DynamoDB query call');
      expect(actual)
        .to.have.property('cause')
        .that.is.deep.equal(error);

      sinon.assert.called(this.client.query);
    });
  });
});
