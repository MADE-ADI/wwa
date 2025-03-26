/**
 * Auto Delete long messages - Deletes messages that exceed a specified character limit
 * @param {Object} sock - The WhatsApp socket connection
 * @param {String} chatId - The ID of the chat
 * @param {Object} message - The message object
 * @param {String} userMessage - The text content of the message
 * @returns {Promise<void>}
 */
async function autoDeleteLongMessage(sock, chatId, message, userMessage) {
    try {
        // Check if the message is longer than 300 characters
        if (userMessage && userMessage.length > 3000) {
            // Get the sender's information
            const senderId = message.key.participant || message.key.remoteJid;
            const senderNumber = senderId.split('@')[0];
            
            // Delete the message
            await sock.sendMessage(chatId, {
                delete: message.key
            });
            
            // Notify about the deletion with a warning
            await sock.sendMessage(chatId, { 
                text: `⚠️ @${senderNumber}'s message was deleted because it exceeded 300 characters.\n\nPlease keep messages concise or split longer content into multiple messages.`,
                mentions: [senderId]
            });
            
            console.log(`Deleted long message (${userMessage.length} chars) from ${senderNumber} in ${chatId}`);
        }
    } catch (error) {
        console.error('Error in autoDeleteLongMessage:', error);
    }
}

module.exports = { autoDeleteLongMessage };