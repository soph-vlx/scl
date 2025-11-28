import { SlashCommandBuilder, PermissionFlagsBits } from "discord.js";
import prisma from "../lib/prisma.js";

export default {
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

    await interaction.deferReply({ ephemeral: true });

    try {
      const member = await interaction.guild.members.fetch(user.id);
      const team = await prisma.sclTeam.findFirst({ where: { name: teamName } });
      
      if (!team) {
        return interaction.editReply("❌ Team does not exist.");
      }

      // Verify base roles exist
      if (!team.baseLeaderRoleId || !team.basePlayerRoleId) {
        return interaction.editReply(
          `❌ Team **${teamName}** is missing base role(s).\n` +
          `This team may have been created before the role system update.\n` +
          `Please recreate the team or contact an administrator.`
        );
      }

      let customLeaderRole;
      let basePlayerRoleAdded = false;
      let baseLeaderRoleAdded = false;
      
      try {
        // Create custom cosmetic role with correct format
        customLeaderRole = await interaction.guild.roles.create({
          name: `${leaderName} (${teamName})`,
          reason: `Custom role for leader ${leaderName}`
        });

        // Assign custom role
        await member.roles.add(customLeaderRole.id);

        // Assign base player role (leaders inherit all player permissions)
        await member.roles.add(team.basePlayerRoleId);
        basePlayerRoleAdded = true;

        // Assign base leader role (grants additional leader permissions)
        await member.roles.add(team.baseLeaderRoleId);
        baseLeaderRoleAdded = true;

        // Save leader to database
        await prisma.leader.create({
          data: {
            name: leaderName,
            discordId: user.id,
            roleId: customLeaderRole.id,
            teamId: team.id
          }
        });
      } catch (error) {
        // Rollback: remove all assigned roles and delete custom role
        console.error("Operation failed, rolling back Discord resources:", error);
        if (baseLeaderRoleAdded && team.baseLeaderRoleId) {
          await member.roles.remove(team.baseLeaderRoleId).catch(() => {});
        }
        if (basePlayerRoleAdded && team.basePlayerRoleId) {
          await member.roles.remove(team.basePlayerRoleId).catch(() => {});
        }
        if (customLeaderRole) {
          await member.roles.remove(customLeaderRole.id).catch(() => {});
          await customLeaderRole.delete().catch(() => {});
        }
        throw error;
      }

      return interaction.editReply(
        `✅ Leader **${leaderName}** added to **${teamName}**!\n` +
        `- Custom Role: <@&${customLeaderRole.id}> (cosmetic)\n` +
        `- Player Role: <@&${team.basePlayerRoleId}> (player permissions)\n` +
        `- Leader Role: <@&${team.baseLeaderRoleId}> (leader permissions)`
      );
    } catch (error) {
      console.error("Error in leader-add command:", error);
      return interaction.editReply(`❌ Failed to add leader: ${error.message}`);
    }
  }
};
