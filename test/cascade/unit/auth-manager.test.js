import { describe, test, expect, beforeEach, jest } from "@jest/globals";
import axios from "axios";

// Mock logger before importing auth-manager
jest.unstable_mockModule("../../../src/cascade/logger.js", () => ({
  getLogger: () => ({
    debug: jest.fn(),
    info: jest.fn(),
    error: jest.fn(),
  }),
}));

// Import after mocking
const { authenticate, getToken, clearCache, registerDynamicUser, clearDynamicUsers, isDynamicUser } = await import(
  "../../../src/cascade/auth-manager.js"
);

describe("Auth Manager", () => {
  beforeEach(() => {
    clearCache();
    clearDynamicUsers();
    jest.clearAllMocks();
    // Reset environment variables
    delete process.env.TEST_USERNAME;
    delete process.env.TEST_PASSWORD;
  });

  describe("authenticate", () => {
    test("should authenticate user and cache token", async () => {
      process.env.TEST_USERNAME = "testuser";
      process.env.TEST_PASSWORD = "testpass";

      const mockResponse = {
        data: {
          token: "test-token-123",
          user: { id: 1, name: "Test User" },
        },
      };

      jest.spyOn(axios, "post").mockResolvedValue(mockResponse);

      const env = {
        services: {
          main: { baseUri: "http://localhost:3000" },
        },
        authentication: {
          service: "main",
          loginEndpoint: "/auth/login",
          tokenPath: "token",
          userPath: "user",
          users: {
            testUser: {
              usernameEnvKey: "TEST_USERNAME",
              passwordEnvKey: "TEST_PASSWORD",
            },
          },
        },
      };

      const state = { users: {} };

      const result = await authenticate("testUser", env, state);

      expect(result.token).toBe("test-token-123");
      expect(result.user).toEqual({ id: 1, name: "Test User" });
      expect(axios.post).toHaveBeenCalledWith("http://localhost:3000/auth/login", {
        username: "testuser",
        password: "testpass",
      });
      expect(state.users.testUser).toEqual({ id: 1, name: "Test User" });
    });

    test("should return cached token on second call", async () => {
      process.env.TEST_USERNAME = "testuser";
      process.env.TEST_PASSWORD = "testpass";

      const mockResponse = {
        data: {
          token: "test-token-123",
          user: { id: 1, name: "Test User" },
        },
      };

      jest.spyOn(axios, "post").mockResolvedValue(mockResponse);

      const env = {
        services: {
          main: { baseUri: "http://localhost:3000" },
        },
        authentication: {
          service: "main",
          loginEndpoint: "/auth/login",
          tokenPath: "token",
          userPath: "user",
          users: {
            testUser: {
              usernameEnvKey: "TEST_USERNAME",
              passwordEnvKey: "TEST_PASSWORD",
            },
          },
        },
      };

      const state = { users: {} };

      // First call
      await authenticate("testUser", env, state);
      expect(axios.post).toHaveBeenCalledTimes(1);

      // Second call - should use cache
      const result = await authenticate("testUser", env, state);
      expect(axios.post).toHaveBeenCalledTimes(1); // Still 1, not 2
      expect(result.token).toBe("test-token-123");
    });

    test("should use user-specific service when provided", async () => {
      process.env.TEST_USERNAME = "testuser";
      process.env.TEST_PASSWORD = "testpass";

      jest.spyOn(axios, "post").mockResolvedValue({
        data: { token: "token", user: {} },
      });

      const env = {
        services: {
          main: { baseUri: "http://localhost:3000" },
          other: { baseUri: "http://localhost:3001" },
        },
        authentication: {
          service: "main",
          loginEndpoint: "/auth/login",
          tokenPath: "token",
          userPath: "user",
          users: {
            testUser: {
              service: "other",
              usernameEnvKey: "TEST_USERNAME",
              passwordEnvKey: "TEST_PASSWORD",
            },
          },
        },
      };

      const state = { users: {} };
      await authenticate("testUser", env, state);

      expect(axios.post).toHaveBeenCalledWith("http://localhost:3001/auth/login", {
        username: "testuser",
        password: "testpass",
      });
    });

    test("should throw error when user not found", async () => {
      const env = {
        services: { main: { baseUri: "http://localhost:3000" } },
        authentication: {
          service: "main",
          loginEndpoint: "/auth/login",
          tokenPath: "token",
          userPath: "user",
          users: {},
        },
      };

      const state = { users: {} };

      await expect(authenticate("missingUser", env, state)).rejects.toThrow("User 'missingUser' not found");
    });

    test("should throw error when credentials missing", async () => {
      const env = {
        services: { main: { baseUri: "http://localhost:3000" } },
        authentication: {
          service: "main",
          loginEndpoint: "/auth/login",
          tokenPath: "token",
          userPath: "user",
          users: {
            testUser: {
              usernameEnvKey: "MISSING_USERNAME",
              passwordEnvKey: "MISSING_PASSWORD",
            },
          },
        },
      };

      const state = { users: {} };

      await expect(authenticate("testUser", env, state)).rejects.toThrow("Credentials not found");
    });

    test("should throw error with proper message when only username missing", async () => {
      process.env.TEST_PASSWORD = "testpass";

      const env = {
        services: { main: { baseUri: "http://localhost:3000" } },
        authentication: {
          service: "main",
          loginEndpoint: "/auth/login",
          tokenPath: "token",
          userPath: "user",
          users: {
            testUser: {
              usernameEnvKey: "MISSING_USERNAME",
              passwordEnvKey: "TEST_PASSWORD",
            },
          },
        },
      };

      const state = { users: {} };

      await expect(authenticate("testUser", env, state)).rejects.toThrow("env var MISSING_USERNAME");

      delete process.env.TEST_PASSWORD;
    });

    test("should throw error with proper message when only password missing", async () => {
      process.env.TEST_USERNAME = "testuser";

      const env = {
        services: { main: { baseUri: "http://localhost:3000" } },
        authentication: {
          service: "main",
          loginEndpoint: "/auth/login",
          tokenPath: "token",
          userPath: "user",
          users: {
            testUser: {
              usernameEnvKey: "TEST_USERNAME",
              passwordEnvKey: "MISSING_PASSWORD",
            },
          },
        },
      };

      const state = { users: {} };

      await expect(authenticate("testUser", env, state)).rejects.toThrow("env var MISSING_PASSWORD");

      delete process.env.TEST_USERNAME;
    });

    test("should throw error when credentials missing without env keys", async () => {
      const env = {
        services: { main: { baseUri: "http://localhost:3000" } },
        authentication: {
          service: "main",
          loginEndpoint: "/auth/login",
          tokenPath: "token",
          userPath: "user",
          users: {
            testUser: {
              // No username, password, or env keys
            },
          },
        },
      };

      const state = { users: {} };

      await expect(authenticate("testUser", env, state)).rejects.toThrow("username");
    });

    test("should use direct username and password from config", async () => {
      jest.spyOn(axios, "post").mockResolvedValue({
        data: { token: "direct-token", user: { id: 1 } },
      });

      const env = {
        services: { main: { baseUri: "http://localhost:3000" } },
        authentication: {
          service: "main",
          loginEndpoint: "/auth/login",
          tokenPath: "token",
          userPath: "user",
          users: {
            testUser: {
              username: "directuser",
              password: "directpass",
            },
          },
        },
      };

      const state = { users: {} };
      const result = await authenticate("testUser", env, state);

      expect(result.token).toBe("direct-token");
      expect(axios.post).toHaveBeenCalledWith("http://localhost:3000/auth/login", {
        username: "directuser",
        password: "directpass",
      });
    });

    test("should prefer direct credentials over env vars", async () => {
      process.env.TEST_USERNAME = "envuser";
      process.env.TEST_PASSWORD = "envpass";

      jest.spyOn(axios, "post").mockResolvedValue({
        data: { token: "preferred-token", user: {} },
      });

      const env = {
        services: { main: { baseUri: "http://localhost:3000" } },
        authentication: {
          service: "main",
          loginEndpoint: "/auth/login",
          tokenPath: "token",
          userPath: "user",
          users: {
            testUser: {
              username: "directuser",
              password: "directpass",
              usernameEnvKey: "TEST_USERNAME",
              passwordEnvKey: "TEST_PASSWORD",
            },
          },
        },
      };

      const state = { users: {} };
      await authenticate("testUser", env, state);

      expect(axios.post).toHaveBeenCalledWith("http://localhost:3000/auth/login", {
        username: "directuser",
        password: "directpass",
      });

      delete process.env.TEST_USERNAME;
      delete process.env.TEST_PASSWORD;
    });

    test("should fallback to env vars when direct credentials not provided", async () => {
      process.env.FALLBACK_USERNAME = "fallbackuser";
      process.env.FALLBACK_PASSWORD = "fallbackpass";

      jest.spyOn(axios, "post").mockResolvedValue({
        data: { token: "fallback-token", user: {} },
      });

      const env = {
        services: { main: { baseUri: "http://localhost:3000" } },
        authentication: {
          service: "main",
          loginEndpoint: "/auth/login",
          tokenPath: "token",
          userPath: "user",
          users: {
            testUser: {
              usernameEnvKey: "FALLBACK_USERNAME",
              passwordEnvKey: "FALLBACK_PASSWORD",
            },
          },
        },
      };

      const state = { users: {} };
      await authenticate("testUser", env, state);

      expect(axios.post).toHaveBeenCalledWith("http://localhost:3000/auth/login", {
        username: "fallbackuser",
        password: "fallbackpass",
      });

      delete process.env.FALLBACK_USERNAME;
      delete process.env.FALLBACK_PASSWORD;
    });

    test("should allow mixing direct username with env password", async () => {
      process.env.MIXED_PASSWORD = "mixedpass";

      jest.spyOn(axios, "post").mockResolvedValue({
        data: { token: "mixed-token", user: {} },
      });

      const env = {
        services: { main: { baseUri: "http://localhost:3000" } },
        authentication: {
          service: "main",
          loginEndpoint: "/auth/login",
          tokenPath: "token",
          userPath: "user",
          users: {
            testUser: {
              username: "directuser",
              passwordEnvKey: "MIXED_PASSWORD",
            },
          },
        },
      };

      const state = { users: {} };
      await authenticate("testUser", env, state);

      expect(axios.post).toHaveBeenCalledWith("http://localhost:3000/auth/login", {
        username: "directuser",
        password: "mixedpass",
      });

      delete process.env.MIXED_PASSWORD;
    });

    test("should throw error when token not found in response", async () => {
      process.env.TEST_USERNAME = "testuser";
      process.env.TEST_PASSWORD = "testpass";

      jest.spyOn(axios, "post").mockResolvedValue({
        data: { user: {} }, // No token
      });

      const env = {
        services: { main: { baseUri: "http://localhost:3000" } },
        authentication: {
          service: "main",
          loginEndpoint: "/auth/login",
          tokenPath: "token",
          userPath: "user",
          users: {
            testUser: {
              usernameEnvKey: "TEST_USERNAME",
              passwordEnvKey: "TEST_PASSWORD",
            },
          },
        },
      };

      const state = { users: {} };

      await expect(authenticate("testUser", env, state)).rejects.toThrow("Token not found in login response");
    });

    test("should extract token and user from nested paths", async () => {
      process.env.TEST_USERNAME = "testuser";
      process.env.TEST_PASSWORD = "testpass";

      jest.spyOn(axios, "post").mockResolvedValue({
        data: {
          auth: { accessToken: "nested-token" },
          data: { user: { id: 1 } },
        },
      });

      const env = {
        services: { main: { baseUri: "http://localhost:3000" } },
        authentication: {
          service: "main",
          loginEndpoint: "/auth/login",
          tokenPath: "auth.accessToken",
          userPath: "data.user",
          users: {
            testUser: {
              usernameEnvKey: "TEST_USERNAME",
              passwordEnvKey: "TEST_PASSWORD",
            },
          },
        },
      };

      const state = { users: {} };
      const result = await authenticate("testUser", env, state);

      expect(result.token).toBe("nested-token");
      expect(result.user).toEqual({ id: 1 });
    });

    test("should use default loginEndpoint when not configured", async () => {
      process.env.TEST_USERNAME = "testuser";
      process.env.TEST_PASSWORD = "testpass";

      jest.spyOn(axios, "post").mockResolvedValue({
        data: { token: "token", user: {} },
      });

      const env = {
        services: { main: { baseUri: "http://localhost:3000" } },
        authentication: {
          service: "main",
          // No loginEndpoint
          tokenPath: "token",
          userPath: "user",
          users: {
            testUser: {
              usernameEnvKey: "TEST_USERNAME",
              passwordEnvKey: "TEST_PASSWORD",
            },
          },
        },
      };

      const state = { users: {} };
      await authenticate("testUser", env, state);

      expect(axios.post).toHaveBeenCalledWith("http://localhost:3000/user/login", {
        username: "testuser",
        password: "testpass",
      });
    });

    test("should use default tokenPath and userPath when not configured", async () => {
      process.env.TEST_USERNAME = "testuser";
      process.env.TEST_PASSWORD = "testpass";

      jest.spyOn(axios, "post").mockResolvedValue({
        data: { token: "default-token", user: { id: 1 } },
      });

      const env = {
        services: { main: { baseUri: "http://localhost:3000" } },
        authentication: {
          service: "main",
          loginEndpoint: "/auth/login",
          // No tokenPath or userPath
          users: {
            testUser: {
              usernameEnvKey: "TEST_USERNAME",
              passwordEnvKey: "TEST_PASSWORD",
            },
          },
        },
      };

      const state = { users: {} };
      const result = await authenticate("testUser", env, state);

      expect(result.token).toBe("default-token");
      expect(result.user).toEqual({ id: 1 });
    });

    test("should throw error when service not found", async () => {
      process.env.TEST_USERNAME = "testuser";
      process.env.TEST_PASSWORD = "testpass";

      const env = {
        services: {
          main: { baseUri: "http://localhost:3000" },
        },
        authentication: {
          service: "missingService",
          loginEndpoint: "/auth/login",
          tokenPath: "token",
          userPath: "user",
          users: {
            testUser: {
              usernameEnvKey: "TEST_USERNAME",
              passwordEnvKey: "TEST_PASSWORD",
            },
          },
        },
      };

      const state = { users: {} };

      await expect(authenticate("testUser", env, state)).rejects.toThrow("Service 'missingService' not found");
    });
  });

  describe("getToken", () => {
    test("should return token from authenticate", async () => {
      process.env.TEST_USERNAME = "testuser";
      process.env.TEST_PASSWORD = "testpass";

      jest.spyOn(axios, "post").mockResolvedValue({
        data: { token: "test-token", user: {} },
      });

      const env = {
        services: { main: { baseUri: "http://localhost:3000" } },
        authentication: {
          service: "main",
          loginEndpoint: "/auth/login",
          tokenPath: "token",
          userPath: "user",
          users: {
            testUser: {
              usernameEnvKey: "TEST_USERNAME",
              passwordEnvKey: "TEST_PASSWORD",
            },
          },
        },
      };

      const state = { users: {} };
      const token = await getToken("testUser", env, state);

      expect(token).toBe("test-token");
    });
  });

  describe("clearCache", () => {
    test("should clear token cache", async () => {
      process.env.TEST_USERNAME = "testuser";
      process.env.TEST_PASSWORD = "testpass";

      jest.spyOn(axios, "post").mockResolvedValue({
        data: { token: "token1", user: {} },
      });

      const env = {
        services: { main: { baseUri: "http://localhost:3000" } },
        authentication: {
          service: "main",
          loginEndpoint: "/auth/login",
          tokenPath: "token",
          userPath: "user",
          users: {
            testUser: {
              usernameEnvKey: "TEST_USERNAME",
              passwordEnvKey: "TEST_PASSWORD",
            },
          },
        },
      };

      const state = { users: {} };

      // First call
      await authenticate("testUser", env, state);
      expect(axios.post).toHaveBeenCalledTimes(1);

      // Clear cache
      clearCache();

      // Second call should make new request
      jest.spyOn(axios, "post").mockResolvedValue({
        data: { token: "token2", user: {} },
      });
      await authenticate("testUser", env, state);
      expect(axios.post).toHaveBeenCalledTimes(2);
    });
  });

  describe("registerDynamicUser", () => {
    test("should register a dynamic user with credentials", () => {
      registerDynamicUser("newUser", {
        username: "test@example.com",
        password: "Test123!",
      });

      expect(isDynamicUser("newUser")).toBe(true);
    });

    test("should throw error when userKey is missing", () => {
      expect(() => registerDynamicUser(null, { username: "test", password: "pass" })).toThrow(
        "userKey is required for registerDynamicUser",
      );
    });

    test("should throw error when username is missing", () => {
      expect(() => registerDynamicUser("newUser", { password: "pass" })).toThrow(
        "Credentials (username and password) are required",
      );
    });

    test("should throw error when password is missing", () => {
      expect(() => registerDynamicUser("newUser", { username: "test" })).toThrow(
        "Credentials (username and password) are required",
      );
    });

    test("should allow optional service override", () => {
      registerDynamicUser("newUser", {
        username: "test@example.com",
        password: "Test123!",
        service: "otherService",
      });

      expect(isDynamicUser("newUser")).toBe(true);
    });
  });

  describe("isDynamicUser", () => {
    test("should return false for non-registered user", () => {
      expect(isDynamicUser("unknownUser")).toBe(false);
    });

    test("should return true for registered dynamic user", () => {
      registerDynamicUser("dynamicUser", {
        username: "dynamic@example.com",
        password: "DynamicPass123!",
      });

      expect(isDynamicUser("dynamicUser")).toBe(true);
    });
  });

  describe("clearDynamicUsers", () => {
    test("should clear all dynamic users", () => {
      registerDynamicUser("user1", { username: "user1@example.com", password: "pass1" });
      registerDynamicUser("user2", { username: "user2@example.com", password: "pass2" });

      expect(isDynamicUser("user1")).toBe(true);
      expect(isDynamicUser("user2")).toBe(true);

      clearDynamicUsers();

      expect(isDynamicUser("user1")).toBe(false);
      expect(isDynamicUser("user2")).toBe(false);
    });
  });

  describe("authenticate with dynamic users", () => {
    test("should authenticate dynamic user", async () => {
      jest.spyOn(axios, "post").mockResolvedValue({
        data: { token: "dynamic-token", user: { id: 99, name: "Dynamic User" } },
      });

      // Register dynamic user
      registerDynamicUser("dynamicUser", {
        username: "dynamic@example.com",
        password: "DynamicPass123!",
      });

      const env = {
        services: { main: { baseUri: "http://localhost:3000" } },
        authentication: {
          service: "main",
          loginEndpoint: "/auth/login",
          tokenPath: "token",
          userPath: "user",
          users: {}, // No static users
        },
      };

      const state = { users: {} };
      const result = await authenticate("dynamicUser", env, state);

      expect(result.token).toBe("dynamic-token");
      expect(result.user).toEqual({ id: 99, name: "Dynamic User" });
      expect(axios.post).toHaveBeenCalledWith("http://localhost:3000/auth/login", {
        username: "dynamic@example.com",
        password: "DynamicPass123!",
      });
      expect(state.users.dynamicUser).toEqual({ id: 99, name: "Dynamic User" });
    });

    test("should use dynamic user service override when specified", async () => {
      jest.spyOn(axios, "post").mockResolvedValue({
        data: { token: "token", user: {} },
      });

      // Register dynamic user with service override
      registerDynamicUser("dynamicUser", {
        username: "dynamic@example.com",
        password: "DynamicPass123!",
        service: "other",
      });

      const env = {
        services: {
          main: { baseUri: "http://localhost:3000" },
          other: { baseUri: "http://localhost:4000" },
        },
        authentication: {
          service: "main",
          loginEndpoint: "/auth/login",
          tokenPath: "token",
          userPath: "user",
          users: {},
        },
      };

      const state = { users: {} };
      await authenticate("dynamicUser", env, state);

      expect(axios.post).toHaveBeenCalledWith("http://localhost:4000/auth/login", {
        username: "dynamic@example.com",
        password: "DynamicPass123!",
      });
    });

    test("should prefer static user over dynamic user with same key", async () => {
      process.env.STATIC_USERNAME = "staticuser";
      process.env.STATIC_PASSWORD = "staticpass";

      jest.spyOn(axios, "post").mockResolvedValue({
        data: { token: "static-token", user: { id: 1 } },
      });

      // Register dynamic user with same key as static user
      registerDynamicUser("testUser", {
        username: "dynamic@example.com",
        password: "DynamicPass123!",
      });

      const env = {
        services: { main: { baseUri: "http://localhost:3000" } },
        authentication: {
          service: "main",
          loginEndpoint: "/auth/login",
          tokenPath: "token",
          userPath: "user",
          users: {
            testUser: {
              usernameEnvKey: "STATIC_USERNAME",
              passwordEnvKey: "STATIC_PASSWORD",
            },
          },
        },
      };

      const state = { users: {} };
      await authenticate("testUser", env, state);

      // Should use static user credentials, not dynamic
      expect(axios.post).toHaveBeenCalledWith("http://localhost:3000/auth/login", {
        username: "staticuser",
        password: "staticpass",
      });

      delete process.env.STATIC_USERNAME;
      delete process.env.STATIC_PASSWORD;
    });

    test("should throw error when user not found in static or dynamic users", async () => {
      const env = {
        services: { main: { baseUri: "http://localhost:3000" } },
        authentication: {
          service: "main",
          loginEndpoint: "/auth/login",
          tokenPath: "token",
          userPath: "user",
          users: {},
        },
      };

      const state = { users: {} };

      await expect(authenticate("unknownUser", env, state)).rejects.toThrow(
        "User 'unknownUser' not found in authentication.users or dynamic users",
      );
    });

    test("should cache dynamic user token", async () => {
      jest.spyOn(axios, "post").mockResolvedValue({
        data: { token: "dynamic-token", user: {} },
      });

      registerDynamicUser("dynamicUser", {
        username: "dynamic@example.com",
        password: "DynamicPass123!",
      });

      const env = {
        services: { main: { baseUri: "http://localhost:3000" } },
        authentication: {
          service: "main",
          loginEndpoint: "/auth/login",
          tokenPath: "token",
          userPath: "user",
          users: {},
        },
      };

      const state = { users: {} };

      // First call
      await authenticate("dynamicUser", env, state);
      expect(axios.post).toHaveBeenCalledTimes(1);

      // Second call - should use cache
      const result = await authenticate("dynamicUser", env, state);
      expect(axios.post).toHaveBeenCalledTimes(1); // Still 1, not 2
      expect(result.token).toBe("dynamic-token");
    });
  });
});
