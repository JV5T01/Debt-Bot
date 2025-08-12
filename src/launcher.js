const { spawn } = require('child_process');

function startBot() {
  console.log('Starting bot...');
  const botProcess = spawn('node', ['index.js'], { stdio: 'inherit' });

  botProcess.on('exit', (code) => {
    if (code === 1) {
      // Restart requested
      console.log('Restart requested, restarting bot...');
      startBot();
    } else if (code === 0) {
      // Shutdown requested, do not restart
      console.log('Shutdown requested, exiting launcher.');
    } else {
      // Unexpected exit
      console.log(`Bot exited with code ${code}. Not restarting.`);
    }
  });
}

startBot();
