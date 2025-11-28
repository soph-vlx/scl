const { SlashCommandBuilder, PermissionFlagsBits } = require("discord.js");
const prisma = require("../../lib/prisma");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("leader-add")
    .setDescription("Add a leader to a team")
    .addStringOption(o =>
      o.setName("team").setDescription("Team name").setRequired(true)
    )
    .addUserOption(o =>
      o.setName("user").setDescription("Leader user").setRequired(true)
    )
    .addStringOption(o =>
      o.setName("leadername").setDescription("Leader name").setRequired(true)
    )
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

  async execute(interaction) {
    const teamName = interaction.options.getString("team");
    const user = interaction.options.getUser("user");
    const leaderName = interaction.options.getString("leadername");
    const member = await interaction.guild.members.fetch(user.id);

    await interaction.deferReply({ ephemeral: true });

    const team = await prisma.team.findUnique({ where: { name: teamName } });
    if (!team) return interaction.editReply("Team does not exist.");

    const role = await interaction.guild.roles.create({
      name: `${leaderName} (Leader)`
    });

    await member.roles.add(role.id);

    await prisma.leader.create({
      data: {
        name: leaderName,
        discordId: user.id,
        roleId: role.id,
        teamId: team.id
      }
    });

    return interaction.editReply(`Leader ${leaderName} added.`);
  }
};
