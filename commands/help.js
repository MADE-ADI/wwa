const settings = require('../settings');
const fs = require('fs');
const path = require('path');

// Get session name from command line arguments
const sessionName = process.argv.length >= 4 ? process.argv[3] : '';

/**
 * Send help message with the bot's available commands
 * @param {Object} sock - Socket connection
 * @param {String} chatId - Chat ID
 * @param {String} channelLink - Channel link for invitation
 * @param {String} botName - Bot name for displaying in help
 */
async function helpCommand(sock, chatId, channelLink, botName) {
    const ytch = global.ytch || "Hanaby LM"; // Default if not set globally
    
    const helpMessage = `
╔═══════════════════╗
   *🤖 ${settings.botName || 'WhatsApp Bot'}*  
   Version: *${settings.version || '1.0.0'}*
   Support by ${settings.botOwner || 'Unknown Owner'}
   YT : ${ytch}
╚═══════════════════╝

*Available Commands:*

╔═══════════════════╗
🌐 *General Commands*:
║ ➤ .help or .menu
║ ➤ .tts <text>
║ ➤ .sticker or .s
║ ➤ .owner
║ ➤ .joke
║ ➤ .quote
║ ➤ .fact
║ ➤ .weather <city>
║ ➤ .news
║ ➤ .meme
║ ➤ .simage
║ ➤ .attp <text>
║ ➤ .lyrics <song_title>
║ ➤ .8ball <question>
╚═══════════════════╝

╔═══════════════════╗
🛠️ *Admin Commands*:
║ ➤ .ban @user
║ ➤ .promote @user
║ ➤ .demote @user
║ ➤ .mute <minutes>
║ ➤ .unmute
║ ➤ .delete or .del
║ ➤ .kick @user
║ ➤ .warnings @user
║ ➤ .warn @user
║ ➤ .antilink
║ ➤ .clear
╚═══════════════════╝

╔═══════════════════╗
🎮 *Game Commands*:
║ ➤ .tictactoe @user
║ ➤ .move <position>
║ ➤ .hangman
║ ➤ .guess <letter>
║ ➤ .trivia
║ ➤ .answer <answer>
║ ➤ .dare
║ ➤ .truth
╚═══════════════════╝

╔═══════════════════╗
👥 *Group Management*:
║ ➤ .tagall
║ ➤ .tag <message>
╚═══════════════════╝

╔═══════════════════╗
🎉 *Fun Commands*:
║ ➤ .compliment @user
║ ➤ .insult @user
╚═══════════════════╝

╔═══════════════════╗
🏆 *Other*:
║ ➤ .topmembers
╚═══════════════════╝

${channelLink ? `🔗 *Join our Channel:* \n${channelLink}` : 'No channel link available'}

@${settings.botName || 'MIMURU'} 2024 v${settings.version || '1.0.0'}
`;

    try {
        // First, try to find a custom image in the bot's session folder
        let imageBuffer = null;
        
        // Use either the passed botName or sessionName from command line
        const sessionToUse = botName || sessionName;
        
        // console.log('Bot name:', botName);
        // console.log('Session name:', sessionName);
        // console.log('Session to use:', sessionToUse);
        
        // Use absolute paths to avoid path resolution issues
        let sessionImagePath = null;
        if (sessionToUse) {
            sessionImagePath = path.resolve(__dirname, '../bot-sessions', sessionToUse, 'bot_image.jpg');
            // console.log('Resolved session image path:', sessionImagePath);
        }
        
        // Default image path in assets directory (using absolute path)
        const defaultImagePath = path.resolve(__dirname, '../assets/bot_image.jpg');
        console.log('Default image path:', defaultImagePath);
        
        // Check if session has a custom image
        if (sessionImagePath && fs.existsSync(sessionImagePath)) {
            console.log(`Using custom image for session ${sessionToUse}`);
            imageBuffer = fs.readFileSync(sessionImagePath);
        } 
        // If no custom image, check for default image
        else if (fs.existsSync(defaultImagePath)) {
            console.log('Using default bot image');
            imageBuffer = fs.readFileSync(defaultImagePath);
        } else {
            console.log('No image found at either location');
        }
        
        // Send message with image if available, otherwise text only
        if (imageBuffer) {
            await sock.sendMessage(chatId, { 
                image: imageBuffer, 
                caption: helpMessage 
            });
        } else {
            console.log('No bot image found, sending text-only help message');
            await sock.sendMessage(chatId, { text: helpMessage });
        }

    } catch (error) {
        console.error('Error in help command:', error);
        console.error(error.stack); // Log the full stack trace to help diagnose the issue
        await sock.sendMessage(chatId, { text: helpMessage }); // Fallback to text-only message
    }
}

module.exports = helpCommand;
