const { spawn } = require('child_process');
const fs = require('fs');

const child = spawn('node', ['dist/server.js'], {
  stdio: ['pipe', 'pipe', 'pipe']
});

let output = '';
let errorOutput = '';

child.stdout.on('data', (data) => {
  const text = data.toString();
  output += text;
  console.log('STDOUT:', text);
});

child.stderr.on('data', (data) => {
  const text = data.toString();
  errorOutput += text;
  console.log('STDERR:', text);
});

child.on('close', (code) => {
  console.log(`Process exited with code: ${code}`);
  console.log('=== FULL OUTPUT ===');
  console.log(output);
  console.log('=== FULL ERROR OUTPUT ===');
  console.log(errorOutput);
  
  // Write to file
  fs.writeFileSync('debug-output.txt', `Exit Code: ${code}\n\nSTDOUT:\n${output}\n\nSTDERR:\n${errorOutput}`);
});

child.on('error', (err) => {
  console.log('Process error:', err);
});

// Kill after 10 seconds if still running
setTimeout(() => {
  if (!child.killed) {
    child.kill();
    console.log('Process killed after timeout');