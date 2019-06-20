# aws-drivers

[![Build Status][ci-image]][ci-url]
[![Coverage Status][coverage-image]][coverage-url]
[![NPM version][npm-image]][npm-url]
[![Dependencies Status][dependencies-image]][dependencies-url]
[![DevDependencies Status][devdependencies-image]][devdependencies-url]

Wrappers for AWS SDK services that make life easier (sometimes).

## Drivers

### Constructing drivers
Each driver has a constructor of the following form:

### constructor({ [client], [useClient], [level], [...other] })
  - **[client]** - { Object } - config field that is used to construct client (ignored when pre-configured client is passed)
  - **[useClient]** - { Object } - pre-configured client
  - **[level]** - { String } - log level
  - **[...other]** - { Any } - driver-specific config options

### S3

#### getSignedUrl(context, { operation, parameters, urlTTL })
Get a pre-signed URL for a given operation name.
  - **operation** - { String } - the name of the operation to call
  - **parameters** - { Object } - parameters to pass to the operation
  - **urlTTL** - { Number } - URL expiration time in seconds

#### putObject(context, { bucket, data, [key] })
Adds an object to a bucket.
  - **bucket** - { String } - name of the bucket
  - **data** - { Any } - object data; can be a String or any type that can be stringified
  - **[key]** - { String } - object key [random UUID by default]

## License

The MIT License (MIT)

Copyright (c) 2019 Anton Bazhal

Permission is hereby granted, free of charge, to any person obtaining a copy of this software and associated documentation files (the "Software"), to deal in the Software without restriction, including without limitation the rights to use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies of the Software, and to permit persons to whom the Software is furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.

[ci-image]: https://circleci.com/gh/alpha-lambda/aws-drivers.svg?style=shield&circle-token=f9a46625c41e8cfecc0f6cdfb983a99b0155d88e
[ci-url]: https://circleci.com/gh/alpha-lambda/aws-drivers
[coverage-image]: https://coveralls.io/repos/github/alpha-lambda/aws-drivers/badge.svg?branch=master
[coverage-url]: https://coveralls.io/github/alpha-lambda/aws-drivers?branch=master
[dependencies-url]: https://david-dm.org/alpha-lambda/aws-drivers
[dependencies-image]: https://david-dm.org/alpha-lambda/aws-drivers/status.svg
[devdependencies-url]: https://david-dm.org/alpha-lambda/aws-drivers?type=dev
[devdependencies-image]: https://david-dm.org/alpha-lambda/aws-drivers/dev-status.svg
[npm-url]: https://www.npmjs.org/package/@alpha-lambda/aws-drivers
[npm-image]: https://img.shields.io/npm/v/@alpha-lambda/aws-drivers.svg
