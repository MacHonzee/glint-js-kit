#!/usr/bin/env node
import fs from 'fs';
import path from 'path';
import {spawn} from 'node:child_process';

function spawnCmd(cmd, opts) {
  const spawnedProcess = spawn(
      cmd,
      [],
      {shell: true, ...opts},
  );

  spawnedProcess.stdout.on('data', (data) => {
    process.stdout.write(`[${opts.name}]: ${data}`);
  });

  spawnedProcess.stderr.on('data', (data) => {
    process.stderr.write(`[${opts.name}]: ${data}`);
  });
}

async function start() {
  const cwd = process.cwd();

  const clientPath = cwd.replace(/-server/, '-client');
  if (fs.existsSync(clientPath)) {
    spawnCmd('npm start', {name: 'client', cwd: path.resolve(clientPath)});
  }

  spawnCmd('nodemon', {name: 'server', cwd, env: {NODE_ENV: 'dev'}});
}

export default start;
