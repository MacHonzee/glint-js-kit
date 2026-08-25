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

// Mock helpers (resolveAuth mirrors real semantics for auth:false and absolute url)
jest.unstable_mockModule("../../../src/cascade/helpers.js", () => ({
  getBaseUri: (env, service) => env.services[service].baseUri,
  resolveAuth: (command, env) => {
    if (command.auth === false) return null;
    if (command.auth) return command.auth;
    if (command.url != null) return null;
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

    test("should PUT Buffer body to absolute URL without Authorization when auth is false", async () => {
      const mockResponse = { status: 200, data: "" };
      mockAxios.mockResolvedValue(mockResponse);
      const jpeg = Buffer.from([0xff, 0xd8, 0xff, 0xd9]);

      const command = {
        url: "https://storage.example.com/upload?signed=1",
        method: "PUT",
        body: jpeg,
        headers: { "Content-Type": "image/jpeg" },
        auth: false,
      };

      const env = {
        services: {
          main: { baseUri: "http://localhost:3000", defaultAuth: "authorityUser" },
        },
        authentication: { defaultAuth: "authorityUser" },
        config: { timeout: 5000 },
      };

      await makeRequest(command, env, {}, {});

      expect(mockGetToken).not.toHaveBeenCalled();
      expect(mockAxios).toHaveBeenCalledWith({
        method: "PUT",
        url: "https://storage.example.com/upload?signed=1",
        headers: { "Content-Type": "image/jpeg" },
        timeout: 5000,
        data: jpeg,
        params: undefined,
      });
    });

    test("should resolve absolute url function from state.saved", async () => {
      const mockResponse = { status: 200, data: {} };
      mockAxios.mockResolvedValue(mockResponse);
      const body = Buffer.from("bytes");

      const command = {
        url: (state) => state.saved.photoCreate.uploadUrl,
        method: "PUT",
        body,
        headers: { "Content-Type": "image/jpeg" },
        auth: false,
      };

      const state = {
        saved: { photoCreate: { uploadUrl: "https://fake-gcs.local/upload?uploadType=media" } },
      };

      await makeRequest(command, { services: {}, config: { timeout: 5000 } }, state, {});

      expect(mockAxios).toHaveBeenCalledWith(
        expect.objectContaining({
          url: "https://fake-gcs.local/upload?uploadType=media",
          data: body,
        }),
      );
    });

    test("should skip token fetch when auth is false", async () => {
      mockAxios.mockResolvedValue({ status: 200, data: {} });

      await makeRequest(
        {
          url: "http://localhost:9999/raw",
          method: "POST",
          body: "plain",
          auth: false,
        },
        {
          services: { main: { baseUri: "http://localhost:3000", defaultAuth: "u" } },
          authentication: { defaultAuth: "u" },
          config: { timeout: 1000 },
        },
        {},
        {},
      );

      expect(mockGetToken).not.toHaveBeenCalled();
      expect(mockAxios.mock.calls[0][0].headers.Authorization).toBeUndefined();
    });

    test("should default absolute URL mode to no auth when auth is omitted", async () => {
      mockAxios.mockResolvedValue({ status: 200, data: {} });

      await makeRequest(
        {
          url: "http://localhost:9999/signed",
          method: "PUT",
          body: Buffer.from("x"),
        },
        {
          services: { main: { baseUri: "http://localhost:3000", defaultAuth: "u" } },
          authentication: { defaultAuth: "u" },
          config: { timeout: 1000 },
        },
        {},
        {},
      );

      expect(mockGetToken).not.toHaveBeenCalled();
    });

    test("should still send Bearer in service mode when defaultAuth is set", async () => {
      mockAxios.mockResolvedValue({ status: 200, data: {} });
      mockGetToken.mockResolvedValue("svc-token");

      await makeRequest(
        { endpoint: "/user/create", service: "main" },
        {
          services: { main: { baseUri: "http://localhost:3000", defaultAuth: "serviceUser" } },
          authentication: { defaultAuth: "globalUser", users: { serviceUser: {} } },
          config: { timeout: 5000 },
        },
        {},
        {},
      );

      expect(mockGetToken).toHaveBeenCalledWith("serviceUser", expect.any(Object), expect.any(Object));
      expect(mockAxios).toHaveBeenCalledWith(
        expect.objectContaining({
          headers: expect.objectContaining({
            Authorization: "Bearer svc-token",
            "Content-Type": "application/json",
          }),
        }),
      );
    });

    test("should throw when absolute url does not resolve to http(s)", async () => {
      await expect(
        makeRequest(
          { url: "/relative/path", method: "PUT", body: Buffer.from("x"), auth: false },
          { services: {}, config: {} },
          {},
          {},
        ),
      ).rejects.toThrow(/absolute http\(s\) URL/);
    });

    test("should send JSON dtoIn on absolute URL when body is omitted", async () => {
      mockAxios.mockResolvedValue({ status: 200, data: { ok: true } });

      await makeRequest(
        {
          url: "http://localhost:9999/bucket",
          method: "POST",
          dtoIn: { name: "photos" },
          auth: false,
        },
        { services: {}, config: { timeout: 1000 } },
        {},
        { name: "photos" },
      );

      expect(mockAxios).toHaveBeenCalledWith(
        expect.objectContaining({
          url: "http://localhost:9999/bucket",
          data: { name: "photos" },
          headers: expect.objectContaining({ "Content-Type": "application/json" }),
        }),
      );
    });

    test("should send empty body on absolute URL when neither body nor dtoIn is set", async () => {
      mockAxios.mockResolvedValue({ status: 200, data: "" });

      await makeRequest(
        { url: "http://localhost:9999/ping", method: "PUT", auth: false },
        { services: {}, config: { timeout: 1000 } },
        {},
        {},
      );

      expect(mockAxios).toHaveBeenCalledWith(
        expect.objectContaining({
          data: undefined,
          params: undefined,
        }),
      );
    });
  });
});
