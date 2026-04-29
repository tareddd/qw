const User = require("../../../model/user.js");
const functions = require("../../../structs/functions.js");
const fs = require("fs");
const config = JSON.parse(fs.readFileSync("./Config/config.json").toString());

module.exports = {
    commandInfo: {
        name: "backendbanip",
        description: "Ban a user from the backend by their Discord ID.",
        options: [
            {
                name: "discordid",
                description: "The Discord ID of the user to ban.",
                required: true,
                type: 3 // STRING
            },
            {
                name: "reason",
                description: "Reason for the ban (optional).",
                required: false,
                type: 3
            }
        ]
    },
    execute: async (interaction) => {
        await interaction.deferReply({ ephemeral: true });

        if (!config.moderators.includes(interaction.user.id)) {
            return interaction.editReply({ content: "❌ You do not have moderator permissions.", ephemeral: true });
        }

        const discordId = interaction.options.get("discordid").value.trim();
        const reason = interaction.options.get("reason")?.value || "No reason provided.";

        // Validate Discord ID format (17-19 digit snowflake)
        if (!/^\d{17,19}$/.test(discordId)) {
            return interaction.editReply({ content: "❌ Invalid Discord ID format. Must be a 17-19 digit snowflake.", ephemeral: true });
        }

        const targetUser = await User.findOne({ discordId });

        if (!targetUser) {
            return interaction.editReply({ content: `❌ No backend account found linked to Discord ID \`${discordId}\`.`, ephemeral: true });
        }

        if (targetUser.banned) {
            return interaction.editReply({ content: `⚠️ **${targetUser.username}** is already banned.`, ephemeral: true });
        }

        await targetUser.updateOne({ $set: { banned: true } });

        // Kick active sessions
        let refreshToken = global.refreshTokens.findIndex(i => i.accountId == targetUser.accountId);
        if (refreshToken !== -1) global.refreshTokens.splice(refreshToken, 1);

        let accessToken = global.accessTokens.findIndex(i => i.accountId == targetUser.accountId);
        if (accessToken !== -1) {
            global.accessTokens.splice(accessToken, 1);
            let xmppClient = global.Clients.find(c => c.accountId == targetUser.accountId);
            if (xmppClient) xmppClient.client.close();
        }

        if (accessToken !== -1 || refreshToken !== -1) functions.UpdateTokens();

        return interaction.editReply({
            content: `✅ Successfully banned **${targetUser.username}** (Discord: \`${discordId}\`)\n📋 Reason: ${reason}`,
            ephemeral: true
        });
    }
};
