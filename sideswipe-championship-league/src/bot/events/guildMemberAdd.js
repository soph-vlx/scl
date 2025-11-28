import { getGuildConfig } from "../../shared/guildConfig.js";

export default {
  name: "guildMemberAdd",
  async execute(member) {
    console.log(`A new member joined: ${member.user.tag}`);

    const config = await getGuildConfig(member.guild.id);
    const roleId = config.autoroleId;

    if (!roleId) return;

    const role = member.guild.roles.cache.get(roleId);
    if (!role) return console.warn(`Role ${roleId} not found`);

    try {
      await member.roles.add(role);
      console.log(`Autorole applied to ${member.user.tag}`);
    } catch (err) {
      console.error("Failed to apply autorole:", err);
    }
  }
};
