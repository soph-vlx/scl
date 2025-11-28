// src/index.js
console.log("Starting VELOX...");

import('./bot/index.js')
  .then(() => {
    console.log("Bot started successfully.");
  })
  .catch((err) => {
    console.error("Failed to start bot:", err);
  });
