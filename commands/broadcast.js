const fs = require('fs');
const path = require('path');
const isOwner = require('../helpers/isOwner');
const cron = require('node-cron');
const moment = require('moment-timezone');
const { downloadContentFromMessage } = require('@whiskeysockets/baileys');

// Set default timezone ke WITA
moment.tz.setDefault('Asia/Makassar');

// Menyimpan tugas cron yang aktif
let activeCronJobs = {};

/**
 * Command untuk mengirim pesan broadcast ke semua grup dan pengguna
 * @param {Object} sock - Socket connection
 * @param {String} chatId - Chat ID
 * @param {String} senderId - Sender ID
 * @param {String} userMessage - Pesan broadcast text
 * @param {Object} userGroupData - Data grup dan pengguna
 * @param {String} botName - Nama bot
 * @param {Object} message - Full message object
 */
async function broadcastCommand(sock, chatId, senderId, userMessage, userGroupData, botName, message) {
    try {
        // Periksa apakah pengirim adalah owner
        if (!isOwner(senderId)) {
            await sock.sendMessage(chatId, { 
                text: '❌ Hanya owner bot yang dapat menggunakan perintah ini.',
            });
            return;
        }

        // Ekstrak perintah dan pesan
        const parts = userMessage.split(' ');
        const command = parts[0].toLowerCase(); // .broadcast atau .setbroadcast

        // Periksa jenis perintah broadcast
        if (command === '.broadcast') {
            // Perintah untuk broadcast langsung
            let broadcastMessage = userMessage.substring(command.length).trim();
            
            // Extract media from direct message or quoted message
            const mediaMessage = await extractMediaFromMessage(message);
            
            // If replying to a text message and no broadcast message provided, use the quoted text
            if (mediaMessage && mediaMessage.type === 'text' && !broadcastMessage) {
                broadcastMessage = mediaMessage.text;
            }
            
            // If media has caption and no broadcast message provided, use the caption
            if (mediaMessage && mediaMessage.caption && !broadcastMessage) {
                broadcastMessage = mediaMessage.caption;
            }
            
            if (!broadcastMessage && (!mediaMessage || mediaMessage.type === 'text')) {
                await sock.sendMessage(chatId, { 
                    text: '❌ Silakan berikan pesan untuk broadcast!\n\nContoh:\n• .broadcast Halo semua, ini adalah pengumuman penting.\n• Kirim gambar dengan caption .broadcast\n• Reply pesan/gambar dengan .broadcast',
                });
                return;
            }
            
            // Kirim pesan sedang memproses
            await sock.sendMessage(chatId, { 
                text: '⏳ Mengirim pesan broadcast ke semua grup...',
            });
            
            // Kirim broadcast ke grup
            const result = await sendBroadcastToGroups(sock, broadcastMessage, mediaMessage);
            
            // Kirim laporan hasil
            await sock.sendMessage(chatId, { 
                text: result.message,
            });
        } 
        else if (command === '.setbroadcast') {
            // Perintah untuk mengatur jadwal broadcast
            const subCommand = parts[1]?.toLowerCase();
            
            if (!subCommand || (subCommand !== 'add' && subCommand !== 'list' && subCommand !== 'delete' && subCommand !== 'test' && subCommand !== 'help')) {
                await sock.sendMessage(chatId, { 
                    text: '❌ Subperintah tidak valid!\n\n*Penggunaan:*\n• .setbroadcast add <waktu> <pesan>\n• .setbroadcast list\n• .setbroadcast delete <id>\n• .setbroadcast test <id>\n• .setbroadcast help\n\nGunakan .setbroadcast help untuk melihat format waktu yang tersedia.',
                });
                return;
            }
            
            // Direktori untuk menyimpan jadwal broadcast
            const broadcastDir = path.join(__dirname, `../bot-sessions/${botName}/broadcasts`);
            if (!fs.existsSync(broadcastDir)) {
                fs.mkdirSync(broadcastDir, { recursive: true });
            }
            
            // File untuk menyimpan jadwal broadcast
            const schedulesFile = path.join(broadcastDir, 'schedules.json');
            
            // Muat jadwal yang ada
            let schedules = [];
            if (fs.existsSync(schedulesFile)) {
                schedules = JSON.parse(fs.readFileSync(schedulesFile, 'utf-8'));
            }
            
            // Tangani subperintah
            if (subCommand === 'help') {
                // Tampilkan bantuan format waktu
                const helpMessage = `📋 *Format Waktu Broadcast*\n\n` +
                    `*Format Sederhana:*\n` +
                    `• daily-HH:MM = Setiap hari pada jam tertentu\n` +
                    `  Contoh: daily-08:00 (setiap hari jam 8 pagi)\n\n` +
                    `• weekly-D-HH:MM = Setiap minggu pada hari dan jam tertentu\n` +
                    `  D: 1=Senin, 2=Selasa, ..., 7=Minggu\n` +
                    `  Contoh: weekly-1-09:30 (setiap Senin jam 9:30 pagi)\n\n` +
                    `• monthly-DD-HH:MM = Setiap bulan pada tanggal dan jam tertentu\n` +
                    `  Contoh: monthly-01-12:00 (setiap tanggal 1 jam 12 siang)\n\n` +
                    `• hourly-MM = Setiap jam pada menit tertentu\n` +
                    `  Contoh: hourly-30 (setiap jam pada menit ke-30)\n\n` +
                    `• everyXhour-HH:MM = Setiap X jam mulai dari jam tertentu\n` +
                    `  Contoh: every6hour-00:00 (setiap 6 jam mulai dari tengah malam)\n\n` +
                    `*Format Cron Standar:*\n` +
                    `• Jika Anda membutuhkan jadwal yang lebih spesifik, gunakan format cron standar:\n` +
                    `  menit jam tanggal bulan hari\n` +
                    `  Contoh: 0 8 * * * (setiap hari jam 8 pagi)`;
                
                await sock.sendMessage(chatId, { 
                    text: helpMessage,
                });
                return;
            }
            else if (subCommand === 'add') {
                // Format: .setbroadcast add <waktu> <pesan>
                const timeFormat = parts[2];
                let broadcastMessage = userMessage.substring(userMessage.indexOf(parts[2]) + parts[2].length).trim();
                
                // Extract media from direct message
                const mediaMessage = await extractMediaFromMessage(message);
                
                if (!timeFormat) {
                    await sock.sendMessage(chatId, { 
                        text: '❌ Silakan berikan format waktu!\n\nContoh: .setbroadcast add daily-08:00 Selamat pagi semua!\n\nGunakan .setbroadcast help untuk melihat format waktu yang tersedia.',
                    });
                    return;
                }
                
                // If the message is empty but we have media with caption, use the media caption
                if (!broadcastMessage && mediaMessage && mediaMessage.caption) {
                    broadcastMessage = mediaMessage.caption;
                }
                
                if (!broadcastMessage && !mediaMessage) {
                    await sock.sendMessage(chatId, { 
                        text: '❌ Silakan berikan pesan untuk broadcast!\n\nContoh: .setbroadcast add daily-08:00 Selamat pagi semua!\n\nGunakan .setbroadcast help untuk melihat format waktu yang tersedia.',
                    });
                    return;
                }
                
                // Konversi format waktu sederhana ke format cron
                const cronExpression = convertToCron(timeFormat);
                
                if (!cronExpression) {
                    await sock.sendMessage(chatId, { 
                        text: '❌ Format waktu tidak valid!\n\nGunakan .setbroadcast help untuk melihat format waktu yang tersedia.',
                    });
                    return;
                }
                
                // Buat ID unik untuk jadwal baru
                const id = Date.now().toString();
                
                // Tambahkan jadwal baru
                schedules.push({
                    id,
                    timeFormat,
                    cronExpression,
                    message: broadcastMessage,
                    hasMedia: !!mediaMessage,
                    mediaType: mediaMessage ? mediaMessage.type : null,
                    mediaData: mediaMessage ? mediaMessage.data : null,
                    createdAt: moment().tz('Asia/Makassar').format('DD/MM/YYYY HH:mm:ss')
                });
                
                // Simpan jadwal
                fs.writeFileSync(schedulesFile, JSON.stringify(schedules, null, 2));
                
                // Aktifkan jadwal
                activateBroadcastSchedule(sock, id, cronExpression, broadcastMessage, mediaMessage, userGroupData);
                
                // Kirim konfirmasi
                await sock.sendMessage(chatId, { 
                    text: `✅ Jadwal broadcast berhasil ditambahkan!\n\n*ID:* ${id}\n*Format Waktu:* ${timeFormat}\n*Cron:* ${cronExpression}\n*Pesan:* ${broadcastMessage}\n*Media:* ${mediaMessage ? 'Ya' : 'Tidak'}`,
                });
            }
            else if (subCommand === 'list') {
                // Tampilkan daftar jadwal
                if (schedules.length === 0) {
                    await sock.sendMessage(chatId, { 
                        text: '📋 Tidak ada jadwal broadcast yang aktif.',
                    });
                    return;
                }
                
                let listMessage = '📋 *Daftar Jadwal Broadcast*\n\n';
                
                schedules.forEach((item, index) => {
                    listMessage += `*${index + 1}. ID:* ${item.id}\n`;
                    listMessage += `*Format Waktu:* ${item.timeFormat}\n`;
                    listMessage += `*Cron:* ${item.cronExpression}\n`;
                    listMessage += `*Pesan:* ${item.message}\n`;
                    listMessage += `*Media:* ${item.hasMedia ? 'Ya' : 'Tidak'}\n`;
                    listMessage += `*Dibuat:* ${item.createdAt}\n\n`;
                });
                
                await sock.sendMessage(chatId, { 
                    text: listMessage,
                });
            }
            else if (subCommand === 'delete') {
                // Hapus jadwal berdasarkan ID
                const id = parts[2];
                
                if (!id) {
                    await sock.sendMessage(chatId, { 
                        text: '❌ Silakan berikan ID jadwal yang akan dihapus!\n\nContoh: .setbroadcast delete 1234567890',
                    });
                    return;
                }
                
                // Cari jadwal dengan ID yang sesuai
                const index = schedules.findIndex(item => item.id === id);
                
                if (index === -1) {
                    await sock.sendMessage(chatId, { 
                        text: `❌ Jadwal dengan ID ${id} tidak ditemukan.`,
                    });
                    return;
                }
                
                // Nonaktifkan jadwal cron
                if (activeCronJobs[id]) {
                    activeCronJobs[id].stop();
                    delete activeCronJobs[id];
                }
                
                // Hapus jadwal dari array
                const deletedSchedule = schedules.splice(index, 1)[0];
                
                // Simpan perubahan
                fs.writeFileSync(schedulesFile, JSON.stringify(schedules, null, 2));
                
                // Kirim konfirmasi
                await sock.sendMessage(chatId, { 
                    text: `✅ Jadwal broadcast berhasil dihapus!\n\n*ID:* ${id}\n*Format Waktu:* ${deletedSchedule.timeFormat}\n*Pesan:* ${deletedSchedule.message}`,
                });
            }
            else if (subCommand === 'test') {
                // Uji jadwal broadcast
                const id = parts[2];
                
                if (!id) {
                    await sock.sendMessage(chatId, { 
                        text: '❌ Silakan berikan ID jadwal yang akan diuji!\n\nContoh: .setbroadcast test 1234567890',
                    });
                    return;
                }
                
                // Cari jadwal dengan ID yang sesuai
                const schedule = schedules.find(item => item.id === id);
                
                if (!schedule) {
                    await sock.sendMessage(chatId, { 
                        text: `❌ Jadwal dengan ID ${id} tidak ditemukan.`,
                    });
                    return;
                }
                
                // Kirim pesan sedang memproses
                await sock.sendMessage(chatId, { 
                    text: `⏳ Menguji broadcast untuk jadwal ID ${id}...`,
                });
                
                // Prepare media message if schedule has media
                let mediaMessage = null;
                if (schedule.hasMedia && schedule.mediaData) {
                    mediaMessage = {
                        type: schedule.mediaType,
                        data: schedule.mediaData
                    };
                }
                
                // Kirim broadcast
                const result = await sendBroadcastToGroups(sock, schedule.message, mediaMessage);
                
                // Kirim laporan hasil
                await sock.sendMessage(chatId, { 
                    text: `✅ Uji broadcast selesai!\n\n*ID:* ${id}\n*Format Waktu:* ${schedule.timeFormat}\n*Pesan:* ${schedule.message}\n*Media:* ${schedule.hasMedia ? 'Ya' : 'Tidak'}\n\n*Terkirim ke:* ${result.success} grup`,
                });
            }
        }
        else {
            await sock.sendMessage(chatId, { 
                text: '❌ Perintah tidak valid. Gunakan .broadcast atau .setbroadcast',
            });
        }
    } catch (error) {
        console.error('Error in broadcast command:', error);
        await sock.sendMessage(chatId, { 
            text: `❌ Error: ${error.message}`,
        });
    }
}

/**
 * Extract media (image/video) from message
 * @param {Object} message - Full message object
 * @returns {Object|null} Media object or null if no media
 */
async function extractMediaFromMessage(message) {
    try {
        // Check if there's a direct image or video in the message
        let mediaMessage = message.message?.imageMessage || message.message?.videoMessage;
        let mediaType = mediaMessage ? (message.message?.imageMessage ? 'image' : 'video') : null;
        let captionText = '';
        
        // Get caption if exists in direct media
        if (mediaMessage && mediaMessage.caption) {
            captionText = mediaMessage.caption;
        }
        
        // If no direct media, check if it's replying to a message with media
        if (!mediaMessage && message.message?.extendedTextMessage?.contextInfo?.quotedMessage) {
            const quotedMessage = message.message.extendedTextMessage.contextInfo.quotedMessage;
            mediaMessage = quotedMessage.imageMessage || quotedMessage.videoMessage;
            mediaType = mediaMessage ? (quotedMessage.imageMessage ? 'image' : 'video') : null;
            
            // Get caption from quoted message if exists
            if (mediaMessage && mediaMessage.caption) {
                captionText = mediaMessage.caption;
            }
            
            // If no media in quoted message, check for text
            if (!mediaMessage && quotedMessage.conversation) {
                return {
                    type: 'text',
                    text: quotedMessage.conversation
                };
            } else if (!mediaMessage && quotedMessage.extendedTextMessage?.text) {
                return {
                    type: 'text',
                    text: quotedMessage.extendedTextMessage.text
                };
            }
        }
        
        if (!mediaMessage) {
            return null;
        }
        
        // Download the media
        const stream = await downloadContentFromMessage(mediaMessage, mediaType);
        let buffer = Buffer.from([]);
        
        for await (const chunk of stream) {
            buffer = Buffer.concat([buffer, chunk]);
        }
        
        // Convert buffer to base64 for storage in schedule
        const base64Data = buffer.toString('base64');
        
        return {
            type: mediaType,
            data: base64Data,
            buffer: buffer, // For immediate use
            caption: captionText // Store the caption if any
        };
        
    } catch (error) {
        console.error('Error extracting media:', error);
        return null;
    }
}

/**
 * Mengkonversi format waktu sederhana ke expresi cron
 */
function convertToCron(timeFormat) {
    try {
        const now = moment().tz('Asia/Makassar');
        
        if (timeFormat.startsWith('daily-')) {
            // Format: daily-HH:mm
            const time = timeFormat.replace('daily-', '').split(':');
            return `${time[1]} ${time[0]} * * *`;
        }
        
        if (timeFormat.startsWith('weekly-')) {
            // Format: weekly-D-HH:mm
            const parts = timeFormat.replace('weekly-', '').split('-');
            const day = parts[0];
            const time = parts[1].split(':');
            return `${time[1]} ${time[0]} * * ${day}`;
        }
        
        if (timeFormat.startsWith('monthly-')) {
            // Format: monthly-DD-HH:mm
            const parts = timeFormat.replace('monthly-', '').split('-');
            const date = parts[0];
            const time = parts[1].split(':');
            return `${time[1]} ${time[0]} ${date} * *`;
        }
        
        if (timeFormat.startsWith('hourly-')) {
            // Format: hourly-mm
            const minute = timeFormat.replace('hourly-', '');
            return `${minute} * * * *`;
        }
        
        if (timeFormat.startsWith('every')) {
            // Format: everyXhour-HH:mm
            const hours = parseInt(timeFormat.match(/every(\d+)hour/)[1]);
            const time = timeFormat.split('-')[1].split(':');
            const startHour = parseInt(time[0]);
            return `${time[1]} ${startHour}/#{hours} * * *`;
        }

        // Jika format tidak dikenali, kembalikan format aslinya
        // (asumsi sudah dalam format cron)
        return timeFormat;
    } catch (error) {
        throw new Error('Format waktu tidak valid');
    }
}

/**
 * Mendapatkan waktu berikutnya dalam WITA
 */
function getNextRunTime(cronExpression) {
    try {
        const nextDate = cron.nextDate(cronExpression);
        return moment(nextDate).tz('Asia/Makassar').format('DD/MM/YYYY HH:mm:ss');
    } catch (error) {
        return 'Invalid schedule';
    }
}

/**
 * Aktivasi jadwal broadcast
 */
function activateBroadcastSchedule(sock, id, cronExpression, message, mediaMessage, userGroupData) {
    // Nonaktifkan jadwal sebelumnya dengan ID yang sama jika ada
    if (activeCronJobs[id]) {
        activeCronJobs[id].stop();
    }
    
    // Buat tugas cron baru
    const job = cron.schedule(cronExpression, async () => {
        console.log(`Executing scheduled broadcast: ${id}`);
        try {
            // Ensure media is properly reconstructed from stored data if needed
            let preparedMedia = mediaMessage;
            if (mediaMessage && mediaMessage.data && !mediaMessage.buffer) {
                preparedMedia = {
                    ...mediaMessage,
                    buffer: Buffer.from(mediaMessage.data, 'base64')
                };
            }
            
            await sendBroadcastToGroups(sock, message, preparedMedia);
            console.log(`Scheduled broadcast ${id} completed`);
        } catch (error) {
            console.error(`Error in scheduled broadcast ${id}:`, error);
        }
    }, {
        timezone: 'Asia/Makassar'
    });
    
    // Simpan tugas cron
    activeCronJobs[id] = job;
    console.log(`Broadcast schedule activated: ${id} - ${cronExpression}`);
}

/**
 * Fungsi untuk mengirim pesan broadcast ke semua grup
 */
async function sendBroadcastToGroups(sock, message, mediaMessage) {
    try {
        // Dapatkan semua grup yang diikuti bot
        const groups = await sock.groupFetchAllParticipating();
        const groupIds = Object.keys(groups);
        
        if (groupIds.length === 0) {
            return { success: 0, message: "Bot tidak berada dalam grup manapun" };
        }

        let successCount = 0;
        let failCount = 0;

        // Kirim pesan ke setiap grup
        for (const groupId of groupIds) {
            try {
                if (mediaMessage && (mediaMessage.type === 'image' || mediaMessage.type === 'video')) {
                    // Always ensure we have a buffer from base64 data if needed
                    let buffer = mediaMessage.buffer;
                    if (!buffer && mediaMessage.data) {
                        buffer = Buffer.from(mediaMessage.data, 'base64');
                    }
                    
                    if (!buffer) {
                        throw new Error('Media buffer could not be prepared');
                    }
                    
                    if (mediaMessage.type === 'image') {
                        await sock.sendMessage(groupId, {
                            image: buffer,
                            caption: message || mediaMessage.caption || '',
                            mimetype: 'image/jpeg'
                        });
                    } else if (mediaMessage.type === 'video') {
                        await sock.sendMessage(groupId, {
                            video: buffer,
                            caption: message || mediaMessage.caption || '',
                            mimetype: 'video/mp4'
                        });
                    }
                } else if (mediaMessage && mediaMessage.type === 'text') {
                    // If replying to text and no custom message provided, use the replied text
                    const textToSend = message || mediaMessage.text;
                    await sock.sendMessage(groupId, { 
                        text: textToSend
                    });
                } else if (message) {
                    // Just a regular text message
                    await sock.sendMessage(groupId, { 
                        text: message
                    });
                }
                
                successCount++;
                // Tambahkan delay kecil untuk menghindari spam
                await new Promise(resolve => setTimeout(resolve, 1000));
            } catch (err) {
                console.error(`Gagal mengirim ke grup ${groupId}:`, err);
                failCount++;
            }
        }

        return {
            success: successCount,
            failed: failCount,
            total: groupIds.length,
            message: `✅ Broadcast selesai!\n\n` +
                    `📊 Statistik:\n` +
                    `- Terkirim: ${successCount} grup\n` +
                    `- Gagal: ${failCount} grup\n` +
                    `- Total grup: ${groupIds.length}`
        };

    } catch (error) {
        console.error('Error in sendBroadcastToGroups:', error);
        return { success: 0, message: "Terjadi kesalahan saat mengirim broadcast" };
    }
}

/**
 * Fungsi untuk memuat dan mengaktifkan semua jadwal broadcast
 * @param {Object} sock - Socket connection
 * @param {Object} userGroupData - Data grup dan pengguna
 * @param {String} botName - Nama bot
 */
function loadBroadcastSchedules(sock, userGroupData, botName) {
    try {
        const broadcastDir = path.join(__dirname, `../bot-sessions/${botName}/broadcasts`);
        const schedulesFile = path.join(broadcastDir, 'schedules.json');
        
        if (!fs.existsSync(schedulesFile)) {
            return;
        }
        
        const schedules = JSON.parse(fs.readFileSync(schedulesFile, 'utf-8'));
        
        schedules.forEach(item => {
            // Create media object if schedule has media
            let mediaMessage = null;
            if (item.hasMedia && item.mediaData) {
                mediaMessage = {
                    type: item.mediaType,
                    data: item.mediaData
                };
            }
            
            activateBroadcastSchedule(sock, item.id, item.cronExpression, item.message, mediaMessage, userGroupData);
        });
        
        console.log(`Loaded ${schedules.length} broadcast schedules for bot ${botName}`);
    } catch (error) {
        console.error(`Error loading broadcast schedules for bot ${botName}:`, error);
    }
}

module.exports = {
    broadcastCommand,
    loadBroadcastSchedules
};