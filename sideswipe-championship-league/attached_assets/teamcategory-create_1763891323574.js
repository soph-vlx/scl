const { SlashCommandBuilder, PermissionFlagsBits } = require("discord.js");
const prisma = require("../../lib/prisma");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("teamcategory-create")
    .setDescription("Create a team category manually")
    .addStringOption(o =>
      o.setName("team").setDescription("Team name").setRequired(true)
    )
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

  async execute(interaction) {
    const teamName = interaction.options.getString("team");
    const guild = interaction.guild;

    await interaction.deferReply({ ephemeral: true });

    const team = await prisma.team.findUnique({ where: { name: teamName } });
    if (!team) return interaction.editReply("Team not found.");

    const category = await guild.channels.create({
      name: teamName,
      type: 4,
      permissionOverwrites: [
        { id: guild.id, deny: ["ViewChannel"] },
        { id: team.roleId, allow: ["ViewChannel"] }
      ]
    });

    const channels = [
      { name: "team-chat", type: 0 },
      { name: "staff-chat", type: 0 },
      { name: "announcements", type: 0 },
      { name: "voice", type: 2 }
    ];

    for (const ch of channels) {
      await guild.channels.create({
        name: ch.name,
        type: ch.type,
        parent: category.id,
        permissionOverwrites: [
          { id: guild.id, deny: ["ViewChannel"] },
          { id: team.roleId, allow: ["ViewChannel"] }
        ]
      });
    }

    await prisma.team.update({
      where: { id: team.id },
      data: { categoryId: category.id }
    });

    return interaction.editReply(`Category created for ${teamName}.`);
  }
};
