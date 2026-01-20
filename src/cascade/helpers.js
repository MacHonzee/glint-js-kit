/**
 * Access nested object properties using dot notation with array index support
 * Supports both dot notation (items.0.name) and bracket notation (items[0].name)
 * @param {any} obj - The object to traverse
 * @param {string} path - Path (e.g., "user.profile.name", "items[0].name", "data.items.0")
 * @returns {any} The value at the path, or undefined if not found
 */
export function getByPath(obj, path) {
  if (!path || path === "") return obj;

  // Split by dots, but preserve array indices like [0]
  const parts = [];
  let currentPart = "";
  let inBrackets = false;

  for (let i = 0; i < path.length; i++) {
    const char = path[i];

    if (char === "[") {
      if (currentPart) {
        parts.push(currentPart);
        currentPart = "";
      }
      inBrackets = true;
      currentPart += char;
    } else if (char === "]") {
      currentPart += char;
      parts.push(currentPart);
      currentPart = "";
      inBrackets = false;
    } else if (char === "." && !inBrackets) {
      if (currentPart) {
        parts.push(currentPart);
        currentPart = "";
      }
    } else {
      currentPart += char;
    }
  }

  if (currentPart) {
    parts.push(currentPart);
  }

  let current = obj;

  for (const part of parts) {
    if (current === null || current === undefined) {
      return undefined;
    }

    // Handle bracket array indexing like [0]
    if (part.startsWith("[") && part.endsWith("]")) {
      const index = parseInt(part.slice(1, -1), 10);
      if (isNaN(index) || !Array.isArray(current)) {
        return undefined;
      }
      current = current[index];
    } else {
      current = current[part];
    }
  }

  return current;
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
