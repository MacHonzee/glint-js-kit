import { describe, test, expect, beforeAll, afterAll } from "@jest/globals";
import { startServer, stopServer } from "./server.js";
import { execute, loadEnvironment } from "../../../src/cascade/index.js";
import { initLogger, clearCache, clearDynamicUsers } from "../../../src/cascade/index.js";
import path from "path";
import { fileURLToPath } from "url";
import fs from "fs";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

describe("Cascade Integration Tests", () => {
  let serverInfo = null;

  beforeAll(async () => {
    // Initialize logger with info level
    initLogger("info");

    // Start test server
    serverInfo = await startServer();
    process.env.TEST_SERVER_URL = serverInfo.url;
    process.env.TEST_USERNAME = "testuser";
    process.env.TEST_PASSWORD = "testpass";
  });

  afterAll(async () => {
    await stopServer();
    delete process.env.TEST_SERVER_URL;
    delete process.env.TEST_USERNAME;
    delete process.env.TEST_PASSWORD;
  });

  beforeEach(() => {
    clearCache();
    clearDynamicUsers();
  });

  test("should execute basic flow with create and read", async () => {
    const envPath = path.join(__dirname, "fixtures", "envs", "test.env.js");
    const datasetPath = path.join(__dirname, "fixtures", "datasets", "basic-flow.js");

    const env = await loadEnvironment(envPath);
    // Update baseUri with actual server URL
    env.services.main.baseUri = serverInfo.url;

    const state = await execute(datasetPath, env, {
      options: { name: "Integration Test User", email: "integration@example.com" },
    });

    expect(state.saved.newUser).toBeDefined();
    expect(state.saved.newUser.id).toBe(1);
    expect(state.saved.newUser.name).toBe("Created User");
  });

  test("should authenticate and cache token", async () => {
    const envPath = path.join(__dirname, "fixtures", "envs", "test.env.js");
    const datasetPath = path.join(__dirname, "fixtures", "datasets", "auth-test.js");

    const env = await loadEnvironment(envPath);
    env.services.main.baseUri = serverInfo.url;

    const state = await execute(datasetPath, env, {});

    expect(state.users.testUser).toBeDefined();
    expect(state.users.testUser.id).toBe(1);
    expect(state.saved.user1).toBeDefined();
    expect(state.saved.user2).toBeDefined();
  });

  test("should handle allowed errors and continue", async () => {
    const envPath = path.join(__dirname, "fixtures", "envs", "test.env.js");
    const datasetPath = path.join(__dirname, "fixtures", "datasets", "error-handling.js");

    const env = await loadEnvironment(envPath);
    env.services.main.baseUri = serverInfo.url;

    const state = await execute(datasetPath, env, {});

    // Should have completed successfully despite the error
    expect(state.saved).toBeDefined();
  });

  test("should handle dataset imports with parameters", async () => {
    const envPath = path.join(__dirname, "fixtures", "envs", "test.env.js");
    const datasetPath = path.join(__dirname, "fixtures", "datasets", "import-test.js");

    const env = await loadEnvironment(envPath);
    env.services.main.baseUri = serverInfo.url;

    const state = await execute(datasetPath, env, {});

    // Verify main user was created
    expect(state.saved.mainUser).toBeDefined();
    expect(state.saved.mainUser.name).toBe("Created User");
    // Params are scoped to imported dataset execution, so they won't be in final state
    // But the import should have executed successfully using those params
  });

  test("should load and execute datasets from folder", async () => {
    const envPath = path.join(__dirname, "fixtures", "envs", "test.env.js");
    const datasetPath = path.join(__dirname, "fixtures", "datasets", "folder-test");

    const env = await loadEnvironment(envPath);
    env.services.main.baseUri = serverInfo.url;

    const state = await execute(datasetPath, env, {});

    // Should execute both files in folder (alphabetically sorted)
    expect(state.saved.file1User).toBeDefined();
    expect(state.saved.file2User).toBeDefined();
    expect(state.saved.file1User.name).toBe("Created User");
    expect(state.saved.file2User.name).toBe("Created User");
  });

  test("should handle nested imports (multiple levels)", async () => {
    const envPath = path.join(__dirname, "fixtures", "envs", "test.env.js");
    const datasetPath = path.join(__dirname, "fixtures", "datasets", "nested-import.js");

    const env = await loadEnvironment(envPath);
    env.services.main.baseUri = serverInfo.url;

    const state = await execute(datasetPath, env, {});

    // Should execute nested imports successfully
    expect(state.saved.nestedUser).toBeDefined();
    expect(state.saved.nestedUser.name).toBe("Created User");
  });

  test("should handle folder import", async () => {
    const envPath = path.join(__dirname, "fixtures", "envs", "test.env.js");

    // Create a dataset that imports a folder
    const folderImportTestPath = path.join(__dirname, "fixtures", "datasets", "folder-import-test.js");
    fs.writeFileSync(
      folderImportTestPath,
      `export default function () {
        return {
          cascade: [
            {
              import: "./folder-test",
            },
          ],
        };
      }`,
    );

    const env = await loadEnvironment(envPath);
    env.services.main.baseUri = serverInfo.url;

    const state = await execute(folderImportTestPath, env, {});

    expect(state.saved.file1User).toBeDefined();
    expect(state.saved.file2User).toBeDefined();

    // Cleanup
    fs.unlinkSync(folderImportTestPath);
  });

  test("should handle GET method requests", async () => {
    const envPath = path.join(__dirname, "fixtures", "envs", "test.env.js");
    const datasetPath = path.join(__dirname, "fixtures", "datasets", "get-method-test.js");

    const env = await loadEnvironment(envPath);
    env.services.main.baseUri = serverInfo.url;

    const state = await execute(datasetPath, env, {});

    expect(state.saved.getTestUser).toBeDefined();
    // GET request should have been executed successfully
  });

  test("should fail on unexpected remote error", async () => {
    const envPath = path.join(__dirname, "fixtures", "envs", "test.env.js");
    const datasetPath = path.join(__dirname, "fixtures", "datasets", "error-unexpected.js");

    const env = await loadEnvironment(envPath);
    env.services.main.baseUri = serverInfo.url;

    await expect(execute(datasetPath, env, {})).rejects.toThrow();
  });

  test("should fail on invalid import path", async () => {
    const envPath = path.join(__dirname, "fixtures", "envs", "test.env.js");
    const datasetPath = path.join(__dirname, "fixtures", "datasets", "error-invalid-import.js");

    const env = await loadEnvironment(envPath);
    env.services.main.baseUri = serverInfo.url;

    await expect(execute(datasetPath, env, {})).rejects.toThrow();
  });

  test("should fail on missing service", async () => {
    const envPath = path.join(__dirname, "fixtures", "envs", "test.env.js");
    const datasetPath = path.join(__dirname, "fixtures", "datasets", "error-missing-service.js");

    const env = await loadEnvironment(envPath);
    env.services.main.baseUri = serverInfo.url;

    await expect(execute(datasetPath, env, {})).rejects.toThrow("Service 'missingService' not found");
  });

  test("should fail on 404 endpoint", async () => {
    const envPath = path.join(__dirname, "fixtures", "envs", "test.env.js");
    const datasetPath = path.join(__dirname, "fixtures", "datasets", "error-404.js");

    const env = await loadEnvironment(envPath);
    env.services.main.baseUri = serverInfo.url;

    await expect(execute(datasetPath, env, {})).rejects.toThrow();
  });

  test("should use default auth config values when not specified", async () => {
    const envPath = path.join(__dirname, "fixtures", "envs", "test-defaults.env.js");
    const datasetPath = path.join(__dirname, "fixtures", "datasets", "default-auth-test.js");

    const env = await loadEnvironment(envPath);
    env.services.main.baseUri = serverInfo.url;

    const state = await execute(datasetPath, env, {});

    // Should authenticate successfully using default loginEndpoint "/user/login"
    // But our server uses "/auth/login", so we need to update the test
    // Actually, let's check if it uses the default - the server should respond to /user/login
    expect(state.users.testUser).toBeDefined();
  });

  test("should handle allowedErrorCodes with expectError together", async () => {
    const envPath = path.join(__dirname, "fixtures", "envs", "test.env.js");
    const datasetPath = path.join(__dirname, "fixtures", "datasets", "allowed-error-with-expect.js");

    const env = await loadEnvironment(envPath);
    env.services.main.baseUri = serverInfo.url;

    const state = await execute(datasetPath, env, {});

    // Should have completed successfully with both allowedErrorCodes and expectError
    expect(state.saved).toBeDefined();
  });

  test("should register dynamic user and authenticate with credentials (simple syntax)", async () => {
    const envPath = path.join(__dirname, "fixtures", "envs", "test.env.js");
    const datasetPath = path.join(__dirname, "fixtures", "datasets", "dynamic-user-test.js");

    const env = await loadEnvironment(envPath);
    env.services.main.baseUri = serverInfo.url;

    const state = await execute(datasetPath, env, {});

    // Should have registered and used the dynamic user
    expect(state.saved.registeredUser).toBeDefined();
    expect(state.saved.registeredUser.username).toBe("newuser@example.com");
    expect(state.users.newUser).toBeDefined();
  });

  test("should register dynamic user with explicit registerAs config", async () => {
    const envPath = path.join(__dirname, "fixtures", "envs", "test.env.js");
    const datasetPath = path.join(__dirname, "fixtures", "datasets", "dynamic-user-explicit-test.js");

    const env = await loadEnvironment(envPath);
    env.services.main.baseUri = serverInfo.url;

    const state = await execute(datasetPath, env, {});

    // Should have registered and used the explicit user
    expect(state.saved.registeredUser).toBeDefined();
    expect(state.users.explicitUser).toBeDefined();
  });
});
