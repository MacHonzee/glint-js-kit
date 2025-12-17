import axios from "axios";
import { getBaseUri, resolveAuth } from "./helpers.js";
import { getToken } from "./auth-manager.js";
import { getLogger } from "./logger.js";

/**
 * Check if an error response is allowed based on command configuration
 * @param {import('./types.js').Command} command - Command object
 * @param {Error} error - Axios error
 * @returns {boolean} True if error is allowed
 */
function isAllowedError(command, error) {
  const response = error.response;

  if (!response) {
    return false; // Network errors are never allowed
  }

  // Check allowed error codes
  if (command.allowedErrorCodes && Array.isArray(command.allowedErrorCodes)) {
    const errorCode = response.data?.code;
    if (errorCode && command.allowedErrorCodes.includes(errorCode)) {
      return true;
    }
  }

  // Check custom allowed error function
  if (command.allowedError && typeof command.allowedError === "function") {
    try {
      return command.allowedError(error, response);
    } catch (err) {
      // If the function throws, don't allow the error
      return false;
    }
  }

  return false;
}

/**
 * Make an HTTP request for a command
 * @param {import('./types.js').Command} command - Command object
 * @param {import('./types.js').EnvironmentConfig} env - Environment configuration
 * @param {import('./types.js').State} state - Execution state
 * @param {Object} dtoIn - Resolved dtoIn object
 * @returns {Promise<import('axios').AxiosResponse>} Axios response
 */
export async function makeRequest(command, env, state, dtoIn) {
  const logger = getLogger();

  const service = env.services[command.service];
  if (!service) {
    throw new Error(`Service '${command.service}' not found in environment configuration`);
  }

  const baseUri = getBaseUri(env, command.service);
  const method = (command.method || "POST").toUpperCase();
  const url = `${baseUri}${command.endpoint}`;

  logger.info(`Executing ${method} ${command.endpoint} on service ${command.service}`);
  logger.debug(`Request URL: ${url}`);
  logger.debug(`Request body: ${JSON.stringify(dtoIn, null, 2)}`);

  // Resolve auth
  const userKey = resolveAuth(command, env);
  let headers = {};

  if (userKey) {
    const token = await getToken(userKey, env, state);
    headers.Authorization = `Bearer ${token}`;
    logger.debug(`Using authentication for user: ${userKey}`);
  }

  // Prepare request config
  const config = {
    method,
    url,
    headers: {
      "Content-Type": "application/json",
      ...headers,
    },
    timeout: env.config?.timeout || 30000,
    data: method !== "GET" && method !== "DELETE" ? dtoIn : undefined,
    params: method === "GET" || method === "DELETE" ? dtoIn : undefined,
  };

  try {
    const response = await axios(config);
    logger.debug(`Response status: ${response.status}`);
    logger.debug(`Response data: ${JSON.stringify(response.data, null, 2)}`);
    return response;
  } catch (error) {
    logger.error(`Request failed: ${error.message}`);

    if (error.response) {
      logger.debug(`Response status: ${error.response.status}`);
      logger.debug(`Response data: ${JSON.stringify(error.response.data, null, 2)}`);

      // Check if error is allowed
      if (isAllowedError(command, error)) {
        logger.info(`Error is allowed, continuing execution`);
        return error.response; // Return the error response as if it was successful
      }
    }

    // Re-throw if not allowed
    throw error;
  }
}
