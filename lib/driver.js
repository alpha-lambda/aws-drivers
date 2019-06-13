'use strict';

const assert = require('assert');
const AWS = require('aws-sdk');
const logMeGently = require('@alpha-lambda/log-me-gently');

class Driver {
  constructor(service, clientOpts = {}, { client, conf = {}, level } = {}) {
    assert(service, 'missing service');

    if (client) {
      this._client = client;
    } else {
      const clientOptions = Object.assign(clientOpts, conf.client);

      this._client = new AWS[service](clientOptions);
    }

    this._conf = conf;
    this._logger = logMeGently({ level });
  }

  get client() {
    return this._client;
  }

  get conf() {
    return this._conf;
  }
}

module.exports = Driver;
