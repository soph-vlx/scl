// src/bot/index.js
import { Client, GatewayIntentBits, Collection } from "discord.js";
import dotenv from "dotenv";
import { loadEvents } from "./handlers/eventHandler.js";
import { loadCommands } from "./handlers/commandHandler.js";

// Load environment variables
dotenv.config();

if (!process.env.DISCORD_TOKEN) {
  console.error("DISCORD_TOKEN is missing in .env");
  process.exit(1);
}

// Create Discord client
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMembers
  ]
});

// Add a commands collection to the client
client.commands = new Collection();

// Load events and commands
await loadEvents(client);
await loadCommands(client);

// Login
client.login(process.env.DISCORD_TOKEN).then(() => {
  console.log("Bot is logging in...");
}).catch((err) => {
  console.error("Error logging in:", err);
});
