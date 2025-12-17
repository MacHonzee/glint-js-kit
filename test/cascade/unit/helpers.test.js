import { describe, test, expect } from "@jest/globals";
import { getByPath, getBaseUri, getUser, resolveAuth } from "../../../src/cascade/helpers.js";

describe("Helpers", () => {
  describe("getByPath", () => {
    test("should extract simple property", () => {
      const obj = { name: "test" };
      expect(getByPath(obj, "name")).toBe("test");
    });

    test("should extract nested property", () => {
      const obj = { user: { profile: { name: "John" } } };
      expect(getByPath(obj, "user.profile.name")).toBe("John");
    });

    test("should return undefined for missing path", () => {
      const obj = { user: { profile: { name: "John" } } };
      expect(getByPath(obj, "user.profile.email")).toBeUndefined();
    });

    test("should return undefined for null object", () => {
      expect(getByPath(null, "user.name")).toBeUndefined();
    });

    test("should return object when path is empty", () => {
      const obj = { name: "test" };
      expect(getByPath(obj, "")).toBe(obj);
    });

    test("should handle array indices", () => {
      const obj = { items: [{ name: "first" }, { name: "second" }] };
      expect(getByPath(obj, "items.0.name")).toBe("first");
      expect(getByPath(obj, "items.1.name")).toBe("second");
    });
  });

  describe("getBaseUri", () => {
    test("should return base URI for service", () => {
      const env = {
        services: {
          main: { baseUri: "http://localhost:3000" },
        },
      };
      expect(getBaseUri(env, "main")).toBe("http://localhost:3000");
    });

    test("should throw error for missing service", () => {
      const env = {
        services: {
          main: { baseUri: "http://localhost:3000" },
        },
      };
      expect(() => getBaseUri(env, "missing")).toThrow("Service 'missing' not found");
    });
  });

  describe("getUser", () => {
    test("should return user from state", () => {
      const state = {
        users: {
          testUser: { id: 1, name: "Test" },
        },
      };
      expect(getUser(state, "testUser")).toEqual({ id: 1, name: "Test" });
    });

    test("should return undefined for missing user", () => {
      const state = {
        users: {
          testUser: { id: 1, name: "Test" },
        },
      };
      expect(getUser(state, "missingUser")).toBeUndefined();
    });

    test("should return undefined when users object is missing", () => {
      const state = {};
      expect(getUser(state, "testUser")).toBeUndefined();
    });
  });

  describe("resolveAuth", () => {
    test("should return command-level auth (highest priority)", () => {
      const command = { auth: "commandUser", service: "main" };
      const env = {
        services: {
          main: { defaultAuth: "serviceUser" },
        },
        authentication: {
          defaultAuth: "globalUser",
        },
      };
      expect(resolveAuth(command, env)).toBe("commandUser");
    });

    test("should return service-level auth when command auth is missing", () => {
      const command = { service: "main" };
      const env = {
        services: {
          main: { defaultAuth: "serviceUser" },
        },
        authentication: {
          defaultAuth: "globalUser",
        },
      };
      expect(resolveAuth(command, env)).toBe("serviceUser");
    });

    test("should return global auth when service and command auth are missing", () => {
      const command = { service: "main" };
      const env = {
        services: {
          main: {},
        },
        authentication: {
          defaultAuth: "globalUser",
        },
      };
      expect(resolveAuth(command, env)).toBe("globalUser");
    });

    test("should return undefined when no auth is configured", () => {
      const command = { service: "main" };
      const env = {
        services: {
          main: {},
        },
        authentication: {},
      };
      expect(resolveAuth(command, env)).toBeUndefined();
    });

    test("should return undefined when service is missing", () => {
      const command = { service: "missing" };
      const env = {
        services: {
          main: { defaultAuth: "serviceUser" },
        },
        authentication: {
          defaultAuth: "globalUser",
        },
      };
      expect(resolveAuth(command, env)).toBe("globalUser");
    });
  });
});
