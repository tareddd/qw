const { MessageEmbed } = require("discord.js");
const User = require("../../../model/user.js");
const functions = require("../../../structs/functions.js");
const fs = require("fs");
const config = JSON.parse(fs.readFileSync("./Config/config.json").toString());

function generatePassword(length = 16) {
    const chars = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789!@#$%&*";
    let password = "";
    for (let i = 0; i < length; i++) {
        password += chars[Math.floor(Math.random() * chars.length)];
    }
    return password;
}

module.exports = {
    commandInfo: {
        name: "create",
        description: "Crée un compte automatiquement avec un email et mot de passe générés.",
        options: [
            {
                name: "username",
                description: "Ton nom d'utilisateur.",
                required: true,
                type: 3
            }
        ],
    },
    execute: async (interaction) => {
        await interaction.deferReply({ ephemeral: true });

        const { options } = interaction;
        const discordId = interaction.user.id;
        const username = options.get("username").value.trim();

        // Vérification âge du compte Discord (minimum 7 jours)
        const accountCreatedAt = interaction.user.createdAt;
        const diffDays = (Date.now() - accountCreatedAt) / (1000 * 60 * 60 * 24);
        if (diffDays < 7) {
            const daysLeft = Math.ceil(7 - diffDays);
            return interaction.editReply({
                content: `❌ Ton compte Discord doit avoir au moins **7 jours**.\nTon compte a **${Math.floor(diffDays)} jour(s)**. Attends encore **${daysLeft} jour(s)**.`,
                ephemeral: true
            });
        }

        // Validations username
        if (username.length < 3) return interaction.editReply({ content: "❌ Le nom d'utilisateur doit faire au moins 3 caractères.", ephemeral: true });
        if (username.length > 25) return interaction.editReply({ content: "❌ Le nom d'utilisateur doit faire moins de 25 caractères.", ephemeral: true });
        if (!/^[a-zA-Z0-9_]+$/.test(username)) return interaction.editReply({ content: "❌ Le nom d'utilisateur ne peut contenir que des lettres, chiffres et underscores.", ephemeral: true });

        // Vérifie si username ou discordId déjà utilisé
        const existingUser = await User.findOne({ username_lower: username.toLowerCase() });
        if (existingUser) return interaction.editReply({ content: "❌ Ce nom d'utilisateur est déjà pris.", ephemeral: true });

        const existingDiscord = await User.findOne({ discordId });
        if (existingDiscord) return interaction.editReply({ content: "❌ Tu as déjà un compte lié à ce Discord.", ephemeral: true });

        // Génère email et mot de passe
        const email = `${username.toLowerCase()}@dev.nexyra`;
        const password = generatePassword(16);

        // Vérifie si email déjà utilisé
        const existingEmail = await User.findOne({ email });
        if (existingEmail) return interaction.editReply({ content: "❌ Cet email est déjà utilisé.", ephemeral: true });

        // Crée le compte
        const resp = await functions.registerUser(discordId, username, email, password);

        if (resp.status >= 400) {
            return interaction.editReply({ content: `❌ Erreur lors de la création : ${resp.message || "Erreur inconnue"}`, ephemeral: true });
        }

        // Envoie les infos en MP
        try {
            const dmUser = await interaction.client.users.fetch(discordId);
            await dmUser.send(
                `✅ **Compte créé avec succès !**\n\n` +
                `👤 **Username :** \`${username}\`\n` +
                `📧 **Email :** \`${email}\`\n` +
                `🔑 **Mot de passe :** \`${password}\`\n\n` +
                `⚠️ Garde ces informations en sécurité, ne les partage à personne.`
            );
        } catch (dmErr) {
            // DMs fermés — on répond en éphémère
            return interaction.editReply({
                content: `✅ Compte créé !\n\n📧 Email : \`${email}\`\n🔑 Mot de passe : \`${password}\`\n\n⚠️ Sauvegarde ces infos, elles ne seront plus affichées.`,
                ephemeral: true
            });
        }

        const embed = new MessageEmbed()
            .setTitle("✅ Compte créé")
            .setDescription(`Les informations de connexion ont été envoyées en **message privé**.`)
            .setColor("#22c55e")
            .addFields(
                { name: "Username", value: username, inline: true },
                { name: "Discord", value: interaction.user.tag, inline: true }
            )
            .setThumbnail(interaction.user.avatarURL({ format: "png", dynamic: true, size: 256 }))
            .setTimestamp()
            .setFooter({ text: "Reload Backend", iconURL: "https://i.imgur.com/2RImwlb.png" });

        interaction.editReply({ embeds: [embed], ephemeral: true });
    }
};
