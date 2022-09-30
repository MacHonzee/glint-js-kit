#!/usr/bin/env node
import fs from 'fs';
import {spawn} from 'child_process';

async function start() {
  const current = process.cwd();

  console.log('-> current', current);

  if (current.endsWith('-client')) {
    spawn( 'npm start',
        {shell: true, stdio: 'inherit', cwd: current},
    );
    return;
  }

  const clientPath = current.replace(/-server/, '-client');
  if (fs.existsSync(clientPath)) {
    spawn('npm start',
        {shell: true, stdio: 'inherit', cwd: clientPath},
    );
  }

  spawn( 'nodemon ./app.js',
      {shell: true, stdio: 'inherit', env: {NODE_ENV: 'dev'}, cwd: current},
  );
}

export default start;
