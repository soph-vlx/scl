import { SlashCommandBuilder } from "discord.js";

export default {
  data: new SlashCommandBuilder()
    .setName("help")
    .setDescription("Shows basic help information"),

  async execute(interaction) {
    try {
      await interaction.deferReply({ ephemeral: true });

      await interaction.editReply({
        content: "📘 **Help Menu**\nThe bot is working perfectly!"
      });

    } catch (err) {
      console.error("Help command error:", err);

      if (!interaction.replied && !interaction.deferred) {
        await interaction.reply({
          content: "❌ An error occurred while running /help",
          ephemeral: true
        });
      }
    }
  }
};
