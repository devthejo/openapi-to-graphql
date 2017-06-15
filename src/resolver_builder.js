'use strict'

const request = require('request')
const Oas3Tools = require('./oas_3_tools.js')

/**
 * Creates and returns a resolver function that performs API requests for the
 * given GraphQL query.
 *
 * @param  {string} options.path         Path to invoke
 * @param  {string} options.method       Method to invoke
 * @param  {object} options.oas
 * @param  {object} options.argsFromLink Object containing the args for this
 * resolver provided through links
 * @param  {string} options.payloadName  Name of the argument to send as request
 * payload
 * @param  {object} options.data         Data produced by preprocessor.js
 * @return {function}                    Resolver function
 */
const getResolver = ({
  operation,
  oas,
  argsFromLink = {},
  payloadName,
  data
}) => {
  // determine the base URL:
  let baseUrl = Oas3Tools.getBaseUrl(oas)

  // return resolve function:
  return (root, args, ctx) => {
    // handle arguments provided by links:
    if (typeof argsFromLink === 'object') {
      for (let key in argsFromLink) {
        args[key] = root[argsFromLink[key]]
      }
    }

    // build URL (i.e., fill in path parameters):
    let {path, query} = Oas3Tools.instantiatePathAndGetQuery(
      operation.path,
      operation.parameters,
      args)
    let url = baseUrl + path
    console.log(query)
    // build request options:
    let options = {
      method: operation.method,
      url: url,
      json: true,
      headers: {},
      qs: query
    }

    // determine possible payload:
    // GraphQL produces sanitized payload names, so we have to sanitize before
    // lookup here:
    let sanePayloadName = Oas3Tools.beautify(payloadName)
    if (sanePayloadName in args) {
      // we need to desanitize the payload so the API understands it:
      let rawPayload = Oas3Tools.desanitizeObjKeys(
        args[sanePayloadName], data.saneMap)
      options.body = rawPayload
    }

    // use OASGraph options:
    if (typeof data.options === 'object') {
      // headers:
      if (typeof data.options.headers === 'object') {
        for (let header in data.options.headers) {
          let val = data.options.headers[header]
          options.headers[header] = val
        }
      }
      // query string:
      if (typeof data.options.qs === 'object') {
        for (let query in data.options.qs) {
          let val = data.options.qs[query]
          options.qs[query] = val
        }
      }
    }

    // make the call:
    console.log(`${options.method.toUpperCase()} ${options.url}`)
    return new Promise((resolve, reject) => {
      request(options, (err, response, body) => {
        if (err) {
          console.error(err)
          reject(err)
        } else if (response.statusCode > 299) {
          console.error(`${response.statusCode} - ${JSON.stringify(body)}`)
          reject(new Error(`${response.statusCode} - ${JSON.stringify(body)}`))
        } else {
          console.log(response.statusCode)
          // deal with the fact that the server might send unsanitized data:
          let saneData = Oas3Tools.sanitizeObjKeys(body)

          resolve(saneData)
        }
      })
    })
  }
}

module.exports = {
  getResolver
}
