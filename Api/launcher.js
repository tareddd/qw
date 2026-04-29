const express = require("express");
const app = express.Router();
const User = require("../model/user.js");
const log = require("../structs/log.js");
const bcrypt = require("bcrypt");

// Stockage temporaire des codes (en mémoire, expire après 5 min)
const pendingCodes = new Map(); // discordId -> { code, expires }

function generateCode() {
    const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
    let code = "";
    for (let i = 0; i < 10; i++) {
        if (i === 5) code += "-";
        code += chars[Math.floor(Math.random() * chars.length)];
    }
    return code; // ex: 57GR3-RD634
}

// Login classique email/password
app.get("/api/launcher/login", async (req, res) => {
    const { email, password } = req.query;

    if (!email) return res.status(400).send('The email was not entered.');
    if (!password) return res.status(400).send('The password was not entered.');

    try {
        const user = await User.findOne({ email: email });
        if (!user) return res.status(404).send('User not found.');

        const passwordMatch = await bcrypt.compare(password, user.password);

        if (passwordMatch) {
            return res.status(200).json({
                username: user.username,
                discordId: user.discordId || "",
                avatarHash: user.avatarHash || null,
            });
        } else {
            return res.status(400).send('Error!');
        }
    } catch (err) {
        log.error('Launcher Api Error:', err);
        return res.status(500).send('Error encountered, look at the console');
    }
});

// Envoie un code de vérification en MP Discord
app.get("/api/launcher/send-code", async (req, res) => {
    const { email, password, discordId } = req.query;

    if (!email || !password || !discordId) {
        return res.status(400).json({ error: "Missing fields." });
    }

    try {
        // Vérifie les credentials d'abord
        const user = await User.findOne({ email });
        if (!user) return res.status(404).json({ error: "User not found." });

        const passwordMatch = await bcrypt.compare(password, user.password);
        if (!passwordMatch) return res.status(400).json({ error: "Wrong credentials." });

        // Vérifie que le discordId correspond au compte
        if (user.discordId && user.discordId !== discordId) {
            return res.status(400).json({ error: "Discord ID does not match this account." });
        }

        // Génère le code
        const code = generateCode();
        const expires = Date.now() + 5 * 60 * 1000; // 5 minutes
        pendingCodes.set(discordId, { code, expires });

        // Envoie le MP via le bot Discord — échec immédiat si bot pas prêt
        const discordClient = global.discordClient;
        if (!discordClient) {
            return res.status(500).json({ error: "Bot Discord non disponible. Vérifie le token du bot." });
        }
        try {
            const discordUser = await discordClient.users.fetch(discordId);
            await discordUser.send(
                `🔐 **Code de vérification ${process.env.LAUNCHER_NAME || "Launcher"}**\n\n` +
                `Votre code : \`${code}\`\n\n` +
                `⏱️ Ce code expire dans **5 minutes**.\n` +
                `Ne le partagez à personne.`
            );
        } catch (dmErr) {
            log.error("Failed to send DM:", dmErr);
            return res.status(400).json({ error: "Could not send DM. Make sure your DMs are open." });
        }

        return res.status(200).json({ success: true });
    } catch (err) {
        log.error("Send code error:", err);
        return res.status(500).json({ error: "Server error: " + err.message });
    }
});

// Vérifie le code entré par l'utilisateur
app.get("/api/launcher/verify-code", async (req, res) => {
    const { discordId, code } = req.query;

    if (!discordId || !code) {
        return res.status(400).json({ error: "Missing fields." });
    }

    const entry = pendingCodes.get(discordId);

    if (!entry) {
        return res.status(400).json({ error: "No code found. Request a new one." });
    }

    if (Date.now() > entry.expires) {
        pendingCodes.delete(discordId);
        return res.status(400).json({ error: "Code expired. Request a new one." });
    }

    if (entry.code !== code.toUpperCase().replace(/\s/g, "")) {
        return res.status(400).json({ error: "Wrong code." });
    }

    // Code correct — supprime et retourne succès
    pendingCodes.delete(discordId);
    return res.status(200).json({ success: true });
});

module.exports = app;
