import { describe, test, expect, beforeEach, jest } from "@jest/globals";

// Mock all dependencies
const mockLoadDatasets = jest.fn();
const mockMakeRequest = jest.fn();
const mockResolveDtoIn = jest.fn();
const mockSaveToState = jest.fn();
const mockMergeParams = jest.fn();

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
  });
});
