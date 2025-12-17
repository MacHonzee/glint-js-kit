import fs from "fs";
import path from "path";
import dotenv from "dotenv";
import { getLogger } from "./logger.js";

/**
 * Load environment configuration from file
 * @param {string} envPath - Path to environment config file
 * @returns {Promise<import('./types.js').EnvironmentConfig>} Environment configuration
 */
export async function loadEnvironment(envPath) {
  const logger = getLogger();
  logger.debug(`Loading environment from: ${envPath}`);

  // Load .env file if it exists (in same directory as env config or cwd)
  const envDir = path.dirname(path.resolve(envPath));
  const envFile = path.join(envDir, ".env");
  if (fs.existsSync(envFile)) {
    dotenv.config({ path: envFile });
    logger.debug(`Loaded .env from: ${envFile}`);
  } else {
    // Try current working directory
    const cwdEnvFile = path.join(process.cwd(), ".env");
    if (fs.existsSync(cwdEnvFile)) {
      dotenv.config({ path: cwdEnvFile });
      logger.debug(`Loaded .env from: ${cwdEnvFile}`);
    }
  }

  // Load environment config
  const envModule = await import(path.resolve(envPath));
  const env = envModule.default || envModule;

  logger.info(`Loaded environment: ${env.name}`);
  return env;
}

/**
 * Load a single dataset file
 * @param {string} datasetPath - Path to dataset file
 * @param {import('./types.js').EnvironmentConfig} env - Environment configuration
 * @param {import('./types.js').State} state - Current execution state
 * @param {import('./types.js').ExecutionOptions} options - Execution options
 * @returns {Promise<import('./types.js').DatasetResult>} Dataset result
 */
async function loadDatasetFile(datasetPath, env, state, options) {
  const logger = getLogger();
  const resolvedPath = path.resolve(datasetPath);

  logger.debug(`Loading dataset file: ${resolvedPath}`);

  const datasetModule = await import(`file://${resolvedPath}`);
  const datasetFunction = datasetModule.default || datasetModule;

  if (typeof datasetFunction !== "function") {
    throw new Error(`Dataset file ${resolvedPath} must export a default function`);
  }

  const result = await datasetFunction(env, state, options.options || {});

  if (!result || !result.cascade) {
    throw new Error(`Dataset file ${resolvedPath} must return an object with 'cascade' array`);
  }

  return result;
}

/**
 * Load datasets from a directory (all .js files alphabetically sorted)
 * @param {string} datasetDir - Path to dataset directory
 * @param {import('./types.js').EnvironmentConfig} env - Environment configuration
 * @param {import('./types.js').State} state - Current execution state
 * @param {import('./types.js').ExecutionOptions} options - Execution options
 * @returns {Promise<import('./types.js').Command[]>} Array of commands from all datasets
 */
async function loadDatasetDirectory(datasetDir, env, state, options) {
  const logger = getLogger();
  const resolvedDir = path.resolve(datasetDir);

  logger.debug(`Loading datasets from directory: ${resolvedDir}`);

  if (!fs.existsSync(resolvedDir)) {
    throw new Error(`Dataset directory not found: ${resolvedDir}`);
  }

  const files = fs
    .readdirSync(resolvedDir)
    .filter((file) => file.endsWith(".js"))
    .sort();

  const allCommands = [];

  for (const file of files) {
    const filePath = path.join(resolvedDir, file);
    const dataset = await loadDatasetFile(filePath, env, state, options);
    allCommands.push(...dataset.cascade);
  }

  logger.info(`Loaded ${files.length} dataset files from directory`);
  return allCommands;
}

/**
 * Load datasets from path (file or directory)
 * @param {string} datasetPath - Path to dataset file or directory
 * @param {import('./types.js').EnvironmentConfig} env - Environment configuration
 * @param {import('./types.js').State} state - Current execution state
 * @param {import('./types.js').ExecutionOptions} options - Execution options
 * @returns {Promise<import('./types.js').Command[]>} Array of commands
 */
export async function loadDatasets(datasetPath, env, state, options) {
  const resolvedPath = path.resolve(datasetPath);
  const stats = fs.statSync(resolvedPath);

  if (stats.isDirectory()) {
    return await loadDatasetDirectory(resolvedPath, env, state, options);
  } else {
    const dataset = await loadDatasetFile(resolvedPath, env, state, options);
    return dataset.cascade;
  }
}

/**
 * Load a dataset from import path (relative to current dataset file)
 * @param {string} importPath - Relative path to dataset file or directory
 * @param {string} currentDatasetPath - Path of the current dataset file (for resolving relative imports)
 * @param {import('./types.js').EnvironmentConfig} env - Environment configuration
 * @param {import('./types.js').State} state - Current execution state
 * @param {import('./types.js').ExecutionOptions} options - Execution options
 * @returns {Promise<import('./types.js').Command[]>} Array of commands
 */
export async function loadImport(importPath, currentDatasetPath, env, state, options) {
  const logger = getLogger();
  const currentDir = path.dirname(path.resolve(currentDatasetPath));
  const resolvedImportPath = path.resolve(currentDir, importPath);

  logger.debug(`Loading import: ${importPath} (resolved to: ${resolvedImportPath})`);

  return await loadDatasets(resolvedImportPath, env, state, options);
}
