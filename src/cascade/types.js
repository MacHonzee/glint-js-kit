/**
 * @typedef {Object} ServiceConfig
 * @property {string} baseUri
 * @property {string} [defaultAuth]
 */

/**
 * @typedef {Object} UserConfig
 * @property {string} [service]
 * @property {string} usernameEnvKey
 * @property {string} passwordEnvKey
 */

/**
 * @typedef {Object} AuthenticationConfig
 * @property {string} service
 * @property {string} loginEndpoint
 * @property {string} tokenPath
 * @property {string} userPath
 * @property {string} [defaultAuth]
 * @property {Record<string, UserConfig>} users
 */

/**
 * @typedef {Object} EnvironmentConfig
 * @property {string} name
 * @property {Record<string, ServiceConfig>} services
 * @property {AuthenticationConfig} authentication
 * @property {Object} config
 */

/**
 * @typedef {Object} RegisterAsConfig
 * @property {string} userKey - Key to identify this user for subsequent auth
 * @property {string} [usernamePath] - Path in dtoIn to extract username (default: "email" or "username")
 * @property {string} [passwordPath] - Path in dtoIn to extract password (default: "password")
 */

/**
 * @typedef {Object} Command
 * @property {string} [endpoint] - API endpoint path (requires service; mutually exclusive with url)
 * @property {string} [service] - Service name from env config (requires endpoint; mutually exclusive with url)
 * @property {string|((state: State) => string)} [url] - Absolute http(s) URL (mutually exclusive with service+endpoint)
 * @property {string|false} [auth] - User key, or false to disable auth (absolute url defaults to no auth when omitted)
 * @property {string} [method] - HTTP method (default: POST)
 * @property {Object|Function} [dtoIn] - JSON request body/params, or function `(state) => object`
 * @property {Buffer|Uint8Array|string|ArrayBuffer|Function} [body] - Raw body (mutually exclusive with dtoIn)
 * @property {Object|Function} [headers] - Extra request headers, or function `(state) => object`
 * @property {string} [saveAs]
 * @property {string[]} [allowedErrorCodes]
 * @property {Function} [allowedError]
 * @property {string} [import]
 * @property {Object} [params]
 * @property {Record<string, any>} [expect] - Assertions for successful responses (dot-notation paths)
 * @property {Record<string, any>} [expectError] - Assertions for error responses (dot-notation paths, auto-allows error)
 * @property {string|RegisterAsConfig} [registerAs] - Register dtoIn credentials as a dynamic user for subsequent auth
 */

/**
 * @typedef {Object} DatasetResult
 * @property {Command[]} cascade
 */

/**
 * @typedef {Object} State
 * @property {Record<string, any>} [users]
 * @property {Object} [params]
 * @property {Record<string, any>} [saved]
 */

/**
 * @typedef {Object} ExecutionOptions
 * @property {string} [logLevel]
 * @property {boolean} [dryRun]
 * @property {Record<string, any>} [options]
 */
