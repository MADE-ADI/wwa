const fs = require('fs');
const path = require('path');
const isAdmin = require('../helpers/isAdmin');

/**
 * Command to set custom welcome and goodbye messages for a group
 * @param {Object} sock - Socket connection
 * @param {String} chatId - Chat ID
 * @param {String} senderId - Sender ID
 * @param {String} userMessage - User message text
 * @param {String} botName - Bot name for session directory
 */
async function setWelcomeCommand(sock, chatId, senderId, userMessage, botName) {
    try {
        console.log(`setWelcomeCommand received: ${userMessage}`);
        
        // Check if this is a group chat
        if (!chatId.endsWith('@g.us')) {
            await sock.sendMessage(chatId, { text: 'This command can only be used in groups.' });
            return;
        }

        // Check if sender is admin
        const groupMetadata = await sock.groupMetadata(chatId);
        const isAdmin = groupMetadata.participants
            .filter(p => p.admin)
            .map(p => p.id)
            .includes(senderId);

        if (!isAdmin) {
            await sock.sendMessage(chatId, { text: 'Only admins can change welcome/goodbye settings.' });
            return;
        }

        // Create settings directory if it doesn't exist
        const sessionDir = path.join(__dirname, `../bot-sessions/${botName}/group-settings`);
        if (!fs.existsSync(sessionDir)) {
            fs.mkdirSync(sessionDir, { recursive: true });
        }

        const settingsFile = path.join(sessionDir, `${chatId.split('@')[0]}.json`);
        
        // Load existing settings or create default
        let groupSettings = { enabled: true };
        if (fs.existsSync(settingsFile)) {
            groupSettings = JSON.parse(fs.readFileSync(settingsFile, 'utf-8'));
        }

        // Handle different commands
        if (userMessage.startsWith('.setwelcome')) {
            const welcomeMessage = userMessage.substring(12).trim();
            if (!welcomeMessage) {
                await sock.sendMessage(chatId, { text: 'Please provide a welcome message. Example: .setwelcome Hello @user, welcome to @group!' });
                return;
            }
            groupSettings.welcome = welcomeMessage;
            await sock.sendMessage(chatId, { text: 'Welcome message has been set.' });
        } 
        else if (userMessage.startsWith('.setgoodbye')) {
            const goodbyeMessage = userMessage.substring(12).trim();
            if (!goodbyeMessage) {
                await sock.sendMessage(chatId, { text: 'Please provide a goodbye message. Example: .setgoodbye Goodbye @user, we will miss you!' });
                return;
            }
            groupSettings.goodbye = goodbyeMessage;
            await sock.sendMessage(chatId, { text: 'Goodbye message has been set.' });
        } 
        else if (userMessage === '.welcomeon') {
            groupSettings.enabled = true;
            await sock.sendMessage(chatId, { text: 'Welcome/goodbye messages are now enabled.' });
        } 
        else if (userMessage === '.welcomeoff') {
            groupSettings.enabled = false;
            await sock.sendMessage(chatId, { text: 'Welcome/goodbye messages are now disabled.' });
        } 
        else if (userMessage === '.goodbyeoff') {
            // Make sure this value is set correctly
            groupSettings.goodbyeEnabled = false;
            // If goodbyeEnabled is not being detected properly, try
            if (typeof groupSettings.goodbyeEnabled !== 'boolean') {
                groupSettings.goodbyeEnabled = false;
            }
            await sock.sendMessage(chatId, { text: 'Goodbye messages are now disabled.' });
        }
        else if (userMessage === '.goodbyeon') {
            // Make sure this value is set correctly
            groupSettings.goodbyeEnabled = true;
            await sock.sendMessage(chatId, { text: 'Goodbye messages are now enabled.' });
        }
        else if (userMessage === '.resetwelcome') {
            delete groupSettings.welcome;
            await sock.sendMessage(chatId, { text: 'Welcome message has been reset to default.' });
        }
        else if (userMessage === '.resetgoodbye') {
            delete groupSettings.goodbye;
            await sock.sendMessage(chatId, { text: 'Goodbye message has been reset to default.' });
        }

        // Save settings
        fs.writeFileSync(settingsFile, JSON.stringify(groupSettings, null, 2));
    } catch (error) {
        console.error('Error in setWelcomeCommand:', error);
        await sock.sendMessage(chatId, { text: 'An error occurred while setting welcome/goodbye message.' });
    }
}

module.exports = setWelcomeCommand;