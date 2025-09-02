const { spawn } = require('child_process');
const fs = require('fs');

console.log('Starting server with error capture...');

const server = spawn('node', ['dist/server.js'], {
  cwd: process.cwd(),
  stdio: ['pipe', 'pipe', 'pipe']
});

let stdout = '';
let stderr = '';

server.stdout.on('data', (data) => {
  const output = data.toString();
  stdout += output;
  console.log('STDOUT:', output);
});

server.stderr.on('data', (data) => {
  const output = data.toString();
  stderr += output;
  console.log('STDERR:', output);
});

server.on('close', (code) => {
  console.log(`Server process exited with code ${code}`);
  
  const errorLog = {
    exitCode: code,
    timestamp: new Date().toISOString(),
    stdout: stdout,
    stderr: stderr
  };
  
  fs.writeFileSync('error-capture.json', JSON.stringify(errorLog, null, 2));
  console.log('Error details written to error-capture.json');
});

server.on('error', (error) => {
  console.log('Process error:', error.message);
  fs.writeFileSync('process-error.txt', `Process Error: ${error.message}\nStack: ${error.stack}`);
});

// Kill after 10 seconds if still running
setTimeout(() => {
  if (!server.killed) {
    console.log('Killing server after timeout');
    server.kill();
  }