// src/bot/events/ready.js
import { ActivityType } from 'discord.js';
import prisma from '../lib/prisma.js';

async function updatePresence(client) {
  try {
    const teamCount = await prisma.sclTeam.count();
    const maxTeams = 32;
    
    client.user.setActivity({
      name: `searching for teams - found ${teamCount}/${maxTeams}`,
      type: ActivityType.Watching
    });
    
    console.log(`🔄 Updated presence: ${teamCount}/${maxTeams} teams`);
  } catch (error) {
    console.error('Failed to update bot presence:', error);
  }
}

export default {
  name: "ready",
  once: true,
  async execute(client) {
    console.log(`✅ Logged in as ${client.user.tag}`);
    
    // Set initial presence
    await updatePresence(client);
    
    // Update presence every 5 minutes (300000ms)
    setInterval(() => updatePresence(client), 300000);
  }
};
