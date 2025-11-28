import { SlashCommandBuilder, PermissionFlagsBits } from "discord.js";

export default {
  data: new SlashCommandBuilder()
    .setName("purge")
    .setDescription("Delete a number of messages")
    .addIntegerOption(option =>
      option
        .setName("amount")
        .setDescription("Number of messages to delete (1–100)")
        .setRequired(true)
    )
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageMessages),

  async execute(interaction) {
    await interaction.deferReply({ ephemeral: true });

    const amount = interaction.options.getInteger("amount");

    if (amount < 1 || amount > 100) {
      return interaction.editReply("❌ Amount must be between 1 and 100.");
    }

    try {
      const deleted = await interaction.channel.bulkDelete(amount, true);

      await interaction.editReply(
        `🧹 Deleted **${deleted.size}** messages.`
      );

    } catch (error) {
      console.error(error);
      await interaction.editReply("❌ Failed to delete messages.");
    }
  }
};
