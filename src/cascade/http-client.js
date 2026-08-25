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

  // If expectError is defined, automatically allow the error (assertions will validate it)
  if (command.expectError && typeof command.expectError === "object") {
    return true;
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
    } catch {
      // If the function throws, don't allow the error
      return false;
    }
  }

  return false;
}

/**
 * Resolve request URL from absolute url or service+endpoint
 * @param {import('./types.js').Command} command
 * @param {import('./types.js').EnvironmentConfig} env
 * @param {import('./types.js').State} state
 * @returns {Promise<string>|string}
 */
function resolveRequestUrl(command, env, state) {
  if (command.url != null) {
    const resolved = typeof command.url === "function" ? command.url(state) : command.url;
    if (typeof resolved !== "string" || !/^https?:\/\//i.test(resolved)) {
      throw new Error(`Command url must resolve to an absolute http(s) URL, got: ${resolved}`);
    }
    return resolved;
  }

  const service = env.services[command.service];
  if (!service) {
    throw new Error(`Service '${command.service}' not found in environment configuration`);
  }

  const baseUri = getBaseUri(env, command.service);
  return `${baseUri}${command.endpoint}`;
}

/**
 * Describe body for logging without dumping binary content
 * @param {any} body
 * @returns {string}
 */
function describeBodyForLog(body) {
  if (body == null) {
    return "empty";
  }
  if (Buffer.isBuffer(body)) {
    return `<binary ${body.length} bytes>`;
  }
  if (body instanceof Uint8Array) {
    return `<binary ${body.byteLength} bytes>`;
  }
  if (body instanceof ArrayBuffer) {
    return `<binary ${body.byteLength} bytes>`;
  }
  if (typeof body === "string") {
    return body.length > 200 ? `<string ${body.length} chars>` : body;
  }
  try {
    return JSON.stringify(body, null, 2);
  } catch {
    return String(body);
  }
}

/**
 * Resolve request body, query params, and headers
 * @param {import('./types.js').Command} command
 * @param {import('./types.js').State} state
 * @param {string} method
 * @param {Object} [resolvedDtoIn] - Pre-resolved dtoIn from executor
 * @returns {{ data: any, params: any, headers: Object }}
 */
function resolveBodyAndHeaders(command, state, method, resolvedDtoIn) {
  const rawHeaders = typeof command.headers === "function" ? command.headers(state) : command.headers || {};
  const headers = { ...rawHeaders };

  if (command.body != null) {
    const body = typeof command.body === "function" ? command.body(state) : command.body;
    // Do not default Content-Type for raw body
    return { data: body, params: undefined, headers };
  }

  // JSON path: service mode always, or absolute URL with dtoIn
  if (command.dtoIn != null || command.url == null) {
    if (!headers["Content-Type"] && !headers["content-type"]) {
      headers["Content-Type"] = "application/json";
    }
    const dtoIn = resolvedDtoIn !== undefined ? resolvedDtoIn : {};
    return {
      data: method !== "GET" && method !== "DELETE" ? dtoIn : undefined,
      params: method === "GET" || method === "DELETE" ? dtoIn : undefined,
      headers,
    };
  }

  // Absolute URL with neither body nor dtoIn
  return { data: undefined, params: undefined, headers };
}

/**
 * Make an HTTP request for a command
 * @param {import('./types.js').Command} command - Command object
 * @param {import('./types.js').EnvironmentConfig} env - Environment configuration
 * @param {import('./types.js').State} state - Execution state
 * @param {Object} dtoIn - Resolved dtoIn object (used when command uses JSON dtoIn / service mode)
 * @returns {Promise<import('axios').AxiosResponse>} Axios response
 */
export async function makeRequest(command, env, state, dtoIn) {
  const logger = getLogger();

  const method = (command.method || "POST").toUpperCase();
  const url = resolveRequestUrl(command, env, state);
  const { data, params, headers: bodyHeaders } = resolveBodyAndHeaders(command, state, method, dtoIn);

  if (command.url != null) {
    logger.info(`Executing ${method} ${url}`);
  } else {
    logger.info(`Executing ${method} ${command.endpoint} on service ${command.service}`);
  }
  logger.debug(`Request URL: ${url}`);
  logger.debug(`Request body: ${describeBodyForLog(data)}`);

  // Resolve auth (auth: false and absolute-url default → no Bearer)
  const userKey = resolveAuth(command, env);
  const headers = { ...bodyHeaders };

  if (userKey) {
    const token = await getToken(userKey, env, state);
    headers.Authorization = `Bearer ${token}`;
    logger.debug(`Using authentication for user: ${userKey}`);
  }

  const config = {
    method,
    url,
    headers,
    timeout: env.config?.timeout || 30000,
    data,
    params,
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
