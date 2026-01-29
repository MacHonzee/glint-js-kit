import { expect } from "chai";
import { getLogger } from "./logger.js";
import { getByPath } from "./helpers.js";

/**
 * Custom assertion error with detailed context
 */
export class CascadeAssertionError extends Error {
  constructor(message, details) {
    super(message);
    this.name = "CascadeAssertionError";
    this.path = details.path;
    this.matcher = details.matcher;
    this.expected = details.expected;
    this.received = details.received;
    this.response = details.response;
  }
}

/**
 * Map constructor to Chai type string
 * @param {Function} Constructor - Constructor function
 * @returns {string} Chai type string
 */
function getChaiType(Constructor) {
  const typeMap = {
    Number: "number",
    String: "string",
    Boolean: "boolean",
    Object: "object",
    Array: "array",
    Function: "function",
    Date: "date",
    RegExp: "regexp",
  };

  // Try to find by name
  for (const [name, type] of Object.entries(typeMap)) {
    if (Constructor === globalThis[name]) {
      return type;
    }
  }

  // Fallback: check instance
  if (Constructor === Number) return "number";
  if (Constructor === String) return "string";
  if (Constructor === Boolean) return "boolean";
  if (Constructor === Object) return "object";
  if (Constructor === Array) return "array";
  if (Constructor === Function) return "function";
  if (Constructor === Date) return "date";
  if (Constructor === RegExp) return "regexp";

  throw new Error(`Unsupported type for $any: ${Constructor.name || Constructor}`);
}

/**
 * Process nested asymmetric matchers in object for $objectContaining
 * @param {Object} obj - Object that may contain nested asymmetric matchers
 * @param {Object} received - Received object to check against
 * @returns {boolean} True if all nested matchers pass
 */
function processNestedObjectContaining(obj, received) {
  for (const [key, expected] of Object.entries(obj)) {
    const receivedValue = received[key];

    // Check if expected is an asymmetric matcher
    if (expected && typeof expected === "object" && !Array.isArray(expected)) {
      const keys = Object.keys(expected);
      if (keys.length === 1 && keys[0].startsWith("$")) {
        const matcherKey = keys[0];
        const matcherValue = expected[matcherKey];

        switch (matcherKey) {
          case "$any": {
            if (typeof matcherValue !== "function") {
              throw new Error(`$any expects a constructor function, got: ${typeof matcherValue}`);
            }
            const typeStr = getChaiType(matcherValue);
            try {
              expect(receivedValue).to.be.a(typeStr);
            } catch {
              return false;
            }
            break;
          }
          case "$anything": {
            // Anything passes as long as it exists
            if (receivedValue === undefined) {
              return false;
            }
            break;
          }
          default:
            // For other asymmetric matchers, use deep equality for now
            try {
              expect(receivedValue).to.deep.equal(matcherValue);
            } catch {
              return false;
            }
        }
      } else {
        // Regular value - check deep equality
        try {
          expect(receivedValue).to.deep.equal(expected);
        } catch {
          return false;
        }
      }
    } else {
      // Regular value - check deep equality
      try {
        expect(receivedValue).to.deep.equal(expected);
      } catch {
        return false;
      }
    }
  }
  return true;
}

/**
 * Execute a single assertion
 * @param {string} path - Dot-notation path to value
 * @param {any} expected - Expected value or matcher object
 * @param {any} received - Actual value from response
 * @param {Object} response - Full response object for context
 * @returns {Object} Result with success flag and details
 */
function executeAssertion(path, expected, received, response) {
  const logger = getLogger();
  let matcherName = "toEqual";
  let expectedValue = expected;
  let isNegated = false;

  // Handle direct values (deep equality)
  if (expected === null || typeof expected !== "object" || Array.isArray(expected)) {
    expectedValue = expected;
    matcherName = "toEqual";
  } else {
    // Check for negation
    if (expected.not) {
      isNegated = true;
      expected = expected.not;
    }

    // Check for asymmetric matchers ($ prefix)
    const keys = Object.keys(expected);
    if (keys.length === 1 && keys[0].startsWith("$")) {
      // Asymmetric matcher
      const key = keys[0];
      const value = expected[key];

      try {
        switch (key) {
          case "$any": {
            if (typeof value !== "function") {
              throw new Error(`$any expects a constructor function, got: ${typeof value}`);
            }
            const typeStr = getChaiType(value);
            const assertion = expect(received);
            if (isNegated) {
              assertion.to.not.be.a(typeStr);
            } else {
              assertion.to.be.a(typeStr);
            }
            logger.debug(`Assertion passed: ${path} (${key})`);
            return { success: true, path, matcher: key, expected, received };
          }

          case "$anything": {
            const assertion = expect(received);
            if (isNegated) {
              assertion.to.not.exist;
            } else {
              assertion.to.exist;
            }
            logger.debug(`Assertion passed: ${path} (${key})`);
            return { success: true, path, matcher: key, expected, received };
          }

          case "$arrayContaining": {
            const assertion = expect(received);
            if (isNegated) {
              assertion.to.not.include.deep.members(value);
            } else {
              assertion.to.include.deep.members(value);
            }
            logger.debug(`Assertion passed: ${path} (${key})`);
            return { success: true, path, matcher: key, expected, received };
          }

          case "$objectContaining": {
            // Check if value contains nested asymmetric matchers
            const hasNestedMatchers = Object.values(value).some(
              (v) => v && typeof v === "object" && !Array.isArray(v) && Object.keys(v).some((k) => k.startsWith("$")),
            );

            if (hasNestedMatchers) {
              // Process nested asymmetric matchers manually
              const passed = processNestedObjectContaining(value, received);
              if (isNegated ? passed : !passed) {
                throw new Error(`Object does not match expected structure`);
              }
            } else {
              // Use Chai's deep.include for regular objects
              const assertion = expect(received);
              if (isNegated) {
                assertion.to.not.deep.include(value);
              } else {
                assertion.to.deep.include(value);
              }
            }
            logger.debug(`Assertion passed: ${path} (${key})`);
            return { success: true, path, matcher: key, expected, received };
          }

          case "$stringContaining": {
            const assertion = expect(received);
            if (isNegated) {
              assertion.to.not.include(value);
            } else {
              assertion.to.include(value);
            }
            logger.debug(`Assertion passed: ${path} (${key})`);
            return { success: true, path, matcher: key, expected, received };
          }

          case "$stringMatching": {
            const pattern = typeof value === "string" ? new RegExp(value) : value;
            const assertion = expect(received);
            if (isNegated) {
              assertion.to.not.match(pattern);
            } else {
              assertion.to.match(pattern);
            }
            logger.debug(`Assertion passed: ${path} (${key})`);
            return { success: true, path, matcher: key, expected, received };
          }

          case "$closeTo": {
            const assertion = expect(received);
            if (Array.isArray(value)) {
              if (isNegated) {
                assertion.to.not.be.closeTo(value[0], value[1]);
              } else {
                assertion.to.be.closeTo(value[0], value[1]);
              }
            } else {
              // Default delta: 0.01 (2 decimal places)
              if (isNegated) {
                assertion.to.not.be.closeTo(value, 0.01);
              } else {
                assertion.to.be.closeTo(value, 0.01);
              }
            }
            logger.debug(`Assertion passed: ${path} (${key})`);
            return { success: true, path, matcher: key, expected, received };
          }

          default:
            throw new Error(`Unknown asymmetric matcher: ${key}`);
        }
      } catch (error) {
        if (error instanceof CascadeAssertionError) {
          throw error;
        }
        logger.error(`Assertion failed: ${path} (${key})\n\n${error.message}`);
        throw new CascadeAssertionError(`Assertion failed: ${path}\n\n${error.message}`, {
          path,
          matcher: key,
          expected: expected,
          received,
          response,
        });
      }
    }

    // Regular matcher object
    if (keys.length !== 1) {
      throw new Error(`Matcher object must have exactly one key, got: ${keys.join(", ")}`);
    }

    matcherName = keys[0];
    expectedValue = expected[matcherName];
  }

  // Execute the matcher
  try {
    const assertion = expect(received);
    const chaiAssertion = isNegated ? assertion.to.not : assertion.to;

    switch (matcherName) {
      case "toBe":
        chaiAssertion.equal(expectedValue);
        break;
      case "toEqual":
        chaiAssertion.deep.equal(expectedValue);
        break;
      case "toStrictEqual":
        chaiAssertion.deep.equal(expectedValue);
        break;
      case "toBeDefined":
        if (expectedValue !== true) {
          throw new Error("toBeDefined expects true as value");
        }
        chaiAssertion.not.be.undefined;
        break;
      case "toBeUndefined":
        if (expectedValue !== true) {
          throw new Error("toBeUndefined expects true as value");
        }
        chaiAssertion.be.undefined;
        break;
      case "toBeTruthy":
        if (expectedValue !== true) {
          throw new Error("toBeTruthy expects true as value");
        }
        chaiAssertion.be.ok;
        break;
      case "toBeFalsy":
        if (expectedValue !== true) {
          throw new Error("toBeFalsy expects true as value");
        }
        if (isNegated) {
          assertion.to.be.ok;
        } else {
          assertion.to.not.be.ok;
        }
        break;
      case "toBeNull":
        if (expectedValue !== true) {
          throw new Error("toBeNull expects true as value");
        }
        chaiAssertion.be.null;
        break;
      case "toBeNaN":
        if (expectedValue !== true) {
          throw new Error("toBeNaN expects true as value");
        }
        chaiAssertion.be.NaN;
        break;
      case "toBeGreaterThan":
        chaiAssertion.be.greaterThan(expectedValue);
        break;
      case "toBeGreaterThanOrEqual":
        chaiAssertion.be.at.least(expectedValue);
        break;
      case "toBeLessThan":
        chaiAssertion.be.lessThan(expectedValue);
        break;
      case "toBeLessThanOrEqual":
        chaiAssertion.be.at.most(expectedValue);
        break;
      case "toContain":
        chaiAssertion.include(expectedValue);
        break;
      case "toContainEqual":
        chaiAssertion.deep.include(expectedValue);
        break;
      case "toHaveLength":
        chaiAssertion.have.lengthOf(expectedValue);
        break;
      case "toMatch": {
        // Chai's match requires RegExp, convert string to RegExp
        const pattern = typeof expectedValue === "string" ? new RegExp(expectedValue) : expectedValue;
        chaiAssertion.match(pattern);
        break;
      }
      case "toMatchObject": {
        chaiAssertion.deep.include(expectedValue);
        break;
      }
      case "toHaveProperty": {
        if (Array.isArray(expectedValue)) {
          chaiAssertion.have.property(expectedValue[0], expectedValue[1]);
        } else {
          chaiAssertion.have.property(expectedValue);
        }
        break;
      }
      case "toBeCloseTo": {
        // Chai requires delta, default to 2 decimal places if not provided
        if (Array.isArray(expectedValue)) {
          chaiAssertion.be.closeTo(expectedValue[0], expectedValue[1]);
        } else {
          // Default delta: 0.01 (2 decimal places)
          chaiAssertion.be.closeTo(expectedValue, 0.01);
        }
        break;
      }
      case "toBeInstanceOf": {
        if (typeof expectedValue !== "function") {
          throw new Error(`toBeInstanceOf expects a constructor function, got: ${typeof expectedValue}`);
        }
        chaiAssertion.be.instanceOf(expectedValue);
        break;
      }
      default:
        throw new Error(`Unknown matcher: ${matcherName}`);
    }

    const prefix = isNegated ? "not " : "";
    logger.debug(`Assertion passed: ${path} (${prefix}${matcherName})`);
    return { success: true, path, matcher: matcherName, expected: expectedValue, received };
  } catch (error) {
    if (error instanceof CascadeAssertionError) {
      throw error;
    }

    const prefix = isNegated ? "not " : "";
    logger.error(`Assertion failed: ${path} (${prefix}${matcherName})\n\n${error.message}`);
    throw new CascadeAssertionError(`Assertion failed: ${path}\n\n${error.message}`, {
      path,
      matcher: matcherName,
      expected: expectedValue,
      received,
      response,
    });
  }
}

/**
 * Run assertions on a response
 * @param {Object} assertions - Assertions object with dot-notation paths as keys
 * @param {import('axios').AxiosResponse} response - Axios response object
 * @throws {CascadeAssertionError} If any assertion fails
 */
export function runAssertions(assertions, response) {
  if (!assertions || typeof assertions !== "object") {
    throw new Error("Assertions must be an object");
  }

  // Build response object for path resolution
  const responseObj = {
    status: response.status,
    data: response.data,
    headers: response.headers,
  };

  // Process each assertion
  for (const [path, expected] of Object.entries(assertions)) {
    const received = getByPath(responseObj, path);

    try {
      executeAssertion(path, expected, received, responseObj);
    } catch (error) {
      if (error instanceof CascadeAssertionError) {
        // Add response context to error message
        error.message = `${error.message}\n\nResponse context:\n${JSON.stringify(responseObj, null, 2)}`;
        throw error;
      }
      throw error;
    }
  }
}
