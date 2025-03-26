const isAdmin = require('../helpers/isAdmin');

const channelInfo = {
    contextInfo: {
        forwardingScore: 999,
        isForwarded: true,
        forwardedNewsletterMessageInfo: {
            newsletterJid: '120363161513685998@newsletter',
            newsletterName: 'KnightBot MD',
            serverMessageId: -1
        }
    }
};

/**
 * Command to tag all admins in a group
 * @param {Object} sock - Socket connection
 * @param {String} chatId - Chat ID
 * @param {String} senderId - Sender ID
 * @param {String} userMessage - User message text
 */
async function tagAdminCommand(sock, chatId, senderId, userMessage) {
    try {
        // Periksa apakah ini adalah grup
        if (!chatId.endsWith('@g.us')) {
            await sock.sendMessage(chatId, { 
                text: '❌ Perintah ini hanya dapat digunakan di grup.',
            });
            return;
        }

        // Dapatkan metadata grup
        const groupMetadata = await sock.groupMetadata(chatId);
        
        // Filter hanya admin dari daftar peserta
        const adminList = groupMetadata.participants.filter(participant => 
            participant.admin === 'admin' || participant.admin === 'superadmin'
        );
        
        // Periksa apakah ada admin
        if (adminList.length === 0) {
            await sock.sendMessage(chatId, { 
                text: '❓ Aneh, sepertinya tidak ada admin di grup ini.',
            });
            return;
        }

        // Ekstrak pesan tambahan jika ada
        let customMessage = '';
        if (userMessage.startsWith('.tagadmin ')) {
            customMessage = userMessage.substring(10).trim();
        } else if (userMessage.startsWith('.admins ')) {
            customMessage = userMessage.substring(8).trim();
        }
        
        // Buat daftar admin dengan tag (@user)
        let adminMentions = [];
        let adminText = customMessage ? 
            `*PERHATIAN ADMIN!*\n\n${customMessage}\n\n` : 
            '*DAFTAR ADMIN GRUP*\n\n';
        
        adminList.forEach((admin, index) => {
            adminText += `@${admin.id.split('@')[0]}\n`;
            adminMentions.push(admin.id);
        });
        
        adminText += `\n*Total Admin:* ${adminList.length}`;
        
        // Kirim pesan dengan mention semua admin
        await sock.sendMessage(chatId, { 
            text: adminText,
            mentions: adminMentions
        });

    } catch (error) {
        console.error('Error tagging admins:', error);
        await sock.sendMessage(chatId, { 
            text: `❌ Error: ${error.message}`,
        });
    }
}

module.exports = tagAdminCommand; 