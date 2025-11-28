import { SlashCommandBuilder } from "discord.js";
import prisma from "../lib/prisma.js";

export default {
  data: new SlashCommandBuilder()
    .setName("matchresult-png")
    .setDescription("Submit all screenshots (BO5) for automated stats processing.")
    .addStringOption(option =>
      option
        .setName("home-team")
        .setDescription("Home team name.")
        .setRequired(true)
    )
    .addStringOption(option =>
      option
        .setName("opponent-team")
        .setDescription("Opponent team name.")
        .setRequired(true)
    )
    .addIntegerOption(option =>
      option
        .setName("matchday")
        .setDescription("Matchday number.")
        .setRequired(true)
    )
    .addStringOption(option =>
      option
        .setName("game1")
        .setDescription("Screenshot URL for Game 1.")
        .setRequired(true)
    )
    .addStringOption(option =>
      option
        .setName("game2")
        .setDescription("Screenshot URL for Game 2.")
        .setRequired(true)
    )
    .addStringOption(option =>
      option
        .setName("game3")
        .setDescription("Screenshot URL for Game 3.")
        .setRequired(true)
    )
    .addStringOption(option =>
      option
        .setName("game4")
        .setDescription("Screenshot URL for Game 4.")
        .setRequired(true)
    )
    .addStringOption(option =>
      option
        .setName("game5")
        .setDescription("Screenshot URL for Game 5.")
        .setRequired(true)
    ),

  async execute(interaction) {
    await interaction.deferReply({ ephemeral: true });

    const homeTeam = interaction.options.getString("home-team");
    const opponentTeam = interaction.options.getString("opponent-team");
    const matchday = interaction.options.getInteger("matchday");

    const urls = {
      game1: interaction.options.getString("game1"),
      game2: interaction.options.getString("game2"),
      game3: interaction.options.getString("game3"),
      game4: interaction.options.getString("game4"),
      game5: interaction.options.getString("game5"),
    };

    // Basic URL validation
    for (const [key, url] of Object.entries(urls)) {
      if (!url.startsWith("http")) {
        return interaction.editReply(`The URL for ${key} is invalid.`);
      }
    }

    try {
      // Save entry
      await prisma.matchScreenshot.create({
        data: {
          homeTeam,
          opponentTeam,
          matchday,
          game1: urls.game1,
          game2: urls.game2,
          game3: urls.game3,
          game4: urls.game4,
          game5: urls.game5,
          uploaderId: interaction.user.id,
          processed: false,
        },
      });

      return interaction.editReply(
        `Screenshots for **${homeTeam} vs. ${opponentTeam}** (Matchday ${matchday}) were submitted successfully.\nProcessing will begin shortly.`
      );
    } catch (err) {
      console.error("DB Error:", err);
      return interaction.editReply("An error occurred while saving the screenshots.");
    }
  }
};
