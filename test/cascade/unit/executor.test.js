import { describe, test, expect, beforeEach, jest } from "@jest/globals";

// Mock all dependencies
const mockLoadDatasets = jest.fn();
const mockMakeRequest = jest.fn();
const mockResolveDtoIn = jest.fn();
const mockSaveToState = jest.fn();
const mockMergeParams = jest.fn();
const mockRegisterDynamicUser = jest.fn();
const mockRunAssertions = jest.fn();

jest.unstable_mockModule("../../../src/cascade/loader.js", () => ({
  loadDatasets: mockLoadDatasets,
  loadImport: jest.fn(),
}));

jest.unstable_mockModule("../../../src/cascade/http-client.js", () => ({
  makeRequest: mockMakeRequest,
}));

jest.unstable_mockModule("../../../src/cascade/state-manager.js", () => ({
  createState: () => ({ users: {}, params: {}, saved: {} }),
  resolveDtoIn: mockResolveDtoIn,
  saveToState: mockSaveToState,
  mergeParams: mockMergeParams,
}));

jest.unstable_mockModule("../../../src/cascade/logger.js", () => ({
  getLogger: () => ({
    debug: jest.fn(),
    info: jest.fn(),
    error: jest.fn(),
  }),
}));

jest.unstable_mockModule("../../../src/cascade/auth-manager.js", () => ({
  registerDynamicUser: mockRegisterDynamicUser,
}));

jest.unstable_mockModule("../../../src/cascade/assertions.js", () => ({
  runAssertions: mockRunAssertions,
}));

const { execute } = await import("../../../src/cascade/executor.js");

describe("Executor", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockResolveDtoIn.mockImplementation((dtoIn) => dtoIn || {});
    mockMergeParams.mockImplementation((state, params) => ({ ...state, params: { ...state.params, ...params } }));
  });

  describe("execute", () => {
    test("should execute commands sequentially", async () => {
      const commands = [
        { endpoint: "/test1", service: "main", dtoIn: { id: 1 } },
        { endpoint: "/test2", service: "main", dtoIn: { id: 2 } },
      ];

      mockLoadDatasets.mockResolvedValue(commands);
      mockMakeRequest.mockResolvedValueOnce({ data: { result: 1 } }).mockResolvedValueOnce({ data: { result: 2 } });

      const env = {
        services: { main: { baseUri: "http://localhost:3000" } },
        authentication: {},
        config: {},
      };

      await execute("./test.js", env, {});

      expect(mockMakeRequest).toHaveBeenCalledTimes(2);
      expect(mockMakeRequest).toHaveBeenNthCalledWith(1, commands[0], env, expect.any(Object), { id: 1 });
      expect(mockMakeRequest).toHaveBeenNthCalledWith(2, commands[1], env, expect.any(Object), { id: 2 });
    });

    test("should save response when saveAs is specified", async () => {
      const commands = [
        {
          endpoint: "/test",
          service: "main",
          saveAs: "testResult",
        },
      ];

      mockLoadDatasets.mockResolvedValue(commands);
      mockMakeRequest.mockResolvedValue({ data: { id: 1, name: "Test" } });

      const env = {
        services: { main: { baseUri: "http://localhost:3000" } },
        authentication: {},
        config: {},
      };

      await execute("./test.js", env, {});

      expect(mockSaveToState).toHaveBeenCalledWith(expect.any(Object), "testResult", { id: 1, name: "Test" });
    });

    test("should handle dry-run mode", async () => {
      const commands = [{ endpoint: "/test", service: "main" }];

      mockLoadDatasets.mockResolvedValue(commands);

      const env = {
        services: { main: { baseUri: "http://localhost:3000" } },
        authentication: {},
        config: {},
      };

      await execute("./test.js", env, { dryRun: true });

      expect(mockMakeRequest).not.toHaveBeenCalled();
    });

    test("should throw error when command fails", async () => {
      const commands = [{ endpoint: "/test", service: "main" }];

      mockLoadDatasets.mockResolvedValue(commands);
      mockMakeRequest.mockRejectedValue(new Error("Request failed"));

      const env = {
        services: { main: { baseUri: "http://localhost:3000" } },
        authentication: {},
        config: {},
      };

      await expect(execute("./test.js", env, {})).rejects.toThrow("Request failed");
    });

    test("should resolve function dtoIn", async () => {
      const commands = [
        {
          endpoint: "/test",
          service: "main",
          dtoIn: (state) => ({ userId: state.saved.userId }),
        },
      ];

      mockLoadDatasets.mockResolvedValue(commands);
      mockResolveDtoIn.mockReturnValue({ userId: 123 });
      mockMakeRequest.mockResolvedValue({ data: {} });

      const env = {
        services: { main: { baseUri: "http://localhost:3000" } },
        authentication: {},
        config: {},
      };

      await execute("./test.js", env, {});

      expect(mockResolveDtoIn).toHaveBeenCalled();
    });

    test("should throw error when command has neither import nor endpoint+service", async () => {
      const commands = [{ invalid: "command" }];

      mockLoadDatasets.mockResolvedValue(commands);

      const env = {
        services: { main: { baseUri: "http://localhost:3000" } },
        authentication: {},
        config: {},
      };

      await expect(execute("./test.js", env, {})).rejects.toThrow(
        "Command must have either 'import' or both 'endpoint' and 'service'",
      );
    });

    test("should log error details when command fails with response", async () => {
      const commands = [{ endpoint: "/test", service: "main" }];

      mockLoadDatasets.mockResolvedValue(commands);
      const error = new Error("Request failed");
      error.response = {
        status: 400,
        data: { code: "badRequest", message: "Invalid input" },
      };
      mockMakeRequest.mockRejectedValue(error);

      const env = {
        services: { main: { baseUri: "http://localhost:3000" } },
        authentication: {},
        config: {},
      };

      await expect(execute("./test.js", env, {})).rejects.toThrow("Request failed");
    });

    test("should register dynamic user with simple registerAs syntax", async () => {
      const commands = [
        {
          endpoint: "/user/register",
          service: "main",
          dtoIn: { username: "testuser", password: "testpass" },
          registerAs: "newUser",
        },
      ];

      mockLoadDatasets.mockResolvedValue(commands);
      mockResolveDtoIn.mockReturnValue({ username: "testuser", password: "testpass" });
      mockMakeRequest.mockResolvedValue({ status: 200, data: { id: 1 } });

      const env = {
        services: { main: { baseUri: "http://localhost:3000" } },
        authentication: {},
        config: {},
      };

      await execute("./test.js", env, {});

      expect(mockRegisterDynamicUser).toHaveBeenCalledWith("newUser", {
        username: "testuser",
        password: "testpass",
        service: "main",
      });
    });

    test("should register dynamic user with explicit registerAs config", async () => {
      const commands = [
        {
          endpoint: "/user/register",
          service: "main",
          dtoIn: { login: "testuser", secret: "testpass" },
          registerAs: {
            userKey: "newUser",
            usernamePath: "login",
            passwordPath: "secret",
          },
        },
      ];

      mockLoadDatasets.mockResolvedValue(commands);
      mockResolveDtoIn.mockReturnValue({ login: "testuser", secret: "testpass" });
      mockMakeRequest.mockResolvedValue({ status: 200, data: { id: 1 } });

      const env = {
        services: { main: { baseUri: "http://localhost:3000" } },
        authentication: {},
        config: {},
      };

      await execute("./test.js", env, {});

      expect(mockRegisterDynamicUser).toHaveBeenCalledWith("newUser", {
        username: "testuser",
        password: "testpass",
        service: "main",
      });
    });

    test("should throw error for invalid registerAs value (not string or object)", async () => {
      const commands = [
        {
          endpoint: "/user/register",
          service: "main",
          dtoIn: { username: "testuser", password: "testpass" },
          registerAs: 123, // Invalid type
        },
      ];

      mockLoadDatasets.mockResolvedValue(commands);
      mockResolveDtoIn.mockReturnValue({ username: "testuser", password: "testpass" });
      mockMakeRequest.mockResolvedValue({ status: 200, data: { id: 1 } });

      const env = {
        services: { main: { baseUri: "http://localhost:3000" } },
        authentication: {},
        config: {},
      };

      await expect(execute("./test.js", env, {})).rejects.toThrow(
        "Invalid registerAs value: expected string or object, got number",
      );
    });

    test("should throw error when registerAs object is missing userKey", async () => {
      const commands = [
        {
          endpoint: "/user/register",
          service: "main",
          dtoIn: { username: "testuser", password: "testpass" },
          registerAs: { usernamePath: "username" }, // Missing userKey
        },
      ];

      mockLoadDatasets.mockResolvedValue(commands);
      mockResolveDtoIn.mockReturnValue({ username: "testuser", password: "testpass" });
      mockMakeRequest.mockResolvedValue({ status: 200, data: { id: 1 } });

      const env = {
        services: { main: { baseUri: "http://localhost:3000" } },
        authentication: {},
        config: {},
      };

      await expect(execute("./test.js", env, {})).rejects.toThrow(
        "registerAs requires a userKey (string or object.userKey)",
      );
    });

    test("should throw error when username cannot be extracted from dtoIn", async () => {
      const commands = [
        {
          endpoint: "/user/register",
          service: "main",
          dtoIn: { email: "test@example.com", password: "testpass" }, // No username field
          registerAs: "newUser",
        },
      ];

      mockLoadDatasets.mockResolvedValue(commands);
      mockResolveDtoIn.mockReturnValue({ email: "test@example.com", password: "testpass" });
      mockMakeRequest.mockResolvedValue({ status: 200, data: { id: 1 } });

      const env = {
        services: { main: { baseUri: "http://localhost:3000" } },
        authentication: {},
        config: {},
      };

      await expect(execute("./test.js", env, {})).rejects.toThrow(
        "Could not extract username from dtoIn at path 'username' for registerAs 'newUser'",
      );
    });

    test("should throw error when password cannot be extracted from dtoIn", async () => {
      const commands = [
        {
          endpoint: "/user/register",
          service: "main",
          dtoIn: { username: "testuser", secret: "testpass" }, // No password field
          registerAs: "newUser",
        },
      ];

      mockLoadDatasets.mockResolvedValue(commands);
      mockResolveDtoIn.mockReturnValue({ username: "testuser", secret: "testpass" });
      mockMakeRequest.mockResolvedValue({ status: 200, data: { id: 1 } });

      const env = {
        services: { main: { baseUri: "http://localhost:3000" } },
        authentication: {},
        config: {},
      };

      await expect(execute("./test.js", env, {})).rejects.toThrow(
        "Could not extract password from dtoIn at path 'password' for registerAs 'newUser'",
      );
    });

    test("should not register dynamic user on error response", async () => {
      const commands = [
        {
          endpoint: "/user/register",
          service: "main",
          dtoIn: { username: "testuser", password: "testpass" },
          registerAs: "newUser",
          allowedErrorCodes: ["duplicateUser"],
        },
      ];

      mockLoadDatasets.mockResolvedValue(commands);
      mockResolveDtoIn.mockReturnValue({ username: "testuser", password: "testpass" });
      mockMakeRequest.mockResolvedValue({ status: 400, data: { code: "duplicateUser" } });

      const env = {
        services: { main: { baseUri: "http://localhost:3000" } },
        authentication: {},
        config: {},
      };

      await execute("./test.js", env, {});

      expect(mockRegisterDynamicUser).not.toHaveBeenCalled();
    });

    test("should throw error when expect is defined but got error response", async () => {
      const commands = [
        {
          endpoint: "/test",
          service: "main",
          expect: { status: 200 },
        },
      ];

      mockLoadDatasets.mockResolvedValue(commands);
      mockMakeRequest.mockResolvedValue({ status: 400, data: { error: "bad request" } });

      const env = {
        services: { main: { baseUri: "http://localhost:3000" } },
        authentication: {},
        config: {},
      };

      await expect(execute("./test.js", env, {})).rejects.toThrow(
        "Expected successful response but got 400. Use expectError for error responses.",
      );
    });

    test("should throw error when expectError is defined but got success response", async () => {
      const commands = [
        {
          endpoint: "/test",
          service: "main",
          expectError: { status: 400 },
        },
      ];

      mockLoadDatasets.mockResolvedValue(commands);
      mockMakeRequest.mockResolvedValue({ status: 200, data: { success: true } });

      const env = {
        services: { main: { baseUri: "http://localhost:3000" } },
        authentication: {},
        config: {},
      };

      await expect(execute("./test.js", env, {})).rejects.toThrow(
        "Expected error response but got 200. Use expect for successful responses.",
      );
    });

    test("should run expect assertions on successful response", async () => {
      const commands = [
        {
          endpoint: "/test",
          service: "main",
          expect: { status: 200, "data.id": 1 },
        },
      ];

      mockLoadDatasets.mockResolvedValue(commands);
      mockMakeRequest.mockResolvedValue({ status: 200, data: { id: 1 } });

      const env = {
        services: { main: { baseUri: "http://localhost:3000" } },
        authentication: {},
        config: {},
      };

      await execute("./test.js", env, {});

      expect(mockRunAssertions).toHaveBeenCalledWith({ status: 200, "data.id": 1 }, { status: 200, data: { id: 1 } });
    });

    test("should run expectError assertions on error response", async () => {
      const commands = [
        {
          endpoint: "/test",
          service: "main",
          expectError: { status: 404, "data.code": "notFound" },
        },
      ];

      mockLoadDatasets.mockResolvedValue(commands);
      mockMakeRequest.mockResolvedValue({ status: 404, data: { code: "notFound" } });

      const env = {
        services: { main: { baseUri: "http://localhost:3000" } },
        authentication: {},
        config: {},
      };

      await execute("./test.js", env, {});

      expect(mockRunAssertions).toHaveBeenCalledWith(
        { status: 404, "data.code": "notFound" },
        { status: 404, data: { code: "notFound" } },
      );
    });

    test("should handle expectError when makeRequest throws with error.response", async () => {
      const commands = [
        {
          endpoint: "/test",
          service: "main",
          expectError: { status: 500 },
        },
      ];

      mockLoadDatasets.mockResolvedValue(commands);
      const error = new Error("Request failed");
      error.response = { status: 500, data: { code: "serverError" } };
      mockMakeRequest.mockRejectedValue(error);

      const env = {
        services: { main: { baseUri: "http://localhost:3000" } },
        authentication: {},
        config: {},
      };

      await execute("./test.js", env, {});

      expect(mockRunAssertions).toHaveBeenCalledWith({ status: 500 }, { status: 500, data: { code: "serverError" } });
    });

    test("should use default usernamePath and passwordPath in explicit registerAs config", async () => {
      const commands = [
        {
          endpoint: "/user/register",
          service: "main",
          dtoIn: { username: "testuser", password: "testpass" },
          registerAs: {
            userKey: "newUser",
            // usernamePath and passwordPath not specified, should default to "username" and "password"
          },
        },
      ];

      mockLoadDatasets.mockResolvedValue(commands);
      mockResolveDtoIn.mockReturnValue({ username: "testuser", password: "testpass" });
      mockMakeRequest.mockResolvedValue({ status: 200, data: { id: 1 } });

      const env = {
        services: { main: { baseUri: "http://localhost:3000" } },
        authentication: {},
        config: {},
      };

      await execute("./test.js", env, {});

      expect(mockRegisterDynamicUser).toHaveBeenCalledWith("newUser", {
        username: "testuser",
        password: "testpass",
        service: "main",
      });
    });
  });
});
