const isOwner = require('../helpers/isOwner');
const createGroupCommand = require('./creategroup');
const { joinGroupCommand, leaveGroupCommand } = require('./groupactions');
const groupListCommand = require('./grouplist');
const clearCommand = require('./clear');
const { broadcastCommand } = require('./broadcast');
const setProfilePicCommand = require('./setpp');


/**
 * Menangani semua perintah khusus owner
 * @param {Object} sock - Socket connection
 * @param {String} chatId - Chat ID
 * @param {String} senderId - Sender ID
 * @param {Object} message - Message object
 * @param {String} userMessage - User message text
 * @param {Boolean} isGroup - Whether the chat is a group
 * @param {Object} userGroupData - Data grup dan pengguna
 * @param {String} botName - Nama bot
 */
async function handleOwnerCommands(sock, chatId, senderId, message, userMessage, isGroup, userGroupData, botName) {
    // Periksa apakah pengirim adalah owner
    console.log('usetMessage', userMessage);
    if (!isOwner(senderId)) {
        await sock.sendMessage(chatId, { 
            text: '❌ Perintah ini hanya dapat digunakan oleh owner bot.'
        });
        return;
    }

    // Periksa apakah pesan dikirim di private chat
    // Make exception for .clear command which can be used in groups
    if (isGroup && !userMessage.startsWith('.clear')) {
        await sock.sendMessage(chatId, { 
            text: '❌ Perintah owner hanya dapat digunakan di private chat.'
        });
        return;
    }

    // Menangani berbagai perintah owner
    if (userMessage.startsWith('.creategroup')) {
        await createGroupCommand(sock, chatId, senderId, message);
    } 
    else if (userMessage.startsWith('.join')) {
        await joinGroupCommand(sock, chatId, senderId, userMessage);
    } 
    else if (userMessage.startsWith('.leave')) {
        // Ekstrak ID grup dari pesan
        const parts = userMessage.split(' ');
        if (parts.length < 2) {
            await sock.sendMessage(chatId, { 
                text: '❌ Silakan tentukan ID grup yang ingin ditinggalkan.\n\nContoh: .leave 1234567890@g.us'
            });
            return;
        }
        
        const groupId = parts[1];
        if (!groupId.endsWith('@g.us')) {
            await sock.sendMessage(chatId, { 
                text: '❌ ID grup tidak valid. Gunakan format: 1234567890@g.us'
            });
            return;
        }
        
        await leaveGroupCommand(sock, groupId, senderId);
    } 
    else if (userMessage === '.grouplist') {
        await groupListCommand(sock, chatId, senderId);
    }
    else if (userMessage === '.clear' && isGroup) {
        await clearCommand(sock, chatId, senderId);
    }
    // Update the broadcast command handler to pass the message object
    else if (userMessage.startsWith('.broadcast') || userMessage.startsWith('.setbroadcast')) {
        await broadcastCommand(sock, chatId, senderId, userMessage, userGroupData, botName, message);
    }
    else if (userMessage.startsWith('.pp') && !isGroup) {
        console.log('Setting profile picture...');
        await setProfilePicCommand(sock, chatId, senderId, message);
    }
    else if (userMessage.startsWith('.pp') && isGroup) {
        await sock.sendMessage(chatId, { 
            text: '❌ Perintah .setpp hanya dapat digunakan di private chat.'
        });
    }
    else {
        // Perintah owner tidak dikenali
        await sock.sendMessage(chatId, { 
            text: '❌ Perintah owner tidak dikenali. Perintah yang tersedia:\n\n' +
                  '• .creategroup <nama_grup> [@user1 @user2...]\n' +
                  '• .join <link_grup>\n' +
                  '• .leave <id_grup>\n' +
                  '• .grouplist\n' +
                  '• .clear (di dalam grup)\n' +
                  '• .setpp (untuk mengubah foto profil bot)\n' +
                  '• .broadcast <pesan>\n' +
                  '• .setbroadcast add <jadwal> <pesan>\n' +
                  '• .setbroadcast list\n' +
                  '• .setbroadcast delete <id>\n' +
                  '• .setbroadcast test <id>'
        });
    }
}

module.exports = handleOwnerCommands;