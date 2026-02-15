#!/usr/bin/env node
/**
 * Start Next.js dev server cleanly:
 * - Frees ports 3000 and 3001
 * - Removes .next/dev/lock so no "another instance running" error
 * - Runs next dev
 * Use when: "localhost refused to connect" or "Unable to acquire lock"
 */

const { execSync, spawn } = require('child_process');
const path = require('path');
const fs = require('fs');

function run(cmd, silent = false) {
  try {
    execSync(cmd, {
      stdio: silent ? 'ignore' : 'inherit',
      shell: true,
    });
  } catch (_) {
    // ignore errors (e.g. no process to kill)
  }
}

// Kill processes on port 3000 and 3001 (macOS/Linux)
run('lsof -ti :3000 | xargs kill -9 2>/dev/null', true);
run('lsof -ti :3001 | xargs kill -9 2>/dev/null', true);

// Remove dev lock so Next can start
const lockPath = path.join(__dirname, '..', '.next', 'dev', 'lock');
if (fs.existsSync(lockPath)) {
  fs.unlinkSync(lockPath);
  console.log('Removed .next/dev/lock');
}

// Start Next.js
const next = spawn('npx', ['next', 'dev'], {
  stdio: 'inherit',
  shell: true,
  cwd: path.join(__dirname, '..'),
});

next.on('error', (err) => {
  console.error(err);
  process.exit(1);
});
next.on('exit', (code) => process.exit(code ?? 0));
