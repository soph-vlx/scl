import { spawn } from 'child_process';

console.log('Starting SCL System...');

let backend, frontend, discordBot;
let isShuttingDown = false;

function shutdown() {
  if (isShuttingDown) return;
  isShuttingDown = true;
  console.log('Shutting down...');
  if (backend) backend.kill();
  if (frontend) frontend.kill();
  if (discordBot) discordBot.kill();
  setTimeout(() => process.exit(0), 1000);
}

backend = spawn('node', ['api-scl/index.js'], {
  stdio: 'inherit',
  env: { ...process.env }
});

backend.on('error', (err) => {
  console.error('Failed to start backend:', err);
  shutdown();
});

backend.on('exit', (code) => {
  console.log(`Backend process exited with code ${code}`);
  if (!isShuttingDown) {
    console.error('Backend exited unexpectedly');
    shutdown();
  }
});

setTimeout(() => {
  frontend = spawn('node', ['frontend-server.js'], {
    stdio: 'inherit',
    env: { ...process.env }
  });

  frontend.on('error', (err) => {
    console.error('Failed to start frontend:', err);
    shutdown();
  });

  frontend.on('exit', (code) => {
    console.log(`Frontend process exited with code ${code}`);
    if (!isShuttingDown) {
      console.error('Frontend exited unexpectedly');
      shutdown();
    }
  });
}, 2000);

// Start Discord bot
setTimeout(() => {
  console.log('Starting Discord bot...');
  discordBot = spawn('node', ['src/index.js'], {
    stdio: 'inherit',
    env: { ...process.env }
  });

  discordBot.on('error', (err) => {
    console.error('Failed to start Discord bot:', err);
    shutdown();
  });

  discordBot.on('exit', (code) => {
    console.log(`Discord bot process exited with code ${code}`);
    if (!isShuttingDown) {
      console.error('Discord bot exited unexpectedly');
      shutdown();
    }
  });
}, 3000);

process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);
