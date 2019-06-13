'use strict';

const chai = require('chai');
const chaiAsPromised = require('chai-as-promised');
const chaiUUID = require('chai-uuid');

chai.use(chaiUUID);
chai.use(chaiAsPromised); // This one should be the last
