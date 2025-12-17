import { describe, test, expect, beforeEach, jest } from "@jest/globals";

// Mock axios first
const mockAxios = jest.fn();
jest.unstable_mockModule("axios", () => ({
  default: mockAxios,
}));

// Mock logger
jest.unstable_mockModule("../../../src/cascade/logger.js", () => ({
  getLogger: () => ({
    debug: jest.fn(),
    info: jest.fn(),
    error: jest.fn(),
  }),
}));

// Mock auth-manager
const mockGetToken = jest.fn();
jest.unstable_mockModule("../../../src/cascade/auth-manager.js", () => ({
  getToken: mockGetToken,
}));

// Mock helpers
jest.unstable_mockModule("../../../src/cascade/helpers.js", () => ({
  getBaseUri: (env, service) => env.services[service].baseUri,
  resolveAuth: (command, env) => {
    if (command.auth) return command.auth;
    if (command.service && env.services[command.service]?.defaultAuth) {
      return env.services[command.service].defaultAuth;
    }
    return env.authentication?.defaultAuth;
  },
}));

// Import after mocking
const { makeRequest } = await import("../../../src/cascade/http-client.js");

describe("HTTP Client", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockGetToken.mockResolvedValue("test-token");
  });

  describe("makeRequest", () => {
    test("should make POST request with dtoIn as body", async () => {
      const mockResponse = { status: 200, data: { id: 1, name: "Test" } };
      mockAxios.mockResolvedValue(mockResponse);

      const command = {
        endpoint: "/user/create",
        service: "main",
        method: "POST",
        dtoIn: { name: "Test User" },
      };

      const env = {
        services: {
          main: { baseUri: "http://localhost:3000" },
        },
        config: { timeout: 5000 },
      };

      const state = {};

      const result = await makeRequest(command, env, state, { name: "Test User" });

      expect(result).toBe(mockResponse);
      expect(mockAxios).toHaveBeenCalledWith({
        method: "POST",
        url: "http://localhost:3000/user/create",
        headers: {
          "Content-Type": "application/json",
        },
        timeout: 5000,
        data: { name: "Test User" },
        params: undefined,
      });
    });

    test("should make GET request with dtoIn as params", async () => {
      const mockResponse = { status: 200, data: { id: 1 } };
      mockAxios.mockResolvedValue(mockResponse);

      const command = {
        endpoint: "/user/1",
        service: "main",
        method: "GET",
        dtoIn: { id: 1 },
      };

      const env = {
        services: {
          main: { baseUri: "http://localhost:3000" },
        },
        config: { timeout: 5000 },
      };

      const state = {};

      await makeRequest(command, env, state, { id: 1 });

      expect(mockAxios).toHaveBeenCalledWith({
        method: "GET",
        url: "http://localhost:3000/user/1",
        headers: {
          "Content-Type": "application/json",
        },
        timeout: 5000,
        data: undefined,
        params: { id: 1 },
      });
    });

    test("should add Authorization header when auth is provided", async () => {
      const mockResponse = { status: 200, data: {} };
      mockAxios.mockResolvedValue(mockResponse);
      mockGetToken.mockResolvedValue("test-token");

      const command = {
        endpoint: "/user/create",
        service: "main",
        auth: "testUser",
      };

      const env = {
        services: {
          main: { baseUri: "http://localhost:3000" },
        },
        authentication: {
          defaultAuth: "testUser",
          users: {
            testUser: {},
          },
        },
        config: { timeout: 5000 },
      };

      const state = {};

      await makeRequest(command, env, state, {});

      expect(mockGetToken).toHaveBeenCalledWith("testUser", env, state);
      expect(mockAxios).toHaveBeenCalledWith(
        expect.objectContaining({
          headers: expect.objectContaining({
            Authorization: "Bearer test-token",
          }),
        }),
      );
    });

    test("should use service-level defaultAuth when command auth is missing", async () => {
      const mockResponse = { status: 200, data: {} };
      mockAxios.mockResolvedValue(mockResponse);
      mockGetToken.mockResolvedValue("test-token");

      const command = {
        endpoint: "/user/create",
        service: "main",
      };

      const env = {
        services: {
          main: { baseUri: "http://localhost:3000", defaultAuth: "serviceUser" },
        },
        authentication: {
          defaultAuth: "globalUser",
          users: {
            serviceUser: {},
          },
        },
        config: { timeout: 5000 },
      };

      const state = {};

      await makeRequest(command, env, state, {});

      expect(mockGetToken).toHaveBeenCalledWith("serviceUser", env, state);
    });

    test("should use global defaultAuth when service and command auth are missing", async () => {
      const mockResponse = { status: 200, data: {} };
      mockAxios.mockResolvedValue(mockResponse);
      mockGetToken.mockResolvedValue("test-token");

      const command = {
        endpoint: "/user/create",
        service: "main",
      };

      const env = {
        services: {
          main: { baseUri: "http://localhost:3000" },
        },
        authentication: {
          defaultAuth: "globalUser",
          users: {
            globalUser: {},
          },
        },
        config: { timeout: 5000 },
      };

      const state = {};

      await makeRequest(command, env, state, {});

      expect(mockGetToken).toHaveBeenCalledWith("globalUser", env, state);
    });

    test("should throw error for disallowed error response", async () => {
      const mockError = {
        response: {
          status: 400,
          data: { code: "badRequest", message: "Invalid input" },
        },
      };
      mockAxios.mockRejectedValue(mockError);

      const command = {
        endpoint: "/user/create",
        service: "main",
        dtoIn: {},
      };

      const env = {
        services: {
          main: { baseUri: "http://localhost:3000" },
        },
        config: { timeout: 5000 },
      };

      const state = {};

      await expect(makeRequest(command, env, state, {})).rejects.toEqual(mockError);
    });

    test("should allow error when code is in allowedErrorCodes", async () => {
      const mockError = {
        response: {
          status: 400,
          data: { code: "alreadyExists", message: "User already exists" },
        },
      };
      mockAxios.mockRejectedValue(mockError);

      const command = {
        endpoint: "/user/create",
        service: "main",
        allowedErrorCodes: ["alreadyExists", "validationError"],
      };

      const env = {
        services: {
          main: { baseUri: "http://localhost:3000" },
        },
        config: { timeout: 5000 },
      };

      const state = {};

      const result = await makeRequest(command, env, state, {});

      expect(result).toBe(mockError.response);
    });

    test("should allow error when allowedError function returns true", async () => {
      const mockError = {
        response: {
          status: 404,
          data: { code: "notFound", message: "Resource not found" },
        },
      };
      mockAxios.mockRejectedValue(mockError);

      const command = {
        endpoint: "/user/999",
        service: "main",
        allowedError: (error, response) => response?.data?.code === "notFound",
      };

      const env = {
        services: {
          main: { baseUri: "http://localhost:3000" },
        },
        config: { timeout: 5000 },
      };

      const state = {};

      const result = await makeRequest(command, env, state, {});

      expect(result).toBe(mockError.response);
    });

    test("should not allow error when allowedError function returns false", async () => {
      const mockError = {
        response: {
          status: 500,
          data: { code: "serverError", message: "Internal server error" },
        },
      };
      mockAxios.mockRejectedValue(mockError);

      const command = {
        endpoint: "/user/create",
        service: "main",
        allowedError: (error, response) => response?.data?.code === "notFound",
      };

      const env = {
        services: {
          main: { baseUri: "http://localhost:3000" },
        },
        config: { timeout: 5000 },
      };

      const state = {};

      await expect(makeRequest(command, env, state, {})).rejects.toEqual(mockError);
    });

    test("should not allow network errors", async () => {
      const mockError = {
        message: "Network Error",
        // No response property
      };
      mockAxios.mockRejectedValue(mockError);

      const command = {
        endpoint: "/user/create",
        service: "main",
        allowedErrorCodes: ["anyCode"],
      };

      const env = {
        services: {
          main: { baseUri: "http://localhost:3000" },
        },
        config: { timeout: 5000 },
      };

      const state = {};

      await expect(makeRequest(command, env, state, {})).rejects.toEqual(mockError);
    });

    test("should use default timeout when not configured", async () => {
      const mockResponse = { status: 200, data: {} };
      mockAxios.mockResolvedValue(mockResponse);

      const command = {
        endpoint: "/user/create",
        service: "main",
      };

      const env = {
        services: {
          main: { baseUri: "http://localhost:3000" },
        },
        config: {},
      };

      const state = {};

      await makeRequest(command, env, state, {});

      expect(mockAxios).toHaveBeenCalledWith(
        expect.objectContaining({
          timeout: 30000,
        }),
      );
    });

    test("should default to POST method", async () => {
      const mockResponse = { status: 200, data: {} };
      mockAxios.mockResolvedValue(mockResponse);

      const command = {
        endpoint: "/user/create",
        service: "main",
        // No method specified
      };

      const env = {
        services: {
          main: { baseUri: "http://localhost:3000" },
        },
        config: { timeout: 5000 },
      };

      const state = {};

      await makeRequest(command, env, state, {});

      expect(mockAxios).toHaveBeenCalledWith(
        expect.objectContaining({
          method: "POST",
        }),
      );
    });

    test("should throw error when service not found", async () => {
      const command = {
        endpoint: "/test",
        service: "missing",
      };

      const env = {
        services: {
          main: { baseUri: "http://localhost:3000" },
        },
        config: { timeout: 5000 },
      };

      const state = {};

      await expect(makeRequest(command, env, state, {})).rejects.toThrow("Service 'missing' not found");
    });

    test("should handle allowedError function that throws", async () => {
      const mockError = {
        response: {
          status: 400,
          data: { code: "error" },
        },
      };
      mockAxios.mockRejectedValue(mockError);

      const command = {
        endpoint: "/test",
        service: "main",
        allowedError: () => {
          throw new Error("Function error");
        },
      };

      const env = {
        services: {
          main: { baseUri: "http://localhost:3000" },
        },
        config: { timeout: 5000 },
      };

      const state = {};

      await expect(makeRequest(command, env, state, {})).rejects.toEqual(mockError);
    });
  });
});
