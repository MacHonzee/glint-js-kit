import { loadDatasets, loadImport } from "./loader.js";
import { createState, resolveDtoIn, saveToState, mergeParams } from "./state-manager.js";
import { makeRequest } from "./http-client.js";
import { runAssertions } from "./assertions.js";
import { getLogger } from "./logger.js";
import path from "path";

/**
 * Process a single command
 * @param {import('./types.js').Command} command - Command to process
 * @param {import('./types.js').EnvironmentConfig} env - Environment configuration
 * @param {import('./types.js').State} state - Current execution state
 * @param {import('./types.js').ExecutionOptions} options - Execution options
 * @param {string} currentDatasetPath - Path of current dataset (for resolving imports)
 */
async function processCommand(command, env, state, options, currentDatasetPath) {
  const logger = getLogger();

  // Handle import commands
  if (command.import) {
    logger.info(`Importing dataset: ${command.import}`);

    // Merge params into state for imported dataset
    const importState = mergeParams(state, command.params);

    // Resolve import path relative to current dataset
    const currentDir = path.dirname(path.resolve(currentDatasetPath));
    const resolvedImportPath = path.resolve(currentDir, command.import);

    // Load and process imported commands
    const importedCommands = await loadImport(command.import, currentDatasetPath, env, importState, options);

    // Use resolved import path for nested imports
    // If it's a directory, we'll use the directory path (nested imports from directory files will be relative to that directory)
    const importDatasetPath = resolvedImportPath;

    // Process each imported command recursively
    for (const importedCommand of importedCommands) {
      await processCommand(importedCommand, env, importState, options, importDatasetPath);
    }

    return;
  }

  // Handle API commands
  if (!command.endpoint || !command.service) {
    throw new Error("Command must have either 'import' or both 'endpoint' and 'service'");
  }

  // Resolve dtoIn
  const dtoIn = resolveDtoIn(command.dtoIn, state);

  // Dry run mode
  if (options.dryRun) {
    logger.info(`[DRY RUN] Would execute ${command.method || "POST"} ${command.endpoint}`);
    logger.debug(`[DRY RUN] dtoIn: ${JSON.stringify(dtoIn, null, 2)}`);
    return;
  }

  // Make request
  let response;
  try {
    response = await makeRequest(command, env, state, dtoIn);
  } catch (error) {
    // If expectError is defined, the error should have been allowed by makeRequest
    // But if it wasn't, we need to check if we should run expectError assertions
    if (command.expectError && error.response) {
      // This shouldn't happen if expectError auto-allows, but handle it just in case
      response = error.response;
    } else {
      throw error;
    }
  }

  // Run assertions
  const isErrorResponse = response.status >= 400;

  if (command.expectError && isErrorResponse) {
    // Run expectError assertions on error responses
    runAssertions(command.expectError, response);
  } else if (command.expect && !isErrorResponse) {
    // Run expect assertions on successful responses
    runAssertions(command.expect, response);
  } else if (command.expect && isErrorResponse) {
    // If expect is defined but we got an error, that's a failure
    throw new Error(`Expected successful response but got ${response.status}. Use expectError for error responses.`);
  } else if (command.expectError && !isErrorResponse) {
    // If expectError is defined but we got success, that's a failure
    throw new Error(`Expected error response but got ${response.status}. Use expect for successful responses.`);
  }

  // Save response if saveAs is specified
  if (command.saveAs && response.data) {
    saveToState(state, command.saveAs, response.data);
    logger.debug(`Saved response to state.${command.saveAs}`);
  }
}

/**
 * Execute datasets
 * @param {string} datasetPath - Path to dataset file or directory
 * @param {import('./types.js').EnvironmentConfig} env - Environment configuration
 * @param {import('./types.js').ExecutionOptions} options - Execution options
 * @returns {Promise<import('./types.js').State>} Final execution state
 */
export async function execute(datasetPath, env, options) {
  const logger = getLogger();

  logger.info(`Starting execution of dataset: ${datasetPath}`);

  // Initialize state
  const state = createState();

  // Load datasets
  const commands = await loadDatasets(datasetPath, env, state, options);

  logger.info(`Loaded ${commands.length} command(s) to execute`);

  // Process each command
  const resolvedDatasetPath = path.resolve(datasetPath);
  const currentDatasetPath = path.isAbsolute(datasetPath) ? resolvedDatasetPath : path.join(process.cwd(), datasetPath);

  for (let i = 0; i < commands.length; i++) {
    const command = commands[i];
    logger.debug(`Processing command ${i + 1}/${commands.length}`);

    try {
      await processCommand(command, env, state, options, currentDatasetPath);
    } catch (error) {
      logger.error(`Command ${i + 1} failed: ${error.message}`);
      if (error.response) {
        logger.error(`Response status: ${error.response.status}`);
        logger.error(`Response data: ${JSON.stringify(error.response.data, null, 2)}`);
      }
      throw error;
    }
  }

  logger.info("Execution completed successfully");
  return state;
}
