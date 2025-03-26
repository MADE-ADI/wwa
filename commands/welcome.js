const fs = require('fs');
const path = require('path');

async function welcomeNewMembers(sock, chatId, newMembers, botName) {
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
        let welcomeMessage = '';
        
        if (fs.existsSync(settingsFile)) {
            const groupSettings = JSON.parse(fs.readFileSync(settingsFile, 'utf-8'));
            
            // Periksa apakah fitur welcome diaktifkan
            if (!groupSettings.enabled) {
                return; // Jika dinonaktifkan, jangan kirim pesan welcome
            }
            
            // Gunakan pesan kustom jika ada
            if (groupSettings.welcome) {
                useCustomMessage = true;
                welcomeMessage = groupSettings.welcome;
            }
        }

        // Jika tidak ada pesan kustom, gunakan default
        if (!useCustomMessage) {
            welcomeMessage = 'Hallo @user\n\nSelamat Datang Di @group\n\nSemoga betah ya, \nMohon sempatkan membaca deskripsi grup\nTerima kasih\nSemoga lancar terus rezekinya';
        }

        // Siapkan pesan untuk setiap anggota baru
        for (const member of newMembers) {
            // Ganti variabel dalam pesan
            let personalizedMessage = welcomeMessage
                .replace(/@user/g, `@${member.split('@')[0]}`)
                .replace(/@group/g, groupName)
                .replace(/@desc/g, groupDesc)
                .replace(/@count/g, memberCount);

            // Kirim pesan welcome dengan format mentions yang benar
            await sock.sendMessage(chatId, {
                text: personalizedMessage,
                mentions: [member] // Pastikan ini adalah array penuh dari JID anggota
            });
        }
    } catch (error) {
        console.error('Error in welcome message:', error);
    }
}

module.exports = welcomeNewMembers;
