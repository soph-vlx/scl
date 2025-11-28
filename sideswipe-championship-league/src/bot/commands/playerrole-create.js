import { SlashCommandBuilder, PermissionFlagsBits } from "discord.js";
import prisma from "../lib/prisma.js";

export default {
  data: new SlashCommandBuilder()
    .setName("playerrole-create")
    .setDescription("Create a player role for a team")
    .addStringOption(o =>
      o.setName("team").setDescription("Team name").setRequired(true)
    )
    .addStringOption(o =>
      o.setName("player").setDescription("Player name").setRequired(true)
    )
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

  async execute(interaction) {
    const teamName = interaction.options.getString("team");
    const playerName = interaction.options.getString("player");
    const guild = interaction.guild;

    await interaction.deferReply({ ephemeral: true });

    const team = await prisma.sclTeam.findFirst({
      where: { name: teamName }
    });

    if (!team) return interaction.editReply("Team does not exist.");

    const role = await guild.roles.create({
      name: `${playerName} (${teamName})`
    });

    await prisma.playerRole.create({
      data: {
        name: playerName,
        roleId: role.id,
        teamId: team.id
      }
    });

    return interaction.editReply(`Player role created for ${playerName}.`);
  }
};
