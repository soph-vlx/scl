// src/bot/events/interactionCreate.js
export default {
  name: "interactionCreate",
  async execute(interaction) {
    if (!interaction.isChatInputCommand()) return;

    const command = interaction.client.commands.get(interaction.commandName);
    if (!command) return;

    try {
      await command.execute(interaction);
    } catch (error) {
      console.error("Error executing command:", error);

      // Only reply if no reply or defer has already happened
      if (!interaction.replied && !interaction.deferred) {
        await interaction.reply({
          content: "There was an error while executing this command.",
          ephemeral: true
        });
      }
    }
  }
};
