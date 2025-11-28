import { SlashCommandBuilder, PermissionFlagsBits } from "discord.js";
import prisma from "../lib/prisma.js";

export default {
  data: new SlashCommandBuilder()
    .setName("warn")
    .setDescription("Warn a user")
    .addUserOption(option =>
      option
        .setName("user")
        .setDescription("User to warn")
        .setRequired(true)
    )
    .addStringOption(option =>
      option
        .setName("reason")
        .setDescription("Reason for the warning")
        .setRequired(true)
    )
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageMessages),

  async execute(interaction) {
    await interaction.deferReply({ ephemeral: true });

    const user = interaction.options.getUser("user");
    const reason = interaction.options.getString("reason");

    // Insert into database
    await prisma.warning.create({
      data: {
        guildId: interaction.guild.id,
        userId: user.id,
        moderator: interaction.user.id,
        reason
      }
    });

    await interaction.editReply(
      `⚠️ Warned **${user.tag}**\n📄 Reason: ${reason}`
    );
  }
};
