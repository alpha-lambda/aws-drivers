'use strict';

const { expect } = require('chai');
const sinon = require('sinon');
const uuid = require('uuid');

const AwsDriverError = require('../lib/aws-driver-error');
const { S3: S3Driver } = require('../');
const setupTestHarness = require('./setup-test-harness');

describe('S3Driver', function() {
  setupTestHarness();

  beforeEach(function() {
    this.driver = new S3Driver();
    this.client = this.sandbox.stub(this.driver._client);
  });

  describe('#getSignedUrl', function() {
    it('should throw when operation is not passed', function() {
      const parameters = {};
      const urlTTL = 100500;

      expect(
        () => this.driver.getSignedUrl(this.testContext, { parameters, urlTTL })
      ).to.throw('missing operation');
    });

    it('should throw when urlTTL is not passed', function() {
      const operation = 'getObject';
      const parameters = {};

      expect(
        () => this.driver.getSignedUrl(this.testContext, { operation, parameters })
      ).to.throw('missing urlTTL');
    });

    it('should format request and parse response properly', async function() {
      const operation = 'getObject';
      const parameters = {
        Bucket: 'test-bucket',
        Key: uuid.v4(),
      };
      const urlTTL = 100500;
      const url = 'https://signed-url';

      this.client.getSignedUrl.yields(null, url);

      await expect(
        this.driver.getSignedUrl(this.testContext, { parameters, operation, urlTTL })
      ).to.eventually.be.equal(url);

      sinon.assert.calledWith(
        this.client.getSignedUrl,
        operation,
        {
          Bucket: parameters.Bucket,
          Expires: urlTTL,
          Key: parameters.Key,
        }
      );
    });

    it('should wrap AWS error into AwsDriverError', async function() {
      const error = new Error('AWS error');
      const operation = 'getObject';
      const parameters = {
        Bucket: 'test-bucket',
        Key: uuid.v4(),
      };
      const urlTTL = 100500;

      this.client.getSignedUrl.yields(error);

      const actual = await expect(
        this.driver.getSignedUrl(this.testContext, { parameters, operation, urlTTL })
      ).to.be.rejectedWith(AwsDriverError);

      expect(actual).to.have.property('message', 'failed to generate signed URL');
      expect(actual)
        .to.have.property('cause')
        .that.is.deep.equal(error);
    });
  });

  describe('#putObject', function() {
    it('should throw when bucket is not passed', function() {
      const body = uuid.v4();

      expect(
        () => this.driver.putObject(this.testContext, { body })
      ).to.throw('missing bucket');
    });

    it('should throw when body is not passed', function() {
      const bucket = 'test-bucket';

      expect(
        () => this.driver.putObject(this.testContext, { bucket })
      ).to.throw('missing body');
    });

    it('should format request and parse response properly', async function() {
      const bucket = 'test-bucket';
      const body = 'foo';
      const key = 'test-key';
      const response = { body: uuid.v4() };

      this.client.putObject.returns(this.awsPromise(response));

      await expect(
        this.driver.putObject(this.testContext, { bucket, body, key })
      ).to.eventually.deep.equal(response);

      sinon.assert.calledWith(this.client.putObject, {
        Body: body,
        Bucket: bucket,
        Key: key,
      });
    });

    it('should generate key when not passed', async function() {
      const bucket = 'test-bucket';
      const body = 'foo';

      this.client.putObject.returns(this.awsPromise());

      await expect(
        this.driver.putObject(this.testContext, { bucket, body })
      ).to.be.fulfilled;

      sinon.assert.calledOnce(this.client.putObject);
      const args = this.client.putObject.firstCall.args[0];

      expect(args)
        .to.have.property('Key')
        .that.is.a.uuid('v4');
    });

    it('should add extra params when passed', async function() {
      const bucket = 'test-bucket';
      const body = 'foo';
      const key = 'test-key';
      const params = {
        ContentEncoding: 'gzip',
      };
      const response = { body: uuid.v4() };

      this.client.putObject.returns(this.awsPromise(response));

      await expect(
        this.driver.putObject(this.testContext, { bucket, body, key }, params)
      ).to.eventually.deep.equal(response);

      sinon.assert.calledWith(this.client.putObject, {
        Body: body,
        Bucket: bucket,
        ContentEncoding: params.ContentEncoding,
        Key: key,
      });
    });

    it('should override extra params in case of collision', async function() {
      const bucket = 'test-bucket';
      const body = 'foo';
      const key = 'test-key';
      const params = {
        Bucket: 'another-bucket',
      };
      const response = { body: uuid.v4() };

      this.client.putObject.returns(this.awsPromise(response));

      await expect(
        this.driver.putObject(this.testContext, { bucket, body, key }, params)
      ).to.eventually.deep.equal(response);

      sinon.assert.calledWith(this.client.putObject, {
        Body: body,
        Bucket: bucket,
        Key: key,
      });
    });

    it('should wrap AWS error into AwsDriverError', async function() {
      const error = new Error('AWS error');
      const bucket = 'test-bucket';
      const body = 'foo';

      this.client.putObject.returns(this.awsPromise(Promise.reject(error)));

      const actual = await expect(
        this.driver.putObject(this.testContext, { bucket, body })
      ).to.be.rejectedWith(AwsDriverError);

      expect(actual).to.have.property('message', 'failed to store object in S3');
      expect(actual)
        .to.have.property('cause')
        .that.is.deep.equal(error);
    });
  });

  describe('#upload', function() {
    it('should throw when bucket is not passed', function() {
      const body = uuid.v4();

      expect(
        () => this.driver.upload(this.testContext, { body })
      ).to.throw('missing bucket');
    });

    it('should throw when body is not passed', function() {
      const bucket = 'test-bucket';

      expect(
        () => this.driver.upload(this.testContext, { bucket })
      ).to.throw('missing body');
    });

    it('should format request and parse response properly', async function() {
      const bucket = 'test-bucket';
      const body = 'foo';
      const key = 'test-key';
      const options = { foo: 'foo' };
      const response = { body: uuid.v4() };

      this.client.upload.returns(this.awsPromise(response));

      await expect(
        this.driver.upload(this.testContext, { bucket, body, key, options })
      ).to.eventually.deep.equal(response);

      sinon.assert.calledWith(
        this.client.upload,
        {
          Body: body,
          Bucket: bucket,
          Key: key,
        },
        options
      );
    });

    it('should generate key when not passed', async function() {
      const bucket = 'test-bucket';
      const body = 'foo';

      this.client.upload.returns(this.awsPromise());

      await expect(
        this.driver.upload(this.testContext, { bucket, body })
      ).to.be.fulfilled;

      sinon.assert.calledOnce(this.client.upload);
      const args = this.client.upload.firstCall.args[0];

      expect(args)
        .to.have.property('Key')
        .that.is.a.uuid('v4');
    });

    it('should add extra params when passed', async function() {
      const bucket = 'test-bucket';
      const body = 'foo';
      const key = 'test-key';
      const params = {
        ContentEncoding: 'gzip',
      };
      const response = { body: uuid.v4() };

      this.client.upload.returns(this.awsPromise(response));

      await expect(
        this.driver.upload(this.testContext, { bucket, body, key }, params)
      ).to.eventually.deep.equal(response);

      sinon.assert.calledWith(this.client.upload, {
        Body: body,
        Bucket: bucket,
        ContentEncoding: params.ContentEncoding,
        Key: key,
      });
    });

    it('should override extra params in case of collision', async function() {
      const bucket = 'test-bucket';
      const body = 'foo';
      const key = 'test-key';
      const params = {
        Bucket: 'another-bucket',
      };
      const response = { body: uuid.v4() };

      this.client.upload.returns(this.awsPromise(response));

      await expect(
        this.driver.upload(this.testContext, { bucket, body, key }, params)
      ).to.eventually.deep.equal(response);

      sinon.assert.calledWith(this.client.upload, {
        Body: body,
        Bucket: bucket,
        Key: key,
      });
    });

    it('should wrap AWS error into AwsDriverError', async function() {
      const error = new Error('AWS error');
      const bucket = 'test-bucket';
      const body = 'foo';

      this.client.upload.returns(this.awsPromise(Promise.reject(error)));

      const actual = await expect(
        this.driver.upload(this.testContext, { bucket, body })
      ).to.be.rejectedWith(AwsDriverError);

      expect(actual).to.have.property('message', 'failed to upload object to S3');
      expect(actual)
        .to.have.property('cause')
        .that.is.deep.equal(error);
    });
  });
});
