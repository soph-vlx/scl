// src/bot/commands/team-create.js
import { SlashCommandBuilder, PermissionFlagsBits } from "discord.js";
import prisma from "../lib/prisma.js";

export default {
  data: new SlashCommandBuilder()
    .setName("team-create")
    .setDescription("Create a new team, role, and category")
    .addStringOption((option) =>
      option
        .setName("name")
        .setDescription("Name of the team")
        .setRequired(true),
    )
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

  async execute(interaction) {
    const teamName = interaction.options.getString("name");
    const guild = interaction.guild;

    await interaction.deferReply({ ephemeral: true });

    let teamRole, basePlayerRole, baseLeaderRole;

    try {
      // Check if team exists
      const existing = await prisma.sclTeam.findFirst({
        where: { name: teamName },
      });

      if (existing) {
        return interaction.editReply(`❌ Team **${teamName}** already exists.`);
      }

      // Create 3 roles: main team role, base player role, base leader role
      try {
        // Main team role
        teamRole = await guild.roles.create({
          name: teamName,
          color: "Blue",
          reason: `Team role for ${teamName}`,
        });

        // Base player role (used for channel permissions)
        basePlayerRole = await guild.roles.create({
          name: `Player (${teamName})`,
          color: "Blue",
          reason: `Base player role for ${teamName}`,
        });

        // Base leader role (used for channel permissions)
        baseLeaderRole = await guild.roles.create({
          name: `Leader (${teamName})`,
          color: "Blue",
          reason: `Base leader role for ${teamName}`,
        });
      } catch (error) {
        // Rollback: delete any created roles if any step fails
        console.error("Role creation failed, rolling back Discord resources:", error);
        if (teamRole) await teamRole.delete().catch(() => {});
        if (basePlayerRole) await basePlayerRole.delete().catch(() => {});
        if (baseLeaderRole) await baseLeaderRole.delete().catch(() => {});
        throw new Error(`Failed to create roles: ${error.message}`);
      }

      // Save to database with all 3 role IDs
      try {
        await prisma.sclTeam.create({
          data: {
            name: teamName,
            discordRoleId: teamRole.id,
            basePlayerRoleId: basePlayerRole.id,
            baseLeaderRoleId: baseLeaderRole.id,
            discordChannelId: null,
          },
        });
      } catch (dbError) {
        // Rollback: delete all roles if database write fails
        console.error("Database write failed, rolling back Discord resources:", dbError);
        if (teamRole) await teamRole.delete().catch(() => {});
        if (basePlayerRole) await basePlayerRole.delete().catch(() => {});
        if (baseLeaderRole) await baseLeaderRole.delete().catch(() => {});
        throw new Error(`Database error: ${dbError.message}`);
      }

      return interaction.editReply(
        `✅ Team **${teamName}** created!\n` +
          `- Team Role: <@&${teamRole.id}>\n` +
          `- Player Role: <@&${basePlayerRole.id}>\n` +
          `- Leader Role: <@&${baseLeaderRole.id}>\n\n` +
          `⚠️ Next steps:\n` +
          `1. Add leaders: \`/leader-add ${teamName} @user <name>\`\n` +
          `2. Add players: \`/player-add ${teamName} @user <name>\`\n` +
          `3. Create channels: \`/teamcategory-create ${teamName}\``,
      );
    } catch (error) {
      console.error("Error in team-create command:", error);
      return interaction.editReply(
        `❌ Failed to create team: ${error.message}`,
      );
    }
  },
};
