/**
 * Initialize execution state
 * @returns {import('./types.js').State} Initial state object
 */
export function createState() {
  return {
    users: {},
    params: {},
    saved: {},
  };
}

/**
 * Resolve dtoIn value (handle functions that receive state)
 * @param {Object|Function} dtoIn - dtoIn value or function
 * @param {import('./types.js').State} state - Current execution state
 * @returns {Object} Resolved dtoIn object
 */
export function resolveDtoIn(dtoIn, state) {
  if (typeof dtoIn === "function") {
    return dtoIn(state);
  }
  return dtoIn || {};
}

/**
 * Save response data to state
 * @param {import('./types.js').State} state - Current execution state
 * @param {string} saveAs - Key to save under
 * @param {any} data - Data to save (typically response.data)
 */
export function saveToState(state, saveAs, data) {
  if (!saveAs) return;
  state.saved[saveAs] = data;
}

/**
 * Merge params into state for imported datasets
 * @param {import('./types.js').State} state - Current execution state
 * @param {Object} params - Parameters to merge
 * @returns {import('./types.js').State} New state with merged params
 */
export function mergeParams(state, params) {
  if (!params) return state;

  // Resolve any function params
  const resolvedParams = {};
  for (const [key, value] of Object.entries(params)) {
    if (typeof value === "function") {
      resolvedParams[key] = value(state);
    } else {
      resolvedParams[key] = value;
    }
  }

  return {
    ...state,
    params: {
      ...state.params,
      ...resolvedParams,
    },
  };
}
