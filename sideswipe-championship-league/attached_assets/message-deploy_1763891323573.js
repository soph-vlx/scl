const { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder } = require("discord.js");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("deploy-message")
    .setDescription("Deploy a predefined message")
    .addStringOption(o =>
      o.setName("type")
        .setDescription("Type of message")
        .setRequired(true)
        .addChoices(
          { name: "Match Update", value: "match" },
          { name: "Standings", value: "standings" },
          { name: "Rules", value: "rules" },
          { name: "Custom", value: "custom" }
        )
    )
    .addStringOption(o =>
      o.setName("text").setDescription("Custom text").setRequired(false)
    )
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

  async execute(interaction) {
    const type = interaction.options.getString("type");
    const text = interaction.options.getString("text") ?? "";

    const embed = new EmbedBuilder()
      .setColor("Random")
      .setTimestamp();

    if (type === "match") embed.setTitle("Match Update").setDescription(text);
    if (type === "standings") embed.setTitle("Standings").setDescription(text);
    if (type === "rules") embed.setTitle("Rules").setDescription(text);
    if (type === "custom") embed.setTitle("Message").setDescription(text);

    return interaction.reply({ embeds: [embed] });
  }
};
