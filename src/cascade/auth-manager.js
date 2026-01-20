import axios from "axios";
import { getByPath } from "./helpers.js";
import { getLogger } from "./logger.js";

// Internal token cache (per execution)
const tokenCache = new Map(); // userKey -> { token, user }

// Dynamic users cache (registered during execution via registerAs)
const dynamicUsers = new Map(); // userKey -> { username, password, service? }

/**
 * Clear the token cache (useful for testing or new execution)
 */
export function clearCache() {
  tokenCache.clear();
}

/**
 * Clear the dynamic users cache (useful for testing or new execution)
 */
export function clearDynamicUsers() {
  dynamicUsers.clear();
}

/**
 * Register a dynamic user for authentication during cascade execution
 * @param {string} userKey - Key to identify this user for subsequent auth
 * @param {Object} credentials - User credentials
 * @param {string} credentials.username - Username for login
 * @param {string} credentials.password - Password for login
 * @param {string} [credentials.service] - Optional service override for this user
 */
export function registerDynamicUser(userKey, credentials) {
  const logger = getLogger();

  if (!userKey) {
    throw new Error("userKey is required for registerDynamicUser");
  }

  if (!credentials.username || !credentials.password) {
    throw new Error(`Credentials (username and password) are required for dynamic user '${userKey}'`);
  }

  dynamicUsers.set(userKey, {
    username: credentials.username,
    password: credentials.password,
    service: credentials.service,
  });

  logger.info(`Registered dynamic user: ${userKey}`);
}

/**
 * Check if a user is a dynamic user
 * @param {string} userKey - User key to check
 * @returns {boolean} True if user is registered as dynamic
 */
export function isDynamicUser(userKey) {
  return dynamicUsers.has(userKey);
}

/**
 * Authenticate a user and get their token
 * @param {string} userKey - User key from authentication.users or dynamicUsers
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
  const userConfig = authConfig.users?.[userKey];
  const dynamicUserConfig = dynamicUsers.get(userKey);

  // Check both env config users and dynamic users
  if (!userConfig && !dynamicUserConfig) {
    throw new Error(`User '${userKey}' not found in authentication.users or dynamic users`);
  }

  let username, password, serviceName;

  if (userConfig) {
    // Static user from env config (highest priority)
    serviceName = userConfig.service || authConfig.service;

    // Get credentials: prefer direct declaration, fallback to env vars
    username = userConfig.username || process.env[userConfig.usernameEnvKey];
    password = userConfig.password || process.env[userConfig.passwordEnvKey];

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
  } else {
    // Dynamic user - credentials come from registerDynamicUser call
    username = dynamicUserConfig.username;
    password = dynamicUserConfig.password;
    serviceName = dynamicUserConfig.service || authConfig.service;
    logger.debug(`Using dynamic user credentials for: ${userKey}`);
  }

  const service = env.services[serviceName];

  if (!service) {
    throw new Error(`Service '${serviceName}' not found in environment configuration`);
  }

  const loginEndpoint = authConfig.loginEndpoint || "/user/login";

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
