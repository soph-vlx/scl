import { SlashCommandBuilder, PermissionFlagsBits } from "discord.js";

export default {
  data: new SlashCommandBuilder()
    .setName("kick")
    .setDescription("Kick a member from the server")
    .addUserOption(option =>
      option
        .setName("user")
        .setDescription("User to kick")
        .setRequired(true)
    )
    .addStringOption(option =>
      option
        .setName("reason")
        .setDescription("Reason for the kick")
        .setRequired(false)
    )
    .setDefaultMemberPermissions(PermissionFlagsBits.KickMembers),

  async execute(interaction) {
    await interaction.deferReply({ ephemeral: true });

    const user = interaction.options.getUser("user");
    const reason = interaction.options.getString("reason") || "No reason provided";

    const member = await interaction.guild.members.fetch(user.id).catch(() => null);

    if (!member) {
      return interaction.editReply("❌ Cannot find that user in the server.");
    }

    if (!member.kickable) {
      return interaction.editReply("❌ I cannot kick this user (role too high?).");
    }

    try {
      await member.kick(reason);
      await interaction.editReply(`👢 Kicked **${user.tag}**\n📄 Reason: ${reason}`);
    } catch (error) {
      console.error(error);
      await interaction.editReply("❌ Failed to kick the user.");
    }
  }
};
