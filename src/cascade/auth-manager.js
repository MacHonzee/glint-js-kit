import axios from "axios";
import { getByPath } from "./helpers.js";
import { getLogger } from "./logger.js";

// Internal token cache (per execution)
const tokenCache = new Map(); // userKey -> { token, user }

/**
 * Clear the token cache (useful for testing or new execution)
 */
export function clearCache() {
  tokenCache.clear();
}

/**
 * Authenticate a user and get their token
 * @param {string} userKey - User key from authentication.users
 * @param {import('./types.js').EnvironmentConfig} env - Environment configuration
 * @param {import('./types.js').State} state - Execution state
 * @returns {Promise<{token: string, user: any}>} Token and user object
 */
export async function authenticate(userKey, env, state) {
  const logger = getLogger();

  // Return cached if exists
  if (tokenCache.has(userKey)) {
    logger.debug(`Using cached token for user: ${userKey}`);
    return tokenCache.get(userKey);
  }

  logger.info(`Authenticating user: ${userKey}`);

  const authConfig = env.authentication;
  const userConfig = authConfig.users[userKey];

  if (!userConfig) {
    throw new Error(`User '${userKey}' not found in authentication.users`);
  }

  // Service: user-specific or default from auth config
  const serviceName = userConfig.service || authConfig.service;
  const service = env.services[serviceName];

  if (!service) {
    throw new Error(`Service '${serviceName}' not found in environment configuration`);
  }

  const loginEndpoint = authConfig.loginEndpoint || "/user/login";

  // Get credentials: prefer direct declaration, fallback to env vars
  const username = userConfig.username || process.env[userConfig.usernameEnvKey];
  const password = userConfig.password || process.env[userConfig.passwordEnvKey];

  if (!username || !password) {
    const missing = [];
    if (!username) {
      missing.push(userConfig.usernameEnvKey ? `env var ${userConfig.usernameEnvKey}` : "username");
    }
    if (!password) {
      missing.push(userConfig.passwordEnvKey ? `env var ${userConfig.passwordEnvKey}` : "password");
    }
    throw new Error(`Credentials not found for user '${userKey}'. Missing: ${missing.join(", ")}`);
  }

  // Call login endpoint
  logger.debug(`Calling login endpoint: ${service.baseUri}${loginEndpoint}`);
  const response = await axios.post(`${service.baseUri}${loginEndpoint}`, { username, password });

  // Extract token and user from response using configured paths
  const tokenPath = authConfig.tokenPath || "token";
  const userPath = authConfig.userPath || "user";
  const token = getByPath(response.data, tokenPath);
  const user = getByPath(response.data, userPath);

  if (!token) {
    throw new Error(`Token not found in login response at path: ${tokenPath}`);
  }

  // Cache and store user in state
  const authResult = { token, user };
  tokenCache.set(userKey, authResult);
  state.users[userKey] = user;

  logger.info(`Successfully authenticated user: ${userKey}`);
  return authResult;
}

/**
 * Get token for a user (authenticates if needed)
 * @param {string} userKey - User key
 * @param {import('./types.js').EnvironmentConfig} env - Environment configuration
 * @param {import('./types.js').State} state - Execution state
 * @returns {Promise<string>} Bearer token
 */
export async function getToken(userKey, env, state) {
  const { token } = await authenticate(userKey, env, state);
  return token;
}
