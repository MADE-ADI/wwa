const isAdmin = require('../helpers/isAdmin');
/**
 * Command to add users to a group
 * @param {Object} sock - Socket connection
 * @param {String} chatId - Chat ID
 * @param {String} senderId - Sender ID
 * @param {Object} message - Message object
 * @param {String} userMessage - User message text
 */
async function addUserCommand(sock, chatId, senderId, message, userMessage) {
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
                text: '❌ Bot harus menjadi admin untuk menambahkan anggota.',
            });
            return;
        }

        // Ekstrak nomor telepon atau mentions dari pesan
        let participants = [];
        
        // Periksa apakah ada mentions
        const mentionedJids = message.message?.extendedTextMessage?.contextInfo?.mentionedJid || [];
        
        if (mentionedJids.length > 0) {
            // Gunakan mentions jika ada
            participants = mentionedJids;
        } else {
            // Jika tidak ada mentions, coba ekstrak nomor telepon dari pesan
            const commandParts = userMessage.split(' ');
            commandParts.shift(); // Hapus perintah itu sendiri (.add)
            
            if (commandParts.length === 0) {
                await sock.sendMessage(chatId, { 
                    text: '❌ Silakan tentukan nomor telepon atau mention pengguna yang ingin ditambahkan!\n\nContoh:\n.add 628123456789\natau\n.add @user',
                });
                return;
            }
            
            // Proses setiap nomor telepon
            for (const part of commandParts) {
                let phoneNumber = part.replace(/[^0-9]/g, ''); // Hapus karakter non-numerik
                
                if (phoneNumber.length >= 10) {
                    // Tambahkan kode negara jika belum ada
                    if (!phoneNumber.startsWith('1') && !phoneNumber.startsWith('62') && 
                        !phoneNumber.startsWith('44') && !phoneNumber.startsWith('91')) {
                        phoneNumber = "62" + phoneNumber; // Tambahkan kode negara default (Indonesia)
                    }
                    participants.push(`${phoneNumber}@s.whatsapp.net`);
                }
            }
        }
        
        // Periksa apakah ada peserta yang akan ditambahkan
        if (participants.length === 0) {
            await sock.sendMessage(chatId, { 
                text: '❌ Tidak ada nomor telepon atau pengguna yang valid untuk ditambahkan.',
            });
            return;
        }

        // Kirim pesan sedang memproses
        await sock.sendMessage(chatId, { 
            text: `⏳ Menambahkan ${participants.length} pengguna ke grup...`,
        });

        // Tambahkan peserta ke grup
        try {
            const result = await sock.groupParticipantsUpdate(
                chatId,
                participants,
                "add"
            );
            
            // Hitung berapa banyak yang berhasil dan gagal
            let successCount = 0;
            let failedNumbers = [];
            
            for (let i = 0; i < result.length; i++) {
                const status = result[i].status;
                const jid = participants[i];
                const phoneNumber = jid.split('@')[0];
                
                if (status === '200') {
                    successCount++;
                } else {
                    failedNumbers.push(phoneNumber);
                }
            }
            
            // Kirim pesan hasil
            if (successCount > 0) {
                let resultMessage = `✅ Berhasil menambahkan ${successCount} dari ${participants.length} pengguna ke grup.`;
                
                if (failedNumbers.length > 0) {
                    resultMessage += `\n\n❌ Gagal menambahkan: ${failedNumbers.join(', ')}`;
                    resultMessage += `\n\nKemungkinan penyebab: nomor tidak terdaftar di WhatsApp, pengguna telah mengatur privasi grup, atau pengguna telah memblokir bot.`;
                }
                
                await sock.sendMessage(chatId, { text: resultMessage });
            } else {
                await sock.sendMessage(chatId, { 
                    text: `❌ Gagal menambahkan semua pengguna ke grup.\n\nKemungkinan penyebab: nomor tidak terdaftar di WhatsApp, pengguna telah mengatur privasi grup, atau pengguna telah memblokir bot.`,
                });
            }
            
        } catch (error) {
            throw new Error(`Gagal menambahkan pengguna: ${error.message}`);
        }

    } catch (error) {
        console.error('Error adding users to group:', error);
        await sock.sendMessage(chatId, { 
            text: `❌ Error: ${error.message}`,
        });
    }
}

module.exports = addUserCommand; 