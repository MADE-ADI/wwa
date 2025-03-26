const fs = require('fs');
const path = require('path');

async function ownerCommand(sock, chatId, botName) {
    const sessionDir = path.join(__dirname, `../bot-sessions/${botName}/owner.json`);
    const ownerBot = JSON.parse(fs.readFileSync(sessionDir, 'utf-8'));
    const vcard = `
BEGIN:VCARD
VERSION:3.0
FN:${botName}
TEL;waid=${ownerBot}:${ownerBot}
END:VCARD
`;

    await sock.sendMessage(chatId, {
        contacts: { displayName: botName, contacts: [{ vcard }] },
    });
}

module.exports = ownerCommand;
