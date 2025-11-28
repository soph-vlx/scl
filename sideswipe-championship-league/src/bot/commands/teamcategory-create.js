import { SlashCommandBuilder, PermissionFlagsBits, PermissionsBitField } from "discord.js";
import prisma from "../lib/prisma.js";

export default {
  data: new SlashCommandBuilder()
    .setName("teamcategory-create")
    .setDescription("Create a team category with channels and advanced permissions")
    .addStringOption(o =>
      o.setName("team").setDescription("Team name (must be created first with /team-create)").setRequired(true)
    )
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

  async execute(interaction) {
    const teamName = interaction.options.getString("team");
    const guild = interaction.guild;

    await interaction.deferReply({ ephemeral: true });

    let category;
    const createdChannels = [];

    try {
      // Fetch team from database
      const team = await prisma.sclTeam.findFirst({ where: { name: teamName } });
      if (!team) {
        return interaction.editReply("❌ Team not found. Create it first with `/team-create`.");
      }

      if (!team.discordRoleId) {
        return interaction.editReply("❌ Team has no Discord role. Something went wrong during team creation.");
      }

      if (team.discordChannelId) {
        return interaction.editReply("❌ Team already has a category. Use Discord's interface to manage channels.");
      }

      // Verify base roles exist
      if (!team.basePlayerRoleId || !team.baseLeaderRoleId) {
        return interaction.editReply(
          `❌ Team **${teamName}** is missing base role(s).\n` +
          `This team may have been created before the role system update.\n` +
          `Please recreate the team or contact an administrator.`
        );
      }

      // Create category with minimal permissions (only deny @everyone)
      try {
        category = await guild.channels.create({
          name: teamName,
          type: 4, // Category
          permissionOverwrites: [
            { id: guild.id, deny: [PermissionsBitField.Flags.ViewChannel] }
          ]
        });
      } catch (error) {
        throw new Error(`Failed to create category: ${error.message}`);
      }

      // Create channels with BASE ROLE permissions (simplified and scalable)
      const channelConfigs = [
        {
          name: "team-chat",
          type: 0, // Text - All team members (both players and leaders)
          permissions: [
            { id: guild.id, deny: [PermissionsBitField.Flags.ViewChannel] },
            { id: team.basePlayerRoleId, allow: [PermissionsBitField.Flags.ViewChannel, PermissionsBitField.Flags.SendMessages] },
            { id: team.baseLeaderRoleId, allow: [PermissionsBitField.Flags.ViewChannel, PermissionsBitField.Flags.SendMessages] }
          ]
        },
        {
          name: "staff-chat",
          type: 0, // Text - LEADERS ONLY (base leader role)
          permissions: [
            { id: guild.id, deny: [PermissionsBitField.Flags.ViewChannel] },
            { id: team.basePlayerRoleId, deny: [PermissionsBitField.Flags.ViewChannel] }, // Explicitly deny players
            { id: team.baseLeaderRoleId, allow: [PermissionsBitField.Flags.ViewChannel, PermissionsBitField.Flags.SendMessages] }
          ]
        },
        {
          name: "announcements",
          type: 0, // Text - PLAYERS VIEW ONLY, LEADERS CAN POST
          permissions: [
            { id: guild.id, deny: [PermissionsBitField.Flags.ViewChannel] },
            {
              id: team.basePlayerRoleId,
              allow: [PermissionsBitField.Flags.ViewChannel],
              deny: [PermissionsBitField.Flags.SendMessages, PermissionsBitField.Flags.AddReactions]
            },
            {
              id: team.baseLeaderRoleId,
              allow: [PermissionsBitField.Flags.ViewChannel, PermissionsBitField.Flags.SendMessages, PermissionsBitField.Flags.AddReactions]
            }
          ]
        },
        {
          name: "voice",
          type: 2, // Voice - All team members (both players and leaders)
          permissions: [
            { id: guild.id, deny: [PermissionsBitField.Flags.ViewChannel] },
            { id: team.basePlayerRoleId, allow: [PermissionsBitField.Flags.ViewChannel, PermissionsBitField.Flags.Connect, PermissionsBitField.Flags.Speak] },
            { id: team.baseLeaderRoleId, allow: [PermissionsBitField.Flags.ViewChannel, PermissionsBitField.Flags.Connect, PermissionsBitField.Flags.Speak] }
          ]
        }
      ];

      // Create all channels
      try {
        for (const config of channelConfigs) {
          const channel = await guild.channels.create({
            name: config.name,
            type: config.type,
            parent: category.id,
            permissionOverwrites: config.permissions
          });
          createdChannels.push(channel);
        }
      } catch (channelError) {
        // Rollback: delete any created channels and category
        console.error("Channel creation failed, rolling back Discord resources:", channelError);
        for (const channel of createdChannels) {
          await channel.delete().catch(() => {});
        }
        if (category) await category.delete().catch(() => {});
        throw new Error(`Failed to create channels: ${channelError.message}`);
      }

      // Update database with category ID
      try {
        await prisma.sclTeam.update({
          where: { id: team.id },
          data: { discordChannelId: category.id }
        });
      } catch (dbError) {
        // Rollback: delete all created channels and category
        console.error("Database write failed, rolling back Discord resources:", dbError);
        for (const channel of createdChannels) {
          await channel.delete().catch(() => {});
        }
        if (category) await category.delete().catch(() => {});
        throw new Error(`Database error: ${dbError.message}`);
      }

      return interaction.editReply(
        `✅ Category and channels created for **${teamName}**!\n` +
        `- Category: **${category.name}**\n` +
        `- Channels created:\n` +
        `  • team-chat: All members can chat\n` +
        `  • staff-chat: Leaders only\n` +
        `  • announcements: Players view-only, leaders can post\n` +
        `  • voice: All members can join\n\n` +
        `✨ Permissions managed via base roles:\n` +
        `  • Player (${teamName}): <@&${team.basePlayerRoleId}>\n` +
        `  • Leader (${teamName}): <@&${team.baseLeaderRoleId}>`
      );
    } catch (error) {
      console.error("Error in teamcategory-create command:", error);
      return interaction.editReply(`❌ Failed to create category: ${error.message}`);
    }
  }
};
