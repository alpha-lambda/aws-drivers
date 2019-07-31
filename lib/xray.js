'use strict';

const AWSXRay = require('aws-xray-sdk');
const AWS = require('aws-sdk');

const fake = {
  addAnnotation: Function.prototype,
};

const asyncFunctionWrapper = (context, fn, resolve, reject) => async (subsegment) => {
  try {
    const result = await fn({
      addAnnotation(key, value) {
        try {
          subsegment.addAnnotation(key, value);
        } catch (err) {
          context.log.warn({ err }, 'Unable to addAnnotation to x-ray subsegment');
        }
      },
    });

    try {
      subsegment.close();
    } catch (err) {
      context.log.warn({ err }, 'Unable to close x-ray subsegment');
    }

    return resolve(result);
  } catch (e) {
    try {
      subsegment.close(e);
    } catch (err) {
      context.log.warn({ err }, 'Unable to close x-ray subsegment');
    }
    return reject(e);
  }
};

class XRay {
  constructor({ isEnabled }) {
    this.enabled = isEnabled;

    if (this.enabled) {
      AWSXRay.captureAWS(AWS);
    }
  }

  trace(context, name, fn) {
    return new Promise((resolve, reject) => {
      if (this.enabled) {
        try {
          const wrapper = asyncFunctionWrapper(context, fn, resolve, reject);
          AWSXRay.captureAsyncFunc(name, wrapper);
          return;
        } catch (err) {
          context.log.warn({ err }, 'Unable to open x-ray subsegment');
        }
      }

      fn(fake).then(resolve, reject);
    });
  }

  getXRayTraceId() {
    if (this.enabled) {
      const segment = AWSXRay.getSegment();
      return segment && segment.trace_id;
    }
    return null;
  }
}

XRay.asyncFunctionWrapper = asyncFunctionWrapper;
module.exports = XRay;
