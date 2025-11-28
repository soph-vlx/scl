const { SlashCommandBuilder, PermissionFlagsBits } = require("discord.js");
const prisma = require("../../lib/prisma");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("leaderrole-create")
    .setDescription("Create a leader role for someone")
    .addStringOption(o =>
      o.setName("leader").setDescription("Leader name").setRequired(true)
    )
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

  async execute(interaction) {
    const leaderName = interaction.options.getString("leader");

    await interaction.deferReply({ ephemeral: true });

    const role = await interaction.guild.roles.create({
      name: `${leaderName} (Leader)`
    });

    await prisma.leaderRole.create({
      data: { name: leaderName, roleId: role.id }
    });

    return interaction.editReply(`Leader role created for ${leaderName}.`);
  }
};
