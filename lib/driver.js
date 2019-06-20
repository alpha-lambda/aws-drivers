'use strict';

const assert = require('assert');
const AWS = require('aws-sdk');
const logMeGently = require('@alpha-lambda/log-me-gently');

class Driver {
  constructor(service, clientOpts = {}, conf = {}) {
    assert(service, 'missing service');

    const { client, level, useClient } = conf;

    if (useClient) {
      this._client = useClient;
    } else {
      const clientOptions = Object.assign(clientOpts, client);

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
