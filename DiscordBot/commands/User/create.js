const { MessageEmbed } = require("discord.js");
const User = require("../../../model/user.js")
const functions = require("../../../structs/functions.js");

module.exports = {
    commandInfo: {
        name: "create",
        description: "Creates an account on Reload Backend.",
        options: [
            {
                name: "email",
                description: "Your email.",
                required: true,
                type: 3
            },
            {
                name: "username",
                description: "Your username.",
                required: true,
                type: 3
            },
            {
                name: "password",
                description: "Your password.",
                required: true,
                type: 3
            }
        ],
    },
    execute: async (interaction) => {
        await interaction.deferReply({ ephemeral: true });

        const { options } = interaction;

        const discordId = interaction.user.id;

        // Vérification âge du compte Discord (minimum 1 semaine = 7 jours)
        const accountCreatedAt = interaction.user.createdAt;
        const now = new Date();
        const diffMs = now - accountCreatedAt;
        const diffDays = diffMs / (1000 * 60 * 60 * 24);

        if (diffDays < 7) {
            const daysLeft = Math.ceil(7 - diffDays);
            return interaction.editReply({
                content: `❌ Your Discord account must be at least **7 days old** to create an account.\nYour account is **${Math.floor(diffDays)} day(s)** old. Please wait **${daysLeft} more day(s)**.`,
                ephemeral: true
            });
        }
        const email = options.get("email").value;
        const username = options.get("username").value;
        const password = options.get("password").value;

        const plainEmail = options.get('email').value;
        const plainUsername = options.get('username').value;

        const existingEmail = await User.findOne({ email: plainEmail });
        const existingUser = await User.findOne({ username: plainUsername });

        const emailFilter = /^([a-zA-Z0-9_\.\-])+\@(([a-zA-Z0-9\-])+\.)+([a-zA-Z0-9]{2,4})+$/;
        if (!emailFilter.test(email)) {
            return interaction.editReply({ content: "You did not provide a valid email address!", ephemeral: true });
        }
        if (existingEmail) {
            return interaction.editReply({ content: "Email is already in use, please choose another one.", ephemeral: true });
        }
        if (existingUser) {
            return interaction.editReply({ content: "Username already exists. Please choose a different one.", ephemeral: true });
        }
        if (username.length >= 25) {
            return interaction.editReply({ content: "Your username must be less than 25 characters long.", ephemeral: true });
        }
        if (username.length < 3) {
            return interaction.editReply({ content: "Your username must be at least 3 characters long.", ephemeral: true });
        }
        if (password.length >= 128) {
            return interaction.editReply({ content: "Your password must be less than 128 characters long.", ephemeral: true });
        }
        if (password.length < 4) {
            return interaction.editReply({ content: "Your password must be at least 4 characters long.", ephemeral: true });
        }

        await functions.registerUser(discordId, username, email, password).then(resp => {
            let embed = new MessageEmbed()
            .setColor(resp.status >= 400 ? "#ff0000" : "#56ff00")
            .setThumbnail(interaction.user.avatarURL({ format: 'png', dynamic: true, size: 256 }))
            .addFields({
                name: "Message",
                value: "Successfully created an account.",
            }, {
                name: "Username",
                value: username,
            }, {
                name: "Discord Tag",
                value: interaction.user.tag,
            })
            .setTimestamp()
            .setFooter({
                text: "Reload Backend",
                iconURL: "https://i.imgur.com/2RImwlb.png"
            })

            if (resp.status >= 400) return interaction.editReply({ embeds: [embed], ephemeral: true });

            (interaction.channel ? interaction.channel : interaction.user).send({ embeds: [embed] });
            interaction.editReply({ content: "You successfully created an account!", ephemeral: true });
        });
    }
}