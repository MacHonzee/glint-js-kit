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
 * @property {string} [endpoint]
 * @property {string} [service]
 * @property {string} [auth]
 * @property {string} [method]
 * @property {Object|Function} [dtoIn]
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
