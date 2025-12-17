import { describe, test, expect, beforeEach, jest } from "@jest/globals";
import fs from "fs";
import path from "path";

// Mock logger
jest.unstable_mockModule("../../../src/cascade/logger.js", () => ({
  getLogger: () => ({
    debug: jest.fn(),
    info: jest.fn(),
    error: jest.fn(),
  }),
}));

// Mock dotenv
jest.unstable_mockModule("dotenv", () => ({
  default: {
    config: jest.fn(),
  },
}));

const { loadEnvironment, loadDatasets, loadImport } = await import("../../../src/cascade/loader.js");

describe("Loader", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("loadEnvironment", () => {
    test("should load environment config from file", async () => {
      // Create a temporary test env file
      const testDir = path.join(process.cwd(), "test", "temp");
      if (!fs.existsSync(testDir)) {
        fs.mkdirSync(testDir, { recursive: true });
      }
      const envPath = path.join(testDir, "test.env.js");
      fs.writeFileSync(
        envPath,
        `export default {
        name: "test-env",
        services: { main: { baseUri: "http://localhost:3000" } },
        authentication: { service: "main", loginEndpoint: "/login", tokenPath: "token", userPath: "user", users: {} },
        config: {}
      };`,
      );

      const env = await loadEnvironment(envPath);

      expect(env.name).toBe("test-env");
      expect(env.services.main.baseUri).toBe("http://localhost:3000");

      // Cleanup
      fs.unlinkSync(envPath);
    });

    test("should load .env file from same directory", async () => {
      const testDir = path.join(process.cwd(), "test", "temp");
      if (!fs.existsSync(testDir)) {
        fs.mkdirSync(testDir, { recursive: true });
      }
      const envPath = path.join(testDir, "test.env.js");
      const dotEnvPath = path.join(testDir, ".env");

      fs.writeFileSync(envPath, `export default { name: "test", services: {}, authentication: {}, config: {} };`);
      fs.writeFileSync(dotEnvPath, "TEST_VAR=test_value");

      await loadEnvironment(envPath);

      // Cleanup
      fs.unlinkSync(envPath);
      if (fs.existsSync(dotEnvPath)) {
        fs.unlinkSync(dotEnvPath);
      }
    });
  });

  describe("loadDatasets", () => {
    test("should load dataset from file", async () => {
      const testDir = path.join(process.cwd(), "test", "temp");
      if (!fs.existsSync(testDir)) {
        fs.mkdirSync(testDir, { recursive: true });
      }
      const datasetPath = path.join(testDir, "test-dataset.js");
      fs.writeFileSync(
        datasetPath,
        `export default async (env, state, options) => ({
        cascade: [
          { endpoint: "/test", service: "main", dtoIn: {} }
        ]
      });`,
      );

      const env = { name: "test" };
      const state = {};
      const options = {};

      const commands = await loadDatasets(datasetPath, env, state, options);

      expect(commands).toHaveLength(1);
      expect(commands[0].endpoint).toBe("/test");

      // Cleanup
      fs.unlinkSync(datasetPath);
    });

    test("should load datasets from directory", async () => {
      const testDir = path.join(process.cwd(), "test", "temp", "datasets");
      if (!fs.existsSync(testDir)) {
        fs.mkdirSync(testDir, { recursive: true });
      }

      fs.writeFileSync(
        path.join(testDir, "a.js"),
        `export default async () => ({ cascade: [{ endpoint: "/a", service: "main" }] });`,
      );
      fs.writeFileSync(
        path.join(testDir, "b.js"),
        `export default async () => ({ cascade: [{ endpoint: "/b", service: "main" }] });`,
      );

      const env = { name: "test" };
      const state = {};
      const options = {};

      const commands = await loadDatasets(testDir, env, state, options);

      expect(commands).toHaveLength(2);
      expect(commands[0].endpoint).toBe("/a"); // Alphabetically sorted
      expect(commands[1].endpoint).toBe("/b");

      // Cleanup
      fs.unlinkSync(path.join(testDir, "a.js"));
      fs.unlinkSync(path.join(testDir, "b.js"));
      fs.rmdirSync(testDir);
    });

    test("should throw error for invalid dataset format", async () => {
      const testDir = path.join(process.cwd(), "test", "temp");
      if (!fs.existsSync(testDir)) {
        fs.mkdirSync(testDir, { recursive: true });
      }
      const datasetPath = path.join(testDir, "invalid.js");
      fs.writeFileSync(datasetPath, `export default async () => ({ invalid: true });`);

      const env = { name: "test" };
      const state = {};
      const options = {};

      await expect(loadDatasets(datasetPath, env, state, options)).rejects.toThrow("cascade");

      // Cleanup
      fs.unlinkSync(datasetPath);
    });
  });

  describe("loadImport", () => {
    test("should load import relative to current dataset", async () => {
      const testDir = path.join(process.cwd(), "test", "temp");
      if (!fs.existsSync(testDir)) {
        fs.mkdirSync(testDir, { recursive: true });
      }

      const currentPath = path.join(testDir, "current.js");
      const importPath = path.join(testDir, "imported.js");

      fs.writeFileSync(
        importPath,
        `export default async () => ({ cascade: [{ endpoint: "/imported", service: "main" }] });`,
      );

      const env = { name: "test" };
      const state = {};
      const options = {};

      const commands = await loadImport("./imported.js", currentPath, env, state, options);

      expect(commands).toHaveLength(1);
      expect(commands[0].endpoint).toBe("/imported");

      // Cleanup
      fs.unlinkSync(importPath);
    });

    test("should throw error when importing non-existent directory", async () => {
      const testDir = path.join(process.cwd(), "test", "temp");
      if (!fs.existsSync(testDir)) {
        fs.mkdirSync(testDir, { recursive: true });
      }

      const currentPath = path.join(testDir, "current.js");

      const env = { name: "test" };
      const state = {};
      const options = {};

      await expect(loadImport("./non-existent-dir", currentPath, env, state, options)).rejects.toThrow();
    });

    test("should throw error when dataset exports non-function", async () => {
      const testDir = path.join(process.cwd(), "test", "temp");
      if (!fs.existsSync(testDir)) {
        fs.mkdirSync(testDir, { recursive: true });
      }
      const datasetPath = path.join(testDir, "invalid-export.js");
      fs.writeFileSync(datasetPath, `export default { invalid: true };`);

      const env = { name: "test" };
      const state = {};
      const options = {};

      await expect(loadDatasets(datasetPath, env, state, options)).rejects.toThrow("must export a default function");

      // Cleanup
      fs.unlinkSync(datasetPath);
    });

    test("should throw error when dataset returns invalid format", async () => {
      const testDir = path.join(process.cwd(), "test", "temp");
      if (!fs.existsSync(testDir)) {
        fs.mkdirSync(testDir, { recursive: true });
      }
      const datasetPath = path.join(testDir, "invalid-format.js");
      fs.writeFileSync(datasetPath, `export default async () => ({ invalid: true });`);

      const env = { name: "test" };
      const state = {};
      const options = {};

      await expect(loadDatasets(datasetPath, env, state, options)).rejects.toThrow("cascade");

      // Cleanup
      fs.unlinkSync(datasetPath);
    });

    test("should throw error when directory not found", async () => {
      const env = { name: "test" };
      const state = {};
      const options = {};

      await expect(loadDatasets("./non-existent-dir", env, state, options)).rejects.toThrow();
    });

    test("should load .env from cwd when not in env dir", async () => {
      const testDir = path.join(process.cwd(), "test", "temp");
      if (!fs.existsSync(testDir)) {
        fs.mkdirSync(testDir, { recursive: true });
      }
      const envPath = path.join(testDir, "test.env.js");
      const cwdEnvPath = path.join(process.cwd(), ".env");

      fs.writeFileSync(envPath, `export default { name: "test", services: {}, authentication: {}, config: {} };`);

      // Create .env in cwd
      if (!fs.existsSync(cwdEnvPath)) {
        fs.writeFileSync(cwdEnvPath, "TEST_VAR=test_value");
      }

      await loadEnvironment(envPath);

      // Cleanup
      fs.unlinkSync(envPath);
      if (fs.existsSync(cwdEnvPath)) {
        fs.unlinkSync(cwdEnvPath);
      }
    });
  });
});
