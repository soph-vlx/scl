import { SlashCommandBuilder, PermissionFlagsBits } from "discord.js";
import prisma from "../lib/prisma.js";

export default {
  data: new SlashCommandBuilder()
    .setName("warnings")
    .setDescription("View a user's warnings")
    .addUserOption(option =>
      option
        .setName("user")
        .setDescription("User to view warnings for")
        .setRequired(true)
    )
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageMessages),

  async execute(interaction) {
    await interaction.deferReply({ ephemeral: true });

    const user = interaction.options.getUser("user");
    const guildId = interaction.guild.id;

    const userWarnings = await prisma.warning.findMany({
      where: {
        guildId,
        userId: user.id
      },
      orderBy: { createdAt: "asc" }
    });

    if (userWarnings.length === 0) {
      return interaction.editReply(`✅ **${user.tag}** has no warnings.`);
    }

    const formatted = userWarnings
      .map((warn, index) => {
        const date = new Date(warn.createdAt).toLocaleString();
        return `**${index + 1}.** ${warn.reason}\n🕒 ${date}\n👮 <@${warn.moderator}>`;
      })
      .join("\n\n");

    await interaction.editReply(
      `⚠️ **Warnings for ${user.tag}:**\n\n${formatted}`
    );
  }
};
