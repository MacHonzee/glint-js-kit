#!/usr/bin/env node
import yargs from "yargs";
import { hideBin } from "yargs/helpers";
import start from "./start.js";
import cascadeCommand from "./cascade.js";

async function main() {
  const args = yargs(hideBin(process.argv)).argv;
  const scriptName = args._[0];

  switch (scriptName) {
    case "start":
      return await start();
    case "cascade":
      return await cascadeCommand();
    default:
      return console.error(`Unrecognized command '${scriptName}'.`);
  }
}

await main();
