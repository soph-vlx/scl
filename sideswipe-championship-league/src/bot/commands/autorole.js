import { SlashCommandBuilder, PermissionFlagsBits } from "discord.js";
import { updateGuildConfig } from "../../shared/guildConfig.js";

export default {
  data: new SlashCommandBuilder()
    .setName("autorole")
    .setDescription("Manage autorole settings")
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageRoles)
    .addSubcommand(sub =>
      sub
        .setName("set")
        .setDescription("Set the autorole")
        .addRoleOption(option =>
          option
            .setName("role")
            .setDescription("Role to apply on join")
            .setRequired(true)
        )
    )
    .addSubcommand(sub =>
      sub
        .setName("disable")
        .setDescription("Disable autorole")
    ),

  async execute(interaction) {
    await interaction.deferReply({ ephemeral: true });

    const sub = interaction.options.getSubcommand();
    const guildId = interaction.guild.id;

    if (sub === "set") {
      const role = interaction.options.getRole("role");

      await updateGuildConfig(guildId, { autoroleId: role.id });

      return interaction.editReply(`✅ Autorole set to **${role.name}**`);
    }

    if (sub === "disable") {
      await updateGuildConfig(guildId, { autoroleId: null });

      return interaction.editReply("❌ Autorole disabled.");
    }
  }
};
