import { SlashCommandBuilder, PermissionFlagsBits } from "discord.js";

export default {
  data: new SlashCommandBuilder()
    .setName("timeout")
    .setDescription("Timeout (mute) a member for a specific duration")
    .addUserOption(option =>
      option
        .setName("user")
        .setDescription("User to timeout")
        .setRequired(true)
    )
    .addStringOption(option =>
      option
        .setName("duration")
        .setDescription("Duration (examples: 10m, 1h, 1d)")
        .setRequired(true)
    )
    .addStringOption(option =>
      option
        .setName("reason")
        .setDescription("Reason for timeout")
        .setRequired(false)
    )
    .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers),

  async execute(interaction) {
    await interaction.deferReply({ ephemeral: true });

    const user = interaction.options.getUser("user");
    const durationInput = interaction.options.getString("duration");
    const reason = interaction.options.getString("reason") || "No reason provided";

    // Convert duration input to ms
    const durationMs = parseDuration(durationInput);

    if (!durationMs) {
      return interaction.editReply("❌ Invalid duration format. Use `10m`, `1h`, `1d`, etc.");
    }

    const member = await interaction.guild.members.fetch(user.id).catch(() => null);

    if (!member) {
      return interaction.editReply("❌ Cannot find that user in the server.");
    }

    if (!member.moderatable) {
      return interaction.editReply("❌ I cannot timeout this user (role too high?).");
    }

    try {
      await member.timeout(durationMs, reason);

      await interaction.editReply(
        `⏳ Timed out **${user.tag}** for **${durationInput}**\n📄 Reason: ${reason}`
      );
    } catch (error) {
      console.error(error);
      await interaction.editReply("❌ Failed to timeout the user.");
    }
  }
};

// 🔧 Helper: Parses "10m", "1h", "1d"
function parseDuration(input) {
  const match = input.match(/^(\d+)(s|m|h|d)$/);
  if (!match) return null;

  const value = parseInt(match[1]);
  const unit = match[2];

  const multipliers = {
    s: 1000,
    m: 1000 * 60,
    h: 1000 * 60 * 60,
    d: 1000 * 60 * 60 * 24
  };

  return value * multipliers[unit];
}
