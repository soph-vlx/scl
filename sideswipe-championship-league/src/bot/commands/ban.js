import { SlashCommandBuilder, PermissionFlagsBits } from "discord.js";

export default {
  data: new SlashCommandBuilder()
    .setName("ban")
    .setDescription("Ban a member from the server")
    .addUserOption(option =>
      option
        .setName("user")
        .setDescription("User to ban")
        .setRequired(true)
    )
    .addStringOption(option =>
      option
        .setName("reason")
        .setDescription("Reason for the ban")
        .setRequired(false)
    )
    .addIntegerOption(option =>
      option
        .setName("delete_days")
        .setDescription("Delete the user's messages (0–7 days)")
        .setMinValue(0)
        .setMaxValue(7)
        .setRequired(false)
    )
    .setDefaultMemberPermissions(PermissionFlagsBits.BanMembers),

  async execute(interaction) {
    await interaction.deferReply({ ephemeral: true });

    const user = interaction.options.getUser("user");
    const reason = interaction.options.getString("reason") || "No reason provided";
    const deleteDays = interaction.options.getInteger("delete_days") || 0;

    // Fetch guild member
    const member = await interaction.guild.members
      .fetch(user.id)
      .catch(() => null);

    if (!member) {
      return interaction.editReply("❌ Cannot find that user in the server.");
    }

    if (!member.bannable) {
      return interaction.editReply("❌ I cannot ban this user (role too high?).");
    }

    try {
      await member.ban({
        reason,
        deleteMessageSeconds: deleteDays * 24 * 60 * 60 // convert days → seconds
      });

      await interaction.editReply(
        `🔨 Banned **${user.tag}**\n📄 Reason: ${reason}\n🗑 Deleted Message Days: ${deleteDays}`
      );

    } catch (error) {
      console.error(error);
      await interaction.editReply("❌ Failed to ban the user.");
    }
  }
};
