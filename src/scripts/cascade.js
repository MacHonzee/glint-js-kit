#!/usr/bin/env node
import yargs from "yargs";
import { hideBin } from "yargs/helpers";
import { execute, loadEnvironment, initLogger } from "../cascade/index.js";

async function cascadeCommand() {
  const argv = yargs(hideBin(process.argv))
    .option("dataset", {
      alias: "d",
      type: "string",
      demandOption: true,
      describe: "Path to dataset file or directory",
    })
    .option("env", {
      alias: "e",
      type: "string",
      demandOption: true,
      describe: "Path to environment config file",
    })
    .option("option", {
      alias: "o",
      type: "string",
      array: true,
      describe: "Pass options as key=value (repeatable)",
    })
    .option("log-level", {
      alias: "l",
      type: "string",
      choices: ["error", "info", "debug"],
      default: "info",
      describe: "Log level",
    })
    .option("dry-run", {
      type: "boolean",
      default: false,
      describe: "Print commands without executing",
    })
    .help().argv;

  // Initialize logger
  initLogger(argv.logLevel);

  // Parse options
  const options = {};
  if (argv.option) {
    for (const opt of argv.option) {
      const [key, value] = opt.split("=");
      if (key && value) {
        options[key] = value;
      }
    }
  }

  try {
    // Load environment
    const env = await loadEnvironment(argv.env);

    // Execute datasets
    const state = await execute(argv.dataset, env, {
      logLevel: argv.logLevel,
      dryRun: argv.dryRun,
      options,
    });

    console.log("\nExecution completed successfully!");
    console.log("Final state:", JSON.stringify(state, null, 2));
  } catch (error) {
    console.error("\nExecution failed:", error);
    if (error.response) {
      console.error("Response status:", error.response.status);
      console.error("Response data:", JSON.stringify(error.response.data, null, 2));
    }
    process.exit(1);
  }
}

export default cascadeCommand;
