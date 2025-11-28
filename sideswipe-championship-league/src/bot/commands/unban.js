import { SlashCommandBuilder, PermissionFlagsBits } from "discord.js";

export default {
  data: new SlashCommandBuilder()
    .setName("unban")
    .setDescription("Unban a user by their ID")
    .addStringOption(option =>
      option
        .setName("userid")
        .setDescription("The ID of the user to unban")
        .setRequired(true)
    )
    .addStringOption(option =>
      option
        .setName("reason")
        .setDescription("Reason for unbanning")
        .setRequired(false)
    )
    .setDefaultMemberPermissions(PermissionFlagsBits.BanMembers),

  async execute(interaction) {
    await interaction.deferReply({ ephemeral: true });

    const userId = interaction.options.getString("userid");
    const reason = interaction.options.getString("reason") || "No reason provided";

    try {
      await interaction.guild.members.unban(userId, reason);

      await interaction.editReply(
        `🔓 Unbanned <@${userId}>\n📄 Reason: ${reason}`
      );
    } catch (err) {
      console.error(err);
      await interaction.editReply(
        "❌ Failed to unban the user. Are you sure the ID is correct?"
      );
    }
  }
};
