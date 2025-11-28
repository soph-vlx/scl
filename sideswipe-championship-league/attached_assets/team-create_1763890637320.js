const { SlashCommandBuilder, PermissionFlagsBits } = require("discord.js");
const prisma = require("../../lib/prisma"); // update path based on your project

module.exports = {
  data: new SlashCommandBuilder()
    .setName("team-create")
    .setDescription("Create a new team, role, and category")
    .addStringOption(option =>
      option.setName("name")
        .setDescription("Name of the team")
        .setRequired(true)
    )
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

  async execute(interaction) {
    const teamName = interaction.options.getString("name");
    const guild = interaction.guild;

    await interaction.deferReply({ ephemeral: true });

    // Check if team exists
    const existing = await prisma.team.findUnique({
      where: { name: teamName }
    });

    if (existing) {
      return interaction.editReply(`❌ Team **${teamName}** already exists.`);
    }

    // Create role
    const role = await guild.roles.create({
      name: teamName,
      color: "Random",
      reason: `Team role for ${teamName}`
    });

    // Create category
    const category = await guild.channels.create({
      name: teamName,
      type: 4, // Category
      permissionOverwrites: [
        {
          id: guild.id, // @everyone
          deny: ["ViewChannel"]
        },
        {
          id: role.id,
          allow: ["ViewChannel"]
        }
      ]
    });

    // Create channels under the category
    const channelsToCreate = [
      { name: "team-chat", type: 0 }, // text
      { name: "staff-chat", type: 0 }, // text
      { name: "announcements", type: 0 }, // text
      { name: "voice", type: 2 } // voice
    ];

    for (const ch of channelsToCreate) {
      await guild.channels.create({
        name: ch.name,
        type: ch.type,
        parent: category.id,
        permissionOverwrites: [
          {
            id: guild.id,
            deny: ["ViewChannel"]
          },
          {
            id: role.id,
            allow: ["ViewChannel"]
          }
        ]
      });
    }

    // Save to database
    await prisma.team.create({
      data: {
        name: teamName,
        roleId: role.id,
        categoryId: category.id
      }
    });

    return interaction.editReply(
      `✅ Team **${teamName}** created!\n` +
      `- Role: <@&${role.id}>\n` +
      `- Category: **${category.name}**`
    );
  }
};
