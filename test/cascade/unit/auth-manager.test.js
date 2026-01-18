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
const { authenticate, getToken, clearCache } = await import("../../../src/cascade/auth-manager.js");

describe("Auth Manager", () => {
  beforeEach(() => {
    clearCache();
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
});
