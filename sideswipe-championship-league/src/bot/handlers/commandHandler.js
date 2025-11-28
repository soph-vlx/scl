// src/bot/handlers/commandHandler.js
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export async function loadCommands(client) {
  const commandsPath = path.join(__dirname, "..", "commands");
  const commandFiles = fs.readdirSync(commandsPath).filter(file => file.endsWith(".js"));

  client.commandData = []; // for later when we deploy commands

  for (const file of commandFiles) {
    const filePath = path.join(commandsPath, file);
    const commandModule = await import(`file://${filePath}`);
    const command = commandModule.default;

    if (!command || !command.data || !command.execute) {
      console.warn(`Skipped loading command file ${file} (missing data or execute)`);
      continue;
    }

    client.commands.set(command.data.name, command);
    client.commandData.push(command.data.toJSON());

    console.log(`Loaded command: ${command.data.name}`);
  }
}
