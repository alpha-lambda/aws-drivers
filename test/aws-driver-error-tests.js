'use strict';

const { expect } = require('chai');

const AwsDriverError = require('../lib/aws-driver-error');

describe('AwsDriverError', function() {
  it('should set all properties', function() {
    const cause = new Error('Oops');
    const details = { foo: 'bar' };
    const message = 'important message';

    const err = new AwsDriverError({ cause, details, message });

    expect(err).to.have.property('message', message);
    expect(err)
      .to.have.property('cause')
      .that.is.deep.equal(cause);
    expect(err)
      .to.have.property('details')
      .that.is.deep.equal(details);
  });

  it('should set default properties when not passed', function() {
    const err = new AwsDriverError({});

    expect(err).to.have.property('message', 'AWS driver error');
    expect(err)
      .to.have.property('cause')
      .that.is.null;
    expect(err)
      .to.have.property('details')
      .that.is.deep.equal({});
  });
});
