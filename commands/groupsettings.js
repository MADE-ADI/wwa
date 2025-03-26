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
 * Command to mute a group (only admins can send messages)
 * @param {Object} sock - Socket connection
 * @param {String} chatId - Chat ID
 * @param {String} senderId - Sender ID
 */
async function muteGroupCommand(sock, chatId, senderId) {
    try {
        // Periksa apakah ini adalah grup
        if (!chatId.endsWith('@g.us')) {
            await sock.sendMessage(chatId, { 
                text: '❌ Perintah ini hanya dapat digunakan di grup.',
            });
            return;
        }

        // Periksa apakah pengirim adalah admin
        const { isSenderAdmin, isBotAdmin } = await isAdmin(sock, chatId, senderId);
        
        if (!isSenderAdmin) {
            await sock.sendMessage(chatId, { 
                text: '❌ Hanya admin grup yang dapat menggunakan perintah ini.',
            });
            return;
        }

        // Periksa apakah bot adalah admin
        if (!isBotAdmin) {
            await sock.sendMessage(chatId, { 
                text: '❌ Bot harus menjadi admin untuk mengubah pengaturan grup.',
            });
            return;
        }

        // Kirim pesan sedang memproses
        await sock.sendMessage(chatId, { 
            text: '⏳ Mengubah pengaturan grup...',
        });

        // Ubah pengaturan grup menjadi hanya admin yang dapat mengirim pesan
        await sock.groupSettingUpdate(chatId, 'announcement');
        
        // Dapatkan metadata grup
        const groupMetadata = await sock.groupMetadata(chatId);
        const groupName = groupMetadata.subject || 'Grup ini';
        
        // Kirim pesan konfirmasi
        await sock.sendMessage(chatId, { 
            text: `🔒 *Grup Telah Dimute*\n\nSekarang hanya admin yang dapat mengirim pesan di *${groupName}*.\n\nGunakan *.unmute* untuk membuka kembali grup.`,
        });

    } catch (error) {
        console.error('Error muting group:', error);
        await sock.sendMessage(chatId, { 
            text: `❌ Error: ${error.message}`,
        });
    }
}

/**
 * Command to unmute a group (all members can send messages)
 * @param {Object} sock - Socket connection
 * @param {String} chatId - Chat ID
 * @param {String} senderId - Sender ID
 */
async function unmuteGroupCommand(sock, chatId, senderId) {
    try {
        // Periksa apakah ini adalah grup
        if (!chatId.endsWith('@g.us')) {
            await sock.sendMessage(chatId, { 
                text: '❌ Perintah ini hanya dapat digunakan di grup.',
            });
            return;
        }

        // Periksa apakah pengirim adalah admin
        const { isSenderAdmin, isBotAdmin } = await isAdmin(sock, chatId, senderId);
        
        if (!isSenderAdmin) {
            await sock.sendMessage(chatId, { 
                text: '❌ Hanya admin grup yang dapat menggunakan perintah ini.',
            });
            return;
        }

        // Periksa apakah bot adalah admin
        if (!isBotAdmin) {
            await sock.sendMessage(chatId, { 
                text: '❌ Bot harus menjadi admin untuk mengubah pengaturan grup.',
            });
            return;
        }

        // Kirim pesan sedang memproses
        await sock.sendMessage(chatId, { 
            text: '⏳ Mengubah pengaturan grup...',
        });

        // Ubah pengaturan grup menjadi semua anggota dapat mengirim pesan
        await sock.groupSettingUpdate(chatId, 'not_announcement');
        
        // Dapatkan metadata grup
        const groupMetadata = await sock.groupMetadata(chatId);
        const groupName = groupMetadata.subject || 'Grup ini';
        
        // Kirim pesan konfirmasi
        await sock.sendMessage(chatId, { 
            text: `🔓 *Grup Telah Dibuka*\n\nSekarang semua anggota dapat mengirim pesan di *${groupName}*.`,
        });

    } catch (error) {
        console.error('Error unmuting group:', error);
        await sock.sendMessage(chatId, { 
            text: `❌ Error: ${error.message}`,
        });
    }
}

/**
 * Command to close group (only admins can change group settings)
 * @param {Object} sock - Socket connection
 * @param {String} chatId - Chat ID
 * @param {String} senderId - Sender ID
 */
async function closeGroupCommand(sock, chatId, senderId) {
    try {
        // Periksa apakah ini adalah grup
        if (!chatId.endsWith('@g.us')) {
            await sock.sendMessage(chatId, { 
                text: '❌ Perintah ini hanya dapat digunakan di grup.',
            });
            return;
        }

        // Periksa apakah pengirim adalah admin
        const { isSenderAdmin, isBotAdmin } = await isAdmin(sock, chatId, senderId);
        
        if (!isSenderAdmin) {
            await sock.sendMessage(chatId, { 
                text: '❌ Hanya admin grup yang dapat menggunakan perintah ini.',
            });
            return;
        }

        // Periksa apakah bot adalah admin
        if (!isBotAdmin) {
            await sock.sendMessage(chatId, { 
                text: '❌ Bot harus menjadi admin untuk mengubah pengaturan grup.',
            });
            return;
        }

        // Kirim pesan sedang memproses
        await sock.sendMessage(chatId, { 
            text: '⏳ Mengubah pengaturan grup...',
        });

        // Ubah pengaturan grup menjadi hanya admin yang dapat mengubah info grup
        await sock.groupSettingUpdate(chatId, 'locked');
        
        // Dapatkan metadata grup
        const groupMetadata = await sock.groupMetadata(chatId);
        const groupName = groupMetadata.subject || 'Grup ini';
        
        // Kirim pesan konfirmasi
        await sock.sendMessage(chatId, { 
            text: `🔒 *Pengaturan Grup Dikunci*\n\nSekarang hanya admin yang dapat mengubah info grup di *${groupName}*.\n\nGunakan *.open* untuk membuka kembali pengaturan grup.`,
        });

    } catch (error) {
        console.error('Error closing group settings:', error);
        await sock.sendMessage(chatId, { 
            text: `❌ Error: ${error.message}`,
        });
    }
}

/**
 * Command to open group (all members can change group settings)
 * @param {Object} sock - Socket connection
 * @param {String} chatId - Chat ID
 * @param {String} senderId - Sender ID
 */
async function openGroupCommand(sock, chatId, senderId) {
    try {
        // Periksa apakah ini adalah grup
        if (!chatId.endsWith('@g.us')) {
            await sock.sendMessage(chatId, { 
                text: '❌ Perintah ini hanya dapat digunakan di grup.',
            });
            return;
        }

        // Periksa apakah pengirim adalah admin
        const { isSenderAdmin, isBotAdmin } = await isAdmin(sock, chatId, senderId);
        
        if (!isSenderAdmin) {
            await sock.sendMessage(chatId, { 
                text: '❌ Hanya admin grup yang dapat menggunakan perintah ini.',
            });
            return;
        }

        // Periksa apakah bot adalah admin
        if (!isBotAdmin) {
            await sock.sendMessage(chatId, { 
                text: '❌ Bot harus menjadi admin untuk mengubah pengaturan grup.',
            });
            return;
        }

        // Kirim pesan sedang memproses
        await sock.sendMessage(chatId, { 
            text: '⏳ Mengubah pengaturan grup...',
        });

        // Ubah pengaturan grup menjadi semua anggota dapat mengubah info grup
        await sock.groupSettingUpdate(chatId, 'unlocked');
        
        // Dapatkan metadata grup
        const groupMetadata = await sock.groupMetadata(chatId);
        const groupName = groupMetadata.subject || 'Grup ini';
        
        // Kirim pesan konfirmasi
        await sock.sendMessage(chatId, { 
            text: `🔓 *Pengaturan Grup Dibuka*\n\nSekarang semua anggota dapat mengubah info grup di *${groupName}*.`,
        });

    } catch (error) {
        console.error('Error opening group settings:', error);
        await sock.sendMessage(chatId, { 
            text: `❌ Error: ${error.message}`,
        });
    }
}

module.exports = {
    muteGroupCommand,
    unmuteGroupCommand,
    closeGroupCommand,
    openGroupCommand
}; 