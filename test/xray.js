'use strict';

const sinon = require('sinon');
const { expect } = require('chai');
const AWSXRay = require('aws-xray-sdk');

const XRay = require('../lib/xray');

describe('XRay', function () {
  beforeEach(function () {
    this.asyncFunctionWrapper = XRay.asyncFunctionWrapper;
    this.log = {
      warn: Function.prototype
    };
    sinon.stub(this.log, 'warn');
    this.resolve = sinon.stub().resolves();
    this.reject = sinon.stub().rejects();
    this.context = {
      log: this.log
    };
  });

  afterEach(function() {
    sinon.verifyAndRestore();
  });

  describe('trace', function () {
    it('executes the fake tracer if not enabled', async function () {
      sinon.stub(AWSXRay, 'captureAsyncFunc');
      const xray = new XRay({ isEnabled: false });

      await xray.trace(this.context, 'Name of trace', async () => { });

      expect(AWSXRay.captureAsyncFunc.callCount).to.be.equal(0);
    });

    it('warns if unable to open a segment', async function () {
      sinon.stub(AWSXRay, 'captureAsyncFunc').throws(new Error());
      const xray = new XRay({ isEnabled: true });

      await expect(
        xray.trace(this.context, 'test', async () => { })
      ).to.eventually.be.fulfilled;

      expect(this.log.warn.callCount).to.be.equal(1);
      expect(this.log.warn.args[0][1]).to.match(/Unable to open/);
    });

    it('can call addAnnotation, and resolves', async function () {
      const innerFunction = this.asyncFunctionWrapper(
        this.context,
        async (sub) => { sub.addAnnotation(); },
        this.resolve,
        this.reject,
      );
      const subsegment = {
        addAnnotation: sinon.stub(),
      };

      await expect(
        innerFunction(subsegment)
      ).to.eventually.be.fulfilled;

      expect(subsegment.addAnnotation.callCount).to.be.equal(1);
      expect(this.resolve.callCount).to.be.equal(1);
    });

    it('if addAnnotation fails, it warns unable to addAnnotation, and resolves', async function () {
      const innerFunction = this.asyncFunctionWrapper(
        this.context,
        async (sub) => { sub.addAnnotation(); },
        this.resolve,
        this.reject,
      );
      const subsegment = {
        addAnnotation: sinon.stub().throws(),
        close: () => { },
      };

      await expect(
        innerFunction(subsegment)
      ).to.eventually.be.fulfilled;

      expect(subsegment.addAnnotation.callCount).to.be.equal(1);
      expect(this.log.warn.callCount).to.be.equal(1);
      expect(this.log.warn.args[0][1]).to.match(/Unable to addAnnotation/);
      expect(this.resolve.callCount).to.be.equal(1);
    });

    it('if close fails, it warns unable to close, and resolves', async function () {
      const innerFunction = this.asyncFunctionWrapper(
        this.context,
        async () => 'result',
        this.resolve,
        this.reject,
      );
      const subsegment = {
        close: sinon.stub().throws(),
      };

      await expect(
        innerFunction(subsegment)
      ).to.eventually.be.fulfilled;

      expect(subsegment.close.callCount).to.be.equal(1);
      expect(this.log.warn.callCount).to.be.equal(1);
      expect(this.log.warn.args[0][1]).to.match(/Unable to close/);
      expect(this.resolve.callCount).to.be.equal(1);
      expect(this.resolve.args[0][0]).to.be.equal('result');
    });

    it('if function throws, it rejects', async function () {
      const innerFunction = this.asyncFunctionWrapper(
        this.context,
        async () => { throw new Error('potato'); },
        this.resolve,
        this.reject,
      );
      const subsegment = {
        close: sinon.stub(),
      };

      await expect(
        innerFunction(subsegment)
      ).to.eventually.be.rejected;

      expect(subsegment.close.callCount).to.be.equal(1);
      expect(this.reject.callCount).to.be.equal(1);
      expect(this.reject.args[0][0].message).to.be.equal('potato');
    });

    it('if function throws then segment fails to close, it warns and rejects', async function () {
      const innerFunction = this.asyncFunctionWrapper(
        this.context,
        async () => { throw new Error('potato'); },
        this.resolve,
        this.reject,
      );
      const subsegment = {
        close: sinon.stub().throws(),
      };

      await expect(
        innerFunction(subsegment)
      ).to.eventually.be.rejected;

      expect(subsegment.close.callCount).to.be.equal(1);
      expect(this.log.warn.callCount).to.be.equal(1);
      expect(this.log.warn.args[0][1]).to.match(/Unable to close/);
      expect(this.reject.callCount).to.be.equal(1);
      expect(this.reject.args[0][0].message).to.be.equal('potato');
    });
  });
  describe('getXRayTraceId', function () {
    it('returns null if xray is not enabled', function () {
      const xray = new XRay({ isEnabled: false });

      expect(xray.getXRayTraceId()).to.be.equal(null);
    });

    it('calls getSegment if xray is enabled', function () {
      const xray = new XRay({ isEnabled: true });
      sinon.stub(AWSXRay, 'getSegment').returns({ trace_id: 5 });

      expect(xray.getXRayTraceId()).to.be.deep.equal(5);
      expect(AWSXRay.getSegment.callCount).to.be.equal(1);
    });
  });
});
