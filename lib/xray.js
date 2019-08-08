'use strict';

const AWS = require('aws-sdk');
const AWSXRay = require('aws-xray-sdk');
const logMeGently = require('@alpha-lambda/log-me-gently');

const fake = {
  addAnnotation: Function.prototype,
};

class XRay {
  constructor({ isEnabled, level }) {
    this.enabled = isEnabled;

    if (this.enabled) {
      AWSXRay.captureAWS(AWS);
    }

    this._logger = logMeGently({ level });
  }

  trace(context, name, fn) {
    return new Promise((resolve, reject) => {
      if (this.enabled) {
        try {
          const wrapper = this._asyncFunctionWrapper(context, fn, resolve, reject);
          AWSXRay.captureAsyncFunc(name, wrapper);
          return;
        } catch (err) {
          this._logger.log(context, { err }, 'Unable to open x-ray subsegment');
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

  _asyncFunctionWrapper(context, fn, resolve, reject) {
    return async (subsegment) => {
      try {
        const result = await fn({
          addAnnotation: (key, value) => {
            try {
              subsegment.addAnnotation(key, value);
            } catch (err) {
              this._logger.log(context, { err }, 'Unable to addAnnotation to x-ray subsegment');
            }
          },
        });

        try {
          subsegment.close();
        } catch (err) {
          this._logger.log(context, { err }, 'Unable to close x-ray subsegment');
        }

        return resolve(result);
      } catch (e) {
        try {
          subsegment.close(e);
        } catch (err) {
          this._logger.log(context, { err }, 'Unable to close x-ray subsegment');
        }
        return reject(e);
      }
    };
  }
}

module.exports = XRay;
