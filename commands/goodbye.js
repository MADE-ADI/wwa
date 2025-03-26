const fs = require('fs');
const path = require('path');

async function sayGoodbye(sock, chatId, removedMembers, botName) {
    try {
        // Dapatkan metadata grup
        const groupMetadata = await sock.groupMetadata(chatId);
        const groupName = groupMetadata.subject;
        const memberCount = groupMetadata.participants.length;
        const groupDesc = groupMetadata.desc || 'Tidak ada deskripsi';

        // Cek apakah ada pengaturan kustom
        const sessionDir = path.join(__dirname, `../bot-sessions/${botName}/group-settings`);
        const settingsFile = path.join(sessionDir, `${chatId.split('@')[0]}.json`);
        
        let useCustomMessage = false;
        let goodbyeMessage = '';
        
        if (fs.existsSync(settingsFile)) {
            const groupSettings = JSON.parse(fs.readFileSync(settingsFile, 'utf-8'));
            
            // Periksa apakah fitur goodbye diaktifkan
            // Check both the general enabled flag and the specific goodbyeEnabled flag
            if (!groupSettings.enabled || groupSettings.goodbyeEnabled === false) {
                return; // Jika dinonaktifkan, jangan kirim pesan goodbye
            }
            
            // Gunakan pesan kustom jika ada
            if (groupSettings.goodbye) {
                useCustomMessage = true;
                goodbyeMessage = groupSettings.goodbye;
            }
        }

        // Jika tidak ada pesan kustom, gunakan default
        if (!useCustomMessage) {
            goodbyeMessage = 'Goodbye @user 👋 Semoga Silaturahmi tetap terjalin!';
        }

        // Siapkan pesan untuk setiap anggota yang keluar
        for (const member of removedMembers) {
            // Ganti variabel dalam pesan
            let personalizedMessage = goodbyeMessage
                .replace(/@user/g, `@${member.split('@')[0]}`)
                .replace(/@group/g, groupName)
                .replace(/@desc/g, groupDesc)
                .replace(/@count/g, memberCount);

            // Kirim pesan goodbye
            await sock.sendMessage(chatId, {
                text: personalizedMessage,
                mentions: [member]
            });
        }
    } catch (error) {
        console.error('Error in goodbye message:', error);
    }
}

module.exports = sayGoodbye;
