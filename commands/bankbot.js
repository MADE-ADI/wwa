const settings = require('../settings');
const fs = require('fs');

async function bankCommand(sock, chatId, channelLink) {
    const bankCommand = `
╔═══════════════════╗
   *🤖 ${settings.botName || 'WhatsApp Bot'}*  
   Version: *${settings.version || '1.0.0'}*
   by MIMIMURU STORE}
╚═══════════════════╝

*Available Commands:*

╔═══════════════════╗
🌐 *General Commands*:
║ ➤ !payransom
║ ➤ !clearboard
║ ➤ !ess
║ ➤ !stats
║ ➤ !stats all
║ ➤ !pstats [Player_Name]
║ ➤ !gryphon
║ ➤ !reguser
║ ➤ !unreguser
║ ➤ !pos
║ ➤ !shield
║ ➤ !shield deploy
║ ➤ !relocate [X] ‎[Y]
║ ➤ !relocate rand
║ ➤ !relocatekvk [K]
║ ➤ !migrate [K][X][Y]
║ ➤ !recall
║ ➤ !buildspam [amount] ‎[delay]
║ ➤ !buildspam [stop]
║ ➤ !joingvg
║ ➤ !leavegvg
╚═══════════════════╝

@${settings.botName || 'MIMURU'} 2024 v${settings.version || '1.0.0'}
`;

    try {
        const imagePath = './assets/bot_image.jpg';
        if (fs.existsSync(imagePath)) {
            const imageBuffer = fs.readFileSync(imagePath);
            await sock.sendMessage(chatId, { 
                image: imageBuffer, 
                caption: bankCommand 
            });
        } else {
            await sock.sendMessage(chatId, { text: bankCommand });
        }

    } catch (error) {
        await sock.sendMessage(chatId, { text: 'An error occurred while sending the help message.' });
    }
}

module.exports = bankCommand;
