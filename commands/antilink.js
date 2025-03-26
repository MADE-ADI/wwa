const { setAntilinkSetting, getAntilinkSetting } = require('../helpers/antilinkHelper');

async function handleAntilinkCommand(sock, chatId, userMessage, senderId, isSenderAdmin) {
    // Check if this is a group chat
    if (!chatId.endsWith('@g.us')) {
        await sock.sendMessage(chatId, { text: '❌ Antilink command can only be used in group chats.' });
        return;
    }
    
    if (!isSenderAdmin) {
        await sock.sendMessage(chatId, { text: '❌ Only admins can use the .antilink command.' });
        return;
    }

    if (userMessage === '.antilink') {
        const helpMessage = `
*Antilink Commands:*
1. *.antilink off* - Disable antilink protection.
2. *.antilink whatsapp* - Block WhatsApp group links.
3. *.antilink whatsappchannel* - Block WhatsApp channel links.
4. *.antilink telegram* - Block Telegram links.
5. *.antilink all* - Block all types of links.
        `;
        await sock.sendMessage(chatId, { text: helpMessage });
        return;
    }

    if (userMessage === '.antilink off') {
        setAntilinkSetting(chatId, 'off');
        await sock.sendMessage(chatId, { text: '✅ Antilink protection is now turned off.' });
    } else if (userMessage === '.antilink whatsapp') {
        setAntilinkSetting(chatId, 'whatsappGroup');
        await sock.sendMessage(chatId, { text: '✅ WhatsApp group links are now blocked.' });
    } else if (userMessage === '.antilink whatsappchannel') {
        setAntilinkSetting(chatId, 'whatsappChannel');
        await sock.sendMessage(chatId, { text: '✅ WhatsApp channel links are now blocked.' });
    } else if (userMessage === '.antilink telegram') {
        setAntilinkSetting(chatId, 'telegram');
        await sock.sendMessage(chatId, { text: '✅ Telegram links are now blocked.' });
    } else if (userMessage === '.antilink all') {
        setAntilinkSetting(chatId, 'allLinks');
        await sock.sendMessage(chatId, { text: '✅ All types of links are now blocked.' });
    }
}

async function handleLinkDetection(sock, chatId, message, userMessage, senderId) {
    // Only work in groups
    if (!chatId.endsWith('@g.us')) {
        return; // Silently ignore in private chats
    }
    
    const antilinkSetting = getAntilinkSetting(chatId);
    
    // Check if antilink is disabled
    if (antilinkSetting === 'off') {
        console.log('Antilink disabled for this group');
        return;
    }

    // Make sure to extract the text properly from all possible message types
    const extractedText = userMessage || 
                         message.message?.conversation || 
                         message.message?.extendedTextMessage?.text ||
                         message.message?.imageMessage?.caption ||
                         message.message?.videoMessage?.caption || '';
    
    console.log('Checking message:', {
        chatId,
        antilinkSetting,
        extractedText: extractedText.substring(0, 50), // Log only first 50 chars for privacy
        senderId
    });

    // Define link patterns
    const linkPatterns = {
        whatsappGroup: /(?:https?:\/\/)?(?:chat\.whatsapp\.com|wa\.me)\/[A-Za-z0-9_\-]+/i,
        whatsappChannel: /(?:https?:\/\/)?(?:whatsapp\.com\/channel|wa\.me\/channel)\/[A-Za-z0-9_\-]+/i,
        telegram: /(?:https?:\/\/)?t(?:elegram)?\.me\/[A-Za-z0-9_]+/i,
        allLinks: /(https?:\/\/|www\.)[^\s]+/i
    };

    let shouldDelete = false;

    // Check message based on active setting
    switch (antilinkSetting) {
        case 'whatsappGroup':
            shouldDelete = linkPatterns.whatsappGroup.test(extractedText);
            break;
        case 'whatsappChannel':
            shouldDelete = linkPatterns.whatsappChannel.test(extractedText);
            break;
        case 'telegram':
            shouldDelete = linkPatterns.telegram.test(extractedText);
            break;
        case 'allLinks':
            shouldDelete = linkPatterns.allLinks.test(extractedText);
            break;
    }

    console.log('Detection result:', {
        shouldDelete,
        matchedPattern: antilinkSetting
    });

    if (shouldDelete) {
        try {
            // Ensure we have a valid message key
            if (!message.key) {
                console.error('Message key not found');
                return;
            }

            const deleteKey = {
                remoteJid: chatId,
                fromMe: false,
                id: message.key.id,
                participant: message.key.participant || senderId
            };

            console.log('Trying to delete message with key:', deleteKey);

            // Try to delete the message
            await sock.sendMessage(chatId, { 
                delete: deleteKey
            });

            // Send warning
            await sock.sendMessage(chatId, { 
                text: `⚠️ *WARNING*\n\n@${senderId.split('@')[0]} detected sending link!\nMessage has been deleted.`, 
                mentions: [senderId]
            });

        } catch (error) {
            console.error('Failed to delete message:', error);
            // Send error notification
            await sock.sendMessage(chatId, { 
                text: 'Failed to delete message. Please ensure the bot has admin permissions.' 
            });
        }
    }
}

module.exports = {
    handleAntilinkCommand,
    handleLinkDetection,
};
