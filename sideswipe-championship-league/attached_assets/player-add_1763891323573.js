const { SlashCommandBuilder, PermissionFlagsBits } = require("discord.js");
const prisma = require("../../lib/prisma");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("player-add")
    .setDescription("Add a player to a team and assign roles")
    .addStringOption(o =>
      o.setName("team").setDescription("Team name").setRequired(true)
    )
    .addUserOption(o =>
      o.setName("user").setDescription("Discord user").setRequired(true)
    )
    .addStringOption(o =>
      o.setName("playername").setDescription("Player name").setRequired(true)
    )
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

  async execute(interaction) {
    const teamName = interaction.options.getString("team");
    const user = interaction.options.getUser("user");
    const playerName = interaction.options.getString("playername");
    const guildMember = await interaction.guild.members.fetch(user.id);

    await interaction.deferReply({ ephemeral: true });

    const team = await prisma.team.findUnique({ where: { name: teamName } });
    if (!team) return interaction.editReply("Team does not exist.");

    const playerRole = await guildMember.guild.roles.create({
      name: `${playerName} (${teamName})`
    });

    await guildMember.roles.add(playerRole.id);
    await guildMember.roles.add(team.roleId);

    await prisma.player.create({
      data: {
        name: playerName,
        discordId: user.id,
        roleId: playerRole.id,
        teamId: team.id
      }
    });

    return interaction.editReply(`Player ${playerName} added to ${teamName}.`);
  }
};
