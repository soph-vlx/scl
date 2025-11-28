import { SlashCommandBuilder, PermissionFlagsBits } from "discord.js";
import prisma from "../lib/prisma.js";

export default {
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
    
    await interaction.deferReply({ ephemeral: true });

    try {
      const guildMember = await interaction.guild.members.fetch(user.id);
      const team = await prisma.sclTeam.findFirst({ where: { name: teamName } });
      
      if (!team) {
        return interaction.editReply("❌ Team does not exist.");
      }

      // Verify base player role exists
      if (!team.basePlayerRoleId) {
        return interaction.editReply(
          `❌ Team **${teamName}** is missing base player role.\n` +
          `This team may have been created before the role system update.\n` +
          `Please recreate the team or contact an administrator.`
        );
      }

      // Create individual player role and assign all roles
      let customPlayerRole;
      let teamRoleAdded = false;
      let basePlayerRoleAdded = false;
      
      try {
        // Create custom cosmetic role
        customPlayerRole = await guildMember.guild.roles.create({
          name: `${playerName} (${teamName})`,
          reason: `Custom role for player ${playerName}`
        });

        // Assign custom role
        await guildMember.roles.add(customPlayerRole.id);

        // Assign base player role (grants channel permissions)
        await guildMember.roles.add(team.basePlayerRoleId);
        basePlayerRoleAdded = true;

        // Assign team role if it exists
        if (team.discordRoleId) {
          await guildMember.roles.add(team.discordRoleId);
          teamRoleAdded = true;
        }

        // Save player to database
        await prisma.sclPlayer.create({
          data: {
            displayName: playerName,
            discordId: user.id,
            role: "PLAYER",
            teamId: team.id
          }
        });
      } catch (error) {
        // Rollback: remove all assigned roles and delete custom role
        console.error("Operation failed, rolling back Discord resources:", error);
        if (teamRoleAdded && team.discordRoleId) {
          await guildMember.roles.remove(team.discordRoleId).catch(() => {});
        }
        if (basePlayerRoleAdded && team.basePlayerRoleId) {
          await guildMember.roles.remove(team.basePlayerRoleId).catch(() => {});
        }
        if (customPlayerRole) {
          await guildMember.roles.remove(customPlayerRole.id).catch(() => {});
          await customPlayerRole.delete().catch(() => {});
        }
        throw error;
      }

      return interaction.editReply(
        `✅ Player **${playerName}** added to **${teamName}**!\n` +
        `- Custom Role: <@&${customPlayerRole.id}> (cosmetic)\n` +
        `- Player Role: <@&${team.basePlayerRoleId}> (permissions)`
      );
    } catch (error) {
      console.error("Error in player-add command:", error);
      return interaction.editReply(`❌ Failed to add player: ${error.message}`);
    }
  }
};
