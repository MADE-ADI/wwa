const isOwner = require('../helpers/isOwner');

/**
 * Command to clear messages in a group chat (owner only)
 * @param {Object} sock - Socket connection
 * @param {String} chatId - Chat ID
 * @param {String} senderId - Sender ID
 */
async function clearCommand(sock, chatId, senderId) {
    try {
        // Periksa apakah ini adalah grup
        if (!chatId.endsWith('@g.us')) {
            await sock.sendMessage(chatId, { 
                text: '❌ Perintah ini hanya dapat digunakan di grup.',
            });
            return;
        }

        // Periksa apakah pengirim adalah owner
        if (!isOwner(senderId)) {
            await sock.sendMessage(chatId, { 
                text: '❌ Hanya owner bot yang dapat menggunakan perintah ini.',
            });
            return;
        }

        // Kirim pesan sedang memproses
        await sock.sendMessage(chatId, { 
            text: '⏳ Membersihkan chat...',
        });

        // Kirim pesan kosong dengan banyak baris untuk "membersihkan" chat
        const clearText = '\n'.repeat(400) + '🧹 *Chat telah dibersihkan oleh owner!* 🧹';
        
        await sock.sendMessage(chatId, { 
            text: clearText
        });

    } catch (error) {
        console.error('Error clearing chat:', error);
        await sock.sendMessage(chatId, { 
            text: `❌ Error: ${error.message}`,
        });
    }
}

module.exports = clearCommand;
