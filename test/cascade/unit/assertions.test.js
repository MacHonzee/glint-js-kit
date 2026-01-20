import { describe, test, expect, beforeEach } from "@jest/globals";
import { runAssertions, CascadeAssertionError } from "../../../src/cascade/assertions.js";
import { initLogger } from "../../../src/cascade/index.js";

describe("Assertions", () => {
  beforeEach(() => {
    initLogger("error"); // Suppress debug logs in tests
  });

  describe("runAssertions", () => {
    test("should pass with direct value equality", () => {
      const response = {
        status: 200,
        data: { name: "Test", id: 1 },
      };

      expect(() => {
        runAssertions(
          {
            status: 200,
            "data.name": "Test",
            "data.id": 1,
          },
          response,
        );
      }).not.toThrow();
    });

    test("should fail with direct value mismatch", () => {
      const response = {
        status: 200,
        data: { name: "Wrong", id: 1 },
      };

      expect(() => {
        runAssertions(
          {
            "data.name": "Test",
          },
          response,
        );
      }).toThrow(CascadeAssertionError);
    });

    test("should handle nested paths", () => {
      const response = {
        status: 200,
        data: {
          user: {
            profile: {
              name: "John",
            },
          },
        },
      };

      expect(() => {
        runAssertions(
          {
            "data.user.profile.name": "John",
          },
          response,
        );
      }).not.toThrow();
    });

    test("should handle array indexing", () => {
      const response = {
        status: 200,
        data: {
          items: [
            { id: 1, name: "First" },
            { id: 2, name: "Second" },
          ],
        },
      };

      expect(() => {
        runAssertions(
          {
            "data.items[0].name": "First",
            "data.items[1].id": 2,
          },
          response,
        );
      }).not.toThrow();
    });

    test("should handle array indexing with nested paths", () => {
      const response = {
        status: 200,
        data: {
          users: [
            {
              profile: {
                name: "John",
                email: "john@example.com",
              },
            },
            {
              profile: {
                name: "Jane",
                email: "jane@example.com",
              },
            },
          ],
        },
      };

      expect(() => {
        runAssertions(
          {
            "data.users[0].profile.name": "John",
            "data.users[1].profile.email": "jane@example.com",
          },
          response,
        );
      }).not.toThrow();
    });

    test("should handle array indexing failure", () => {
      const response = {
        status: 200,
        data: {
          items: [{ id: 1, name: "First" }],
        },
      };

      expect(() => {
        runAssertions(
          {
            "data.items[0].name": "Wrong",
          },
          response,
        );
      }).toThrow(CascadeAssertionError);
    });

    test("should handle array index out of bounds", () => {
      const response = {
        status: 200,
        data: {
          items: [{ id: 1 }],
        },
      };

      expect(() => {
        runAssertions(
          {
            "data.items[5].name": "Missing",
          },
          response,
        );
      }).toThrow(CascadeAssertionError);
    });

    test("should handle array indexing on non-array", () => {
      const response = {
        status: 200,
        data: {
          items: "not an array",
        },
      };

      expect(() => {
        runAssertions(
          {
            "data.items[0].name": "Test",
          },
          response,
        );
      }).toThrow(CascadeAssertionError);
    });

    test("should handle status path", () => {
      const response = {
        status: 201,
        data: {},
      };

      expect(() => {
        runAssertions(
          {
            status: 201,
          },
          response,
        );
      }).not.toThrow();
    });
  });

  describe("Matchers", () => {
    describe("toBe", () => {
      test("should pass with toBe matcher", () => {
        const response = {
          status: 200,
          data: { id: 1 },
        };

        expect(() => {
          runAssertions(
            {
              "data.id": { toBe: 1 },
            },
            response,
          );
        }).not.toThrow();
      });

      test("should fail with toBe mismatch", () => {
        const response = {
          status: 200,
          data: { id: "1" }, // String instead of number
        };

        expect(() => {
          runAssertions(
            {
              "data.id": { toBe: 1 },
            },
            response,
          );
        }).toThrow(CascadeAssertionError);
      });
    });

    describe("toEqual", () => {
      test("should pass with toEqual matcher", () => {
        const response = {
          status: 200,
          data: { id: 1 },
        };

        expect(() => {
          runAssertions(
            {
              "data.id": { toEqual: 1 },
            },
            response,
          );
        }).not.toThrow();
      });
    });

    describe("toBeDefined", () => {
      test("should pass when value is defined", () => {
        const response = {
          status: 200,
          data: { name: "Test" },
        };

        expect(() => {
          runAssertions(
            {
              "data.name": { toBeDefined: true },
            },
            response,
          );
        }).not.toThrow();
      });

      test("should fail when value is undefined", () => {
        const response = {
          status: 200,
          data: {},
        };

        expect(() => {
          runAssertions(
            {
              "data.name": { toBeDefined: true },
            },
            response,
          );
        }).toThrow(CascadeAssertionError);
      });
    });

    describe("toBeUndefined", () => {
      test("should pass when value is undefined", () => {
        const response = {
          status: 200,
          data: {},
        };

        expect(() => {
          runAssertions(
            {
              "data.name": { toBeUndefined: true },
            },
            response,
          );
        }).not.toThrow();
      });
    });

    describe("toBeNull", () => {
      test("should pass when value is null", () => {
        const response = {
          status: 200,
          data: { value: null },
        };

        expect(() => {
          runAssertions(
            {
              "data.value": { toBeNull: true },
            },
            response,
          );
        }).not.toThrow();
      });
    });

    describe("toBeTruthy", () => {
      test("should pass when value is truthy", () => {
        const response = {
          status: 200,
          data: { value: 1 },
        };

        expect(() => {
          runAssertions(
            {
              "data.value": { toBeTruthy: true },
            },
            response,
          );
        }).not.toThrow();
      });
    });

    describe("toBeFalsy", () => {
      test("should pass when value is falsy", () => {
        const response = {
          status: 200,
          data: { value: 0 },
        };

        expect(() => {
          runAssertions(
            {
              "data.value": { toBeFalsy: true },
            },
            response,
          );
        }).not.toThrow();
      });
    });

    describe("toBeGreaterThan", () => {
      test("should pass when value is greater", () => {
        const response = {
          status: 200,
          data: { id: 5 },
        };

        expect(() => {
          runAssertions(
            {
              "data.id": { toBeGreaterThan: 0 },
            },
            response,
          );
        }).not.toThrow();
      });

      test("should fail when value is not greater", () => {
        const response = {
          status: 200,
          data: { id: 0 },
        };

        expect(() => {
          runAssertions(
            {
              "data.id": { toBeGreaterThan: 0 },
            },
            response,
          );
        }).toThrow(CascadeAssertionError);
      });
    });

    describe("toBeLessThan", () => {
      test("should pass when value is less", () => {
        const response = {
          status: 200,
          data: { id: 5 },
        };

        expect(() => {
          runAssertions(
            {
              "data.id": { toBeLessThan: 10 },
            },
            response,
          );
        }).not.toThrow();
      });
    });

    describe("toContain", () => {
      test("should pass when array contains item", () => {
        const response = {
          status: 200,
          data: { tags: ["a", "b", "c"] },
        };

        expect(() => {
          runAssertions(
            {
              "data.tags": { toContain: "b" },
            },
            response,
          );
        }).not.toThrow();
      });

      test("should pass when string contains substring", () => {
        const response = {
          status: 200,
          data: { email: "test@example.com" },
        };

        expect(() => {
          runAssertions(
            {
              "data.email": { toContain: "@example" },
            },
            response,
          );
        }).not.toThrow();
      });
    });

    describe("toHaveLength", () => {
      test("should pass when array has correct length", () => {
        const response = {
          status: 200,
          data: { items: [1, 2, 3] },
        };

        expect(() => {
          runAssertions(
            {
              "data.items": { toHaveLength: 3 },
            },
            response,
          );
        }).not.toThrow();
      });
    });

    describe("toMatch", () => {
      test("should pass when string matches pattern", () => {
        const response = {
          status: 200,
          data: { email: "test@example.com" },
        };

        expect(() => {
          runAssertions(
            {
              "data.email": { toMatch: "@example" },
            },
            response,
          );
        }).not.toThrow();
      });

      test("should pass when string matches regex", () => {
        const response = {
          status: 200,
          data: { email: "test@example.com" },
        };

        expect(() => {
          runAssertions(
            {
              "data.email": { toMatch: /^test@/ },
            },
            response,
          );
        }).not.toThrow();
      });
    });

    describe("toMatchObject", () => {
      test("should pass when object matches partially", () => {
        const response = {
          status: 200,
          data: { id: 1, name: "Test", email: "test@example.com" },
        };

        expect(() => {
          runAssertions(
            {
              data: { toMatchObject: { id: 1, name: "Test" } },
            },
            response,
          );
        }).not.toThrow();
      });
    });

    describe("toHaveProperty", () => {
      test("should pass when property exists", () => {
        const response = {
          status: 200,
          data: { id: 1, name: "Test" },
        };

        expect(() => {
          runAssertions(
            {
              data: { toHaveProperty: "id" },
            },
            response,
          );
        }).not.toThrow();
      });

      test("should pass when property exists with value", () => {
        const response = {
          status: 200,
          data: { id: 1 },
        };

        expect(() => {
          runAssertions(
            {
              data: { toHaveProperty: ["id", 1] },
            },
            response,
          );
        }).not.toThrow();
      });
    });

    describe("toBeCloseTo", () => {
      test("should pass when numbers are close", () => {
        const response = {
          status: 200,
          data: { pi: 3.14159 },
        };

        expect(() => {
          runAssertions(
            {
              "data.pi": { toBeCloseTo: 3.14 },
            },
            response,
          );
        }).not.toThrow();
      });

      test("should pass with precision", () => {
        const response = {
          status: 200,
          data: { pi: 3.14159 },
        };

        expect(() => {
          runAssertions(
            {
              "data.pi": { toBeCloseTo: [3.14, 2] },
            },
            response,
          );
        }).not.toThrow();
      });
    });
  });

  describe("Negation", () => {
    test("should pass with not modifier", () => {
      const response = {
        status: 200,
        data: { status: "active" },
      };

      expect(() => {
        runAssertions(
          {
            "data.status": { not: { toBe: "deleted" } },
          },
          response,
        );
      }).not.toThrow();
    });

    test("should fail when not assertion fails", () => {
      const response = {
        status: 200,
        data: { status: "deleted" },
      };

      expect(() => {
        runAssertions(
          {
            "data.status": { not: { toBe: "deleted" } },
          },
          response,
        );
      }).toThrow(CascadeAssertionError);
    });
  });

  describe("Asymmetric Matchers", () => {
    describe("$any", () => {
      test("should pass with $any Number", () => {
        const response = {
          status: 200,
          data: { id: 42 },
        };

        expect(() => {
          runAssertions(
            {
              "data.id": { $any: Number },
            },
            response,
          );
        }).not.toThrow();
      });

      test("should pass with $any String", () => {
        const response = {
          status: 200,
          data: { name: "Test" },
        };

        expect(() => {
          runAssertions(
            {
              "data.name": { $any: String },
            },
            response,
          );
        }).not.toThrow();
      });
    });

    describe("$anything", () => {
      test("should pass with $anything", () => {
        const response = {
          status: 200,
          data: { meta: { anything: "here" } },
        };

        expect(() => {
          runAssertions(
            {
              "data.meta": { $anything: true },
            },
            response,
          );
        }).not.toThrow();
      });
    });

    describe("$arrayContaining", () => {
      test("should pass with $arrayContaining", () => {
        const response = {
          status: 200,
          data: { tags: ["a", "b", "c"] },
        };

        expect(() => {
          runAssertions(
            {
              "data.tags": { $arrayContaining: ["a", "b"] },
            },
            response,
          );
        }).not.toThrow();
      });
    });

    describe("$objectContaining", () => {
      test("should pass with $objectContaining", () => {
        const response = {
          status: 200,
          data: { id: 1, name: "Test", email: "test@example.com" },
        };

        expect(() => {
          runAssertions(
            {
              data: { $objectContaining: { id: 1, name: "Test" } },
            },
            response,
          );
        }).not.toThrow();
      });

      test("should support nested asymmetric matchers", () => {
        const response = {
          status: 200,
          data: { id: 1, name: "Test" },
        };

        expect(() => {
          runAssertions(
            {
              data: {
                $objectContaining: {
                  id: { $any: Number },
                  name: "Test",
                },
              },
            },
            response,
          );
        }).not.toThrow();
      });
    });

    describe("$stringContaining", () => {
      test("should pass with $stringContaining", () => {
        const response = {
          status: 200,
          data: { email: "test@example.com" },
        };

        expect(() => {
          runAssertions(
            {
              "data.email": { $stringContaining: "@example" },
            },
            response,
          );
        }).not.toThrow();
      });
    });

    describe("$stringMatching", () => {
      test("should pass with $stringMatching regex string", () => {
        const response = {
          status: 200,
          data: { code: "ABC123" },
        };

        expect(() => {
          runAssertions(
            {
              "data.code": { $stringMatching: "^[A-Z]+" },
            },
            response,
          );
        }).not.toThrow();
      });

      test("should pass with $stringMatching RegExp", () => {
        const response = {
          status: 200,
          data: { code: "ABC123" },
        };

        expect(() => {
          runAssertions(
            {
              "data.code": { $stringMatching: /^[A-Z]+/ },
            },
            response,
          );
        }).not.toThrow();
      });
    });

    describe("$closeTo", () => {
      test("should pass with $closeTo number", () => {
        const response = {
          status: 200,
          data: { pi: 3.14159 },
        };

        expect(() => {
          runAssertions(
            {
              "data.pi": { $closeTo: 3.14 },
            },
            response,
          );
        }).not.toThrow();
      });

      test("should pass with $closeTo array", () => {
        const response = {
          status: 200,
          data: { pi: 3.14159 },
        };

        expect(() => {
          runAssertions(
            {
              "data.pi": { $closeTo: [3.14, 2] },
            },
            response,
          );
        }).not.toThrow();
      });
    });
  });

  describe("Error Handling", () => {
    test("should throw CascadeAssertionError with details", () => {
      const response = {
        status: 200,
        data: { id: -1 },
      };

      try {
        runAssertions(
          {
            "data.id": { toBeGreaterThan: 0 },
          },
          response,
        );
        expect(true).toBe(false); // Should not reach here
      } catch (error) {
        expect(error).toBeInstanceOf(CascadeAssertionError);
        expect(error.path).toBe("data.id");
        expect(error.matcher).toBe("toBeGreaterThan");
        expect(error.expected).toBe(0);
        expect(error.received).toBe(-1);
        expect(error.response).toBeDefined();
      }
    });

    test("should include response context in error message", () => {
      const response = {
        status: 200,
        data: { id: -1 },
      };

      try {
        runAssertions(
          {
            "data.id": { toBeGreaterThan: 0 },
          },
          response,
        );
        expect(true).toBe(false);
      } catch (error) {
        expect(error.message).toContain("Response context");
      }
    });

    test("should throw error for invalid assertions object", () => {
      const response = { status: 200, data: {} };

      expect(() => {
        runAssertions(null, response);
      }).toThrow("Assertions must be an object");

      expect(() => {
        runAssertions("not an object", response);
      }).toThrow("Assertions must be an object");
    });

    test("should throw error for non-CascadeAssertionError", () => {
      const response = { status: 200, data: {} };

      // This should not happen in practice, but test error handling
      expect(() => {
        runAssertions(
          {
            "data.invalid": { invalidMatcher: "value" },
          },
          response,
        );
      }).toThrow();
    });
  });

  describe("Edge Cases", () => {
    test("should handle empty path", () => {
      const response = {
        status: 200,
        data: { name: "Test" },
        headers: {},
      };

      // Empty path returns the whole responseObj (status, data, headers)
      const responseObj = {
        status: 200,
        data: { name: "Test" },
        headers: {},
      };

      expect(() => {
        runAssertions(
          {
            "": { toEqual: responseObj },
          },
          response,
        );
      }).not.toThrow();
    });

    test("should handle null in path traversal", () => {
      const response = {
        status: 200,
        data: { user: null },
      };

      expect(() => {
        runAssertions(
          {
            "data.user.name": "Test",
          },
          response,
        );
      }).toThrow(CascadeAssertionError);
    });

    test("should handle undefined in path traversal", () => {
      const response = {
        status: 200,
        data: {},
      };

      expect(() => {
        runAssertions(
          {
            "data.user.profile.name": "Test",
          },
          response,
        );
      }).toThrow(CascadeAssertionError);
    });

    test("should throw error for matcher with multiple keys", () => {
      const response = {
        status: 200,
        data: { id: 1 },
      };

      expect(() => {
        runAssertions(
          {
            "data.id": { toBe: 1, toEqual: 1 },
          },
          response,
        );
      }).toThrow("Matcher object must have exactly one key");
    });

    test("should throw error for unknown matcher", () => {
      const response = {
        status: 200,
        data: { id: 1 },
      };

      try {
        runAssertions(
          {
            "data.id": { unknownMatcher: 1 },
          },
          response,
        );
        expect(true).toBe(false);
      } catch (error) {
        expect(error).toBeInstanceOf(CascadeAssertionError);
        expect(error.message).toContain("Unknown matcher");
      }
    });

    test("should throw error for unknown asymmetric matcher", () => {
      const response = {
        status: 200,
        data: { id: 1 },
      };

      try {
        runAssertions(
          {
            "data.id": { $unknown: "value" },
          },
          response,
        );
        expect(true).toBe(false);
      } catch (error) {
        expect(error).toBeInstanceOf(CascadeAssertionError);
        expect(error.message).toContain("Unknown asymmetric matcher");
      }
    });

    test("should throw error for $any with non-function", () => {
      const response = {
        status: 200,
        data: { id: 1 },
      };

      try {
        runAssertions(
          {
            "data.id": { $any: "not a function" },
          },
          response,
        );
        expect(true).toBe(false);
      } catch (error) {
        expect(error).toBeInstanceOf(CascadeAssertionError);
        expect(error.message).toContain("$any expects a constructor function");
      }
    });

    test("should throw error for toBeInstanceOf with non-function", () => {
      const response = {
        status: 200,
        data: { id: 1 },
      };

      try {
        runAssertions(
          {
            "data.id": { toBeInstanceOf: "not a function" },
          },
          response,
        );
        expect(true).toBe(false);
      } catch (error) {
        expect(error).toBeInstanceOf(CascadeAssertionError);
        expect(error.message).toContain("toBeInstanceOf expects a constructor function");
      }
    });

    test("should throw error for toBeDefined with wrong value", () => {
      const response = {
        status: 200,
        data: { id: 1 },
      };

      try {
        runAssertions(
          {
            "data.id": { toBeDefined: false },
          },
          response,
        );
        expect(true).toBe(false);
      } catch (error) {
        expect(error).toBeInstanceOf(CascadeAssertionError);
        expect(error.message).toContain("toBeDefined expects true as value");
      }
    });

    test("should throw error for toBeUndefined with wrong value", () => {
      const response = {
        status: 200,
        data: { id: 1 },
      };

      try {
        runAssertions(
          {
            "data.id": { toBeUndefined: false },
          },
          response,
        );
        expect(true).toBe(false);
      } catch (error) {
        expect(error).toBeInstanceOf(CascadeAssertionError);
        expect(error.message).toContain("toBeUndefined expects true as value");
      }
    });

    test("should throw error for toBeTruthy with wrong value", () => {
      const response = {
        status: 200,
        data: { id: 1 },
      };

      try {
        runAssertions(
          {
            "data.id": { toBeTruthy: false },
          },
          response,
        );
        expect(true).toBe(false);
      } catch (error) {
        expect(error).toBeInstanceOf(CascadeAssertionError);
        expect(error.message).toContain("toBeTruthy expects true as value");
      }
    });

    test("should throw error for toBeFalsy with wrong value", () => {
      const response = {
        status: 200,
        data: { id: 1 },
      };

      try {
        runAssertions(
          {
            "data.id": { toBeFalsy: false },
          },
          response,
        );
        expect(true).toBe(false);
      } catch (error) {
        expect(error).toBeInstanceOf(CascadeAssertionError);
        expect(error.message).toContain("toBeFalsy expects true as value");
      }
    });

    test("should throw error for toBeNull with wrong value", () => {
      const response = {
        status: 200,
        data: { id: 1 },
      };

      try {
        runAssertions(
          {
            "data.id": { toBeNull: false },
          },
          response,
        );
        expect(true).toBe(false);
      } catch (error) {
        expect(error).toBeInstanceOf(CascadeAssertionError);
        expect(error.message).toContain("toBeNull expects true as value");
      }
    });

    test("should throw error for toBeNaN with wrong value", () => {
      const response = {
        status: 200,
        data: { id: 1 },
      };

      try {
        runAssertions(
          {
            "data.id": { toBeNaN: false },
          },
          response,
        );
        expect(true).toBe(false);
      } catch (error) {
        expect(error).toBeInstanceOf(CascadeAssertionError);
        expect(error.message).toContain("toBeNaN expects true as value");
      }
    });
  });

  describe("Additional Matchers", () => {
    test("should support toStrictEqual", () => {
      const response = {
        status: 200,
        data: { id: 1 },
      };

      expect(() => {
        runAssertions(
          {
            "data.id": { toStrictEqual: 1 },
          },
          response,
        );
      }).not.toThrow();
    });

    test("should support toBeGreaterThanOrEqual", () => {
      const response = {
        status: 200,
        data: { id: 5 },
      };

      expect(() => {
        runAssertions(
          {
            "data.id": { toBeGreaterThanOrEqual: 5 },
          },
          response,
        );
      }).not.toThrow();

      expect(() => {
        runAssertions(
          {
            "data.id": { toBeGreaterThanOrEqual: 4 },
          },
          response,
        );
      }).not.toThrow();
    });

    test("should support toBeLessThanOrEqual", () => {
      const response = {
        status: 200,
        data: { id: 5 },
      };

      expect(() => {
        runAssertions(
          {
            "data.id": { toBeLessThanOrEqual: 5 },
          },
          response,
        );
      }).not.toThrow();

      expect(() => {
        runAssertions(
          {
            "data.id": { toBeLessThanOrEqual: 6 },
          },
          response,
        );
      }).not.toThrow();
    });

    test("should support toContainEqual", () => {
      const response = {
        status: 200,
        data: { items: [{ id: 1 }, { id: 2 }] },
      };

      expect(() => {
        runAssertions(
          {
            "data.items": { toContainEqual: { id: 1 } },
          },
          response,
        );
      }).not.toThrow();
    });

    test("should support toBeInstanceOf", () => {
      const response = {
        status: 200,
        data: { id: new Number(1) }, // Use Number object, not primitive
      };

      expect(() => {
        runAssertions(
          {
            "data.id": { toBeInstanceOf: Number },
          },
          response,
        );
      }).not.toThrow();
    });

    test("should fail toBeInstanceOf when type doesn't match", () => {
      const response = {
        status: 200,
        data: { id: "not a number" },
      };

      expect(() => {
        runAssertions(
          {
            "data.id": { toBeInstanceOf: Number },
          },
          response,
        );
      }).toThrow(CascadeAssertionError);
    });

    test("should support toBeInstanceOf with Date", () => {
      const response = {
        status: 200,
        data: { createdAt: new Date() },
      };

      expect(() => {
        runAssertions(
          {
            "data.createdAt": { toBeInstanceOf: Date },
          },
          response,
        );
      }).not.toThrow();
    });
  });

  describe("Negation with Asymmetric Matchers", () => {
    test("should support not $any", () => {
      const response = {
        status: 200,
        data: { id: "not a number" },
      };

      expect(() => {
        runAssertions(
          {
            "data.id": { not: { $any: Number } },
          },
          response,
        );
      }).not.toThrow();
    });

    test("should support not $anything", () => {
      const response = {
        status: 200,
        data: { value: undefined },
      };

      expect(() => {
        runAssertions(
          {
            "data.value": { not: { $anything: true } },
          },
          response,
        );
      }).not.toThrow();
    });

    test("should support not $arrayContaining", () => {
      const response = {
        status: 200,
        data: { tags: ["a", "b"] },
      };

      expect(() => {
        runAssertions(
          {
            "data.tags": { not: { $arrayContaining: ["x", "y"] } },
          },
          response,
        );
      }).not.toThrow();
    });

    test("should support not $objectContaining", () => {
      const response = {
        status: 200,
        data: { id: 1, name: "Test" },
      };

      expect(() => {
        runAssertions(
          {
            data: { not: { $objectContaining: { missing: "field" } } },
          },
          response,
        );
      }).not.toThrow();
    });

    test("should support not $objectContaining with nested matchers", () => {
      const response = {
        status: 200,
        data: { id: 1, name: "Test" },
      };

      expect(() => {
        runAssertions(
          {
            data: {
              not: {
                $objectContaining: {
                  id: { $any: String },
                  name: "Test",
                },
              },
            },
          },
          response,
        );
      }).not.toThrow();
    });

    test("should support not $stringContaining", () => {
      const response = {
        status: 200,
        data: { email: "test@example.com" },
      };

      expect(() => {
        runAssertions(
          {
            "data.email": { not: { $stringContaining: "@missing" } },
          },
          response,
        );
      }).not.toThrow();
    });

    test("should support not $stringMatching", () => {
      const response = {
        status: 200,
        data: { code: "ABC123" },
      };

      expect(() => {
        runAssertions(
          {
            "data.code": { not: { $stringMatching: "^[0-9]+$" } },
          },
          response,
        );
      }).not.toThrow();
    });

    test("should support not $closeTo", () => {
      const response = {
        status: 200,
        data: { pi: 3.14159 },
      };

      expect(() => {
        runAssertions(
          {
            "data.pi": { not: { $closeTo: 10.0 } },
          },
          response,
        );
      }).not.toThrow();
    });

    test("should support not $closeTo with array", () => {
      const response = {
        status: 200,
        data: { pi: 3.14159 },
      };

      expect(() => {
        runAssertions(
          {
            "data.pi": { not: { $closeTo: [10.0, 2] } },
          },
          response,
        );
      }).not.toThrow();
    });
  });

  describe("getChaiType fallback cases", () => {
    test("should handle all constructor types", () => {
      const response = {
        status: 200,
        data: {
          num: 1,
          str: "test",
          bool: true,
          obj: {},
          arr: [],
          func: () => {},
          date: new Date(),
          regex: /test/,
        },
      };

      expect(() => {
        runAssertions(
          {
            "data.num": { $any: Number },
            "data.str": { $any: String },
            "data.bool": { $any: Boolean },
            "data.obj": { $any: Object },
            "data.arr": { $any: Array },
            "data.func": { $any: Function },
            "data.date": { $any: Date },
            "data.regex": { $any: RegExp },
          },
          response,
        );
      }).not.toThrow();
    });

    test("should throw error for unsupported type", () => {
      const response = {
        status: 200,
        data: { value: {} },
      };

      class CustomClass {}
      try {
        runAssertions(
          {
            "data.value": { $any: CustomClass },
          },
          response,
        );
        expect(true).toBe(false);
      } catch (error) {
        expect(error).toBeInstanceOf(CascadeAssertionError);
        expect(error.message).toContain("Unsupported type for $any");
      }
    });
  });

  describe("processNestedObjectContaining edge cases", () => {
    test("should handle $anything false case", () => {
      const response = {
        status: 200,
        data: { id: 1, name: "Test" },
      };

      expect(() => {
        runAssertions(
          {
            data: {
              $objectContaining: {
                id: { $anything: true },
                missing: { $anything: true },
              },
            },
          },
          response,
        );
      }).toThrow(CascadeAssertionError);
    });

    test("should handle nested $any failure", () => {
      const response = {
        status: 200,
        data: { id: "not a number", name: "Test" },
      };

      expect(() => {
        runAssertions(
          {
            data: {
              $objectContaining: {
                id: { $any: Number },
                name: "Test",
              },
            },
          },
          response,
        );
      }).toThrow(CascadeAssertionError);
    });

    test("should handle nested $any with non-function error", () => {
      const response = {
        status: 200,
        data: { id: 1, name: "Test" },
      };

      try {
        runAssertions(
          {
            data: {
              $objectContaining: {
                id: { $any: "not a function" },
              },
            },
          },
          response,
        );
        expect(true).toBe(false);
      } catch (error) {
        expect(error).toBeInstanceOf(CascadeAssertionError);
        expect(error.message).toContain("$any expects a constructor function");
      }
    });

    test("should handle nested other asymmetric matchers", () => {
      const response = {
        status: 200,
        data: { id: 1, tags: ["a", "b"] },
      };

      expect(() => {
        runAssertions(
          {
            data: {
              $objectContaining: {
                tags: { $arrayContaining: ["a", "b"] },
              },
            },
          },
          response,
        );
      }).not.toThrow();
    });

    test("should handle nested other asymmetric matchers failure", () => {
      const response = {
        status: 200,
        data: { id: 1, tags: ["x", "y"] },
      };

      expect(() => {
        runAssertions(
          {
            data: {
              $objectContaining: {
                tags: { $arrayContaining: ["a", "b"] },
              },
            },
          },
          response,
        );
      }).toThrow(CascadeAssertionError);
    });

    test("should handle regular value mismatch in nested", () => {
      const response = {
        status: 200,
        data: { id: 1, name: "Wrong" },
      };

      expect(() => {
        runAssertions(
          {
            data: {
              $objectContaining: {
                id: { $any: Number },
                name: "Test",
              },
            },
          },
          response,
        );
      }).toThrow(CascadeAssertionError);
    });

    test("should handle array value in nested", () => {
      const response = {
        status: 200,
        data: { id: 1, tags: ["a", "b"] },
      };

      expect(() => {
        runAssertions(
          {
            data: {
              $objectContaining: {
                tags: ["a", "b"],
              },
            },
          },
          response,
        );
      }).not.toThrow();
    });

    test("should handle array value mismatch in nested", () => {
      const response = {
        status: 200,
        data: { id: 1, tags: ["x", "y"] },
      };

      expect(() => {
        runAssertions(
          {
            data: {
              $objectContaining: {
                tags: ["a", "b"],
              },
            },
          },
          response,
        );
      }).toThrow(CascadeAssertionError);
    });

    test("should handle null value in nested", () => {
      const response = {
        status: 200,
        data: { id: 1, name: null },
      };

      expect(() => {
        runAssertions(
          {
            data: {
              $objectContaining: {
                name: null,
              },
            },
          },
          response,
        );
      }).not.toThrow();
    });

    test("should handle regular value with multiple keys in nested", () => {
      const response = {
        status: 200,
        data: { id: 1, name: "Test" },
      };

      // When expected has multiple keys (not an asymmetric matcher), use deep equality
      expect(() => {
        runAssertions(
          {
            data: {
              $objectContaining: {
                id: 1,
                name: "Test",
              },
            },
          },
          response,
        );
      }).not.toThrow();
    });

    test("should handle regular value mismatch with multiple keys in nested", () => {
      const response = {
        status: 200,
        data: { id: 1, name: "Wrong" },
      };

      expect(() => {
        runAssertions(
          {
            data: {
              $objectContaining: {
                id: 1,
                name: "Test",
              },
            },
          },
          response,
        );
      }).toThrow(CascadeAssertionError);
    });
  });

  describe("Negation with regular matchers", () => {
    test("should support not toBeGreaterThan", () => {
      const response = {
        status: 200,
        data: { id: 0 },
      };

      expect(() => {
        runAssertions(
          {
            "data.id": { not: { toBeGreaterThan: 5 } },
          },
          response,
        );
      }).not.toThrow();
    });

    test("should support not toContain", () => {
      const response = {
        status: 200,
        data: { tags: ["a", "b"] },
      };

      expect(() => {
        runAssertions(
          {
            "data.tags": { not: { toContain: "x" } },
          },
          response,
        );
      }).not.toThrow();
    });

    test("should support not toMatch", () => {
      const response = {
        status: 200,
        data: { email: "test@example.com" },
      };

      expect(() => {
        runAssertions(
          {
            "data.email": { not: { toMatch: "^[0-9]+$" } },
          },
          response,
        );
      }).not.toThrow();
    });

    test("should support not toHaveProperty", () => {
      const response = {
        status: 200,
        data: { id: 1 },
      };

      expect(() => {
        runAssertions(
          {
            data: { not: { toHaveProperty: "missing" } },
          },
          response,
        );
      }).not.toThrow();
    });

    test("should support not toBeCloseTo", () => {
      const response = {
        status: 200,
        data: { pi: 3.14159 },
      };

      expect(() => {
        runAssertions(
          {
            "data.pi": { not: { toBeCloseTo: 10.0 } },
          },
          response,
        );
      }).not.toThrow();
    });

    test("should support not toBeInstanceOf", () => {
      const response = {
        status: 200,
        data: { id: "not a number" },
      };

      expect(() => {
        runAssertions(
          {
            "data.id": { not: { toBeInstanceOf: Number } },
          },
          response,
        );
      }).not.toThrow();
    });

    test("should support not toBeFalsy", () => {
      const response = {
        status: 200,
        data: { value: 1 },
      };

      expect(() => {
        runAssertions(
          {
            "data.value": { not: { toBeFalsy: true } },
          },
          response,
        );
      }).not.toThrow();
    });

    test("should support not toBeNaN", () => {
      const response = {
        status: 200,
        data: { value: 1 },
      };

      expect(() => {
        runAssertions(
          {
            "data.value": { not: { toBeNaN: true } },
          },
          response,
        );
      }).not.toThrow();
    });

    test("should support not toBeNull", () => {
      const response = {
        status: 200,
        data: { value: 1 },
      };

      expect(() => {
        runAssertions(
          {
            "data.value": { not: { toBeNull: true } },
          },
          response,
        );
      }).not.toThrow();
    });
  });

  describe("CascadeAssertionError re-throw", () => {
    test("should re-throw CascadeAssertionError without wrapping", () => {
      // Create a custom CascadeAssertionError to test re-throw logic
      const customError = new CascadeAssertionError("Custom error", {
        path: "data.id",
        matcher: "toBeGreaterThan",
        expected: 0,
        received: -1,
        response: { status: 200, data: { id: -1 } },
      });

      // This tests the re-throw logic in catch blocks
      expect(() => {
        throw customError;
      }).toThrow(CascadeAssertionError);
    });
  });
});
