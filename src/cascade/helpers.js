/**
 * Simple implementation to access nested object properties using dot notation
 * @param {any} obj - The object to traverse
 * @param {string} path - Dot-notation path (e.g., "user.profile.name")
 * @returns {any} The value at the path, or undefined if not found
 */
export function getByPath(obj, path) {
  if (!path) return obj;
  const keys = path.split(".");
  let result = obj;
  for (const key of keys) {
    if (result == null) return undefined;
    result = result[key];
  }
  return result;
}

/**
 * Get base URI for a service
 * @param {import('./types.js').EnvironmentConfig} env - Environment configuration
 * @param {string} serviceName - Service name
 * @returns {string} Base URI for the service
 */
export function getBaseUri(env, serviceName) {
  const service = env.services[serviceName];
  if (!service) {
    throw new Error(`Service '${serviceName}' not found in environment configuration`);
  }
  return service.baseUri;
}

/**
 * Get authenticated user from state
 * @param {import('./types.js').State} state - Execution state
 * @param {string} userKey - User key
 * @returns {any} User object or undefined
 */
export function getUser(state, userKey) {
  return state.users?.[userKey];
}

/**
 * Resolve auth user key based on priority: command > service > global
 * @param {import('./types.js').Command} command - Command object
 * @param {import('./types.js').EnvironmentConfig} env - Environment configuration
 * @returns {string|undefined} User key or undefined
 */
export function resolveAuth(command, env) {
  // Priority 1: Command-level auth
  if (command.auth) {
    return command.auth;
  }

  // Priority 2: Service-level defaultAuth
  if (command.service) {
    const service = env.services[command.service];
    if (service?.defaultAuth) {
      return service.defaultAuth;
    }
  }

  // Priority 3: Global defaultAuth
  return env.authentication?.defaultAuth;
}
