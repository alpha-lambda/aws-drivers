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

### DynamoDBDocumentClient

Additional config properties:
  - **[attempts]** - { Number } - max number of attempts to `batchGet` items

#### batchGet(context, params)
Returns the attributes of one or more items from one or more tables ([parameters reference][document-client-batch-get-url]). Automatically retries when API call returns `UnprocessedKeys`

#### get(context, params)
Returns a set of attributes for the item with the given key ([parameters reference][document-client-get-url]).

#### put(context, params)
Creates a new item, or replaces an old item ([parameters reference][document-client-put-url]).

#### query(context, params)
Finds items based on key values ([parameters reference][document-client-query-url]).

#### scan(context, params)
Returns one or more items and item attributes by accessing every item in a table or a secondary index ([parameters reference][document-client-scan-url]).

#### update(context, params)
Edits an existing item's attributes, or adds a new item to the table if it does not already exist ([parameters reference][document-client-update-url]).

### S3

#### getSignedUrl(context, { operation, parameters, urlTTL })
Get a pre-signed URL for a given operation name.
  - **operation** - { String } - the name of the operation to call
  - **parameters** - { Object } - parameters to pass to the operation
  - **urlTTL** - { Number } - URL expiration time in seconds

#### putObject(context, { bucket, data, [key] }, params)
Adds an object to a bucket.
  - **bucket** - { String } - name of the bucket
  - **data** - { Buffer | Typed Array | Blob | String | ReadableStream } - object data
  - **[key]** - { String } - object key [random UUID by default]
  - **[params]** - { Object } - any additional input parameters that [S3.putObject][s3-put-object-url] allows

### SQS

Additional config properties:
  - **[maxConcurrency]** - { Number } - max number of concurrent AWS API calls [defaults to `Infinity`]

#### parse(context, input)
Validates and parses input, where input can be SQS message or SQS event. Sample output:

```json
[
  {
    "body": {
      "foo": "foo",
      "bar": "bar"
    },
    "messageAttributes": {
      "baz": 12345
    },
    "messageId": 1234567890
  }
]
```

#### send(context, queueUrl, messages)
Sends messages to the specified queue using batch API to reduce number of calls.
  - **queueUrl** - { String } - the URL of the SQS queue to which batched messages are sent
  - **messages** - { Any | Any[] } - messages to be sent

#### sendToDLQ(context, dlqUrl, items)
Formats and sends messages to the specified deadletter queue.
  - **dlqUrl** - { String } - the deadletter queue URL to which messages are sent
  - **items** - { Object | Object[] } - items to send to the deadletter queue, where:
    - **event** - { Any } - original payload that can't be processed
    - **error** - { Object } - error that occured during processing

These message attributes are added to each message:
  - **err.message** - error message
  - **err.stack** - error stack trace
  - **context.awsRequestId** - requestId for the current request, provided by Amazon
  - **origin.messageId** - original messageId (if payload is SQS message)

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
[document-client-batch-get-url]: https://docs.aws.amazon.com/AWSJavaScriptSDK/latest/AWS/DynamoDB/DocumentClient.html#batchGet-property
[document-client-get-url]: https://docs.aws.amazon.com/AWSJavaScriptSDK/latest/AWS/DynamoDB/DocumentClient.html#get-property
[document-client-put-url]: https://docs.aws.amazon.com/AWSJavaScriptSDK/latest/AWS/DynamoDB/DocumentClient.html#put-property
[document-client-query-url]: https://docs.aws.amazon.com/AWSJavaScriptSDK/latest/AWS/DynamoDB/DocumentClient.html#query-property
[document-client-scan-url]: https://docs.aws.amazon.com/AWSJavaScriptSDK/latest/AWS/DynamoDB/DocumentClient.html#scan-property
[document-client-update-url]: https://docs.aws.amazon.com/AWSJavaScriptSDK/latest/AWS/DynamoDB/DocumentClient.html#update-property
[npm-url]: https://www.npmjs.org/package/@alpha-lambda/aws-drivers
[npm-image]: https://img.shields.io/npm/v/@alpha-lambda/aws-drivers.svg
[s3-put-object-url]: https://docs.aws.amazon.com/AWSJavaScriptSDK/latest/AWS/S3.html#putObject-property
