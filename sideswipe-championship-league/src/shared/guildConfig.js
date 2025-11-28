import prisma from "./prisma.js";

export async function getGuildConfig(guildId) {
  let config = await prisma.guildConfig.findUnique({
    where: { guildId }
  });

  // If no config exists, create a default one
  if (!config) {
    config = await prisma.guildConfig.create({
      data: { guildId }
    });
  }

  return config;
}

export async function updateGuildConfig(guildId, newData) {
  return prisma.guildConfig.upsert({
    where: { guildId },
    update: newData,
    create: {
      guildId,
      ...newData
    }
  });
}
