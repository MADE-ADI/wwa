const settings = require('./settings');
const chalk = require('chalk');
const fs = require('fs');
const path = require('path');
const { default: makeWASocket, useMultiFileAuthState, DisconnectReason } = require('@whiskeysockets/baileys');
const P = require('pino');
const speed = require("performance-now");
const crypto = require('crypto')
const isOwner = require('./helpers/isOwner');

global.crypto = require('crypto')
// Mendapatkan argumen dari command line
const args = process.argv.slice(2);
let botName = 'default';

// Memeriksa apakah argumen --run ada
if (args.length >= 2 && args[0] === '--run') {
    botName = args[1];
    console.log(chalk.blue(`Menjalankan bot dengan nama: ${botName}`));
} else {
    console.log(chalk.yellow('Tidak ada nama bot yang ditentukan, menggunakan nama default'));
    console.log(chalk.yellow('Penggunaan: node cmd.js --run <namabot>'));
}

// Membuat direktori untuk session bot jika belum ada
const sessionDir = path.join(__dirname, `bot-sessions/${botName}`);
if (!fs.existsSync(sessionDir)) {
    fs.mkdirSync(sessionDir, { recursive: true });
    console.log(chalk.green(`Direktori session untuk bot ${botName} telah dibuat`));
}

// Global settings
global.packname = settings.packname;
global.author = settings.author;
global.channelLink = "https://chat.whatsapp.com/J7qOssbe89SAQ2BtUoV2UY";
global.ytch = "Hanaby LM";

// Commands
const tagAllCommand = require('./commands/tagall');
const helpCommand = require('./commands/help');
const welcomeNewMembers = require('./commands/welcome');
const sayGoodbye = require('./commands/goodbye');
const banCommand = require('./commands/ban');
const promoteCommand = require('./commands/promote');
const demoteCommand = require('./commands/demote');
const muteCommand = require('./commands/mute');
const unmuteCommand = require('./commands/unmute');
const stickerCommand = require('./commands/sticker');
const isAdmin = require('./helpers/isAdmin');
const warnCommand = require('./commands/warn');
const warningsCommand = require('./commands/warnings');
const ttsCommand = require('./commands/tts');
const { tictactoeCommand, tictactoeMove } = require('./commands/tictactoe');
const { incrementMessageCount, topMembers } = require('./commands/topmembers');
const ownerCommand = require('./commands/owner');
const deleteCommand = require('./commands/delete');
const { handleAntilinkCommand, handleLinkDetection } = require('./commands/antilink');
const memeCommand = require('./commands/meme');
const tagCommand = require('./commands/tag');
const jokeCommand = require('./commands/joke');
const quoteCommand = require('./commands/quote');
const factCommand = require('./commands/fact');
const weatherCommand = require('./commands/weather');
const newsCommand = require('./commands/news');
const kickCommand = require('./commands/kick');
const simageCommand = require('./commands/simage');
const attpCommand = require('./commands/attp');
const bankCommand = require('./commands/bankbot');
const { startHangman, guessLetter } = require('./commands/hangman');
const { startTrivia, answerTrivia } = require('./commands/trivia');
const { complimentCommand } = require('./commands/compliment');
const { insultCommand } = require('./commands/insult');
const { eightBallCommand } = require('./commands/eightball');
const { lyricsCommand } = require('./commands/lyrics');
const { dareCommand } = require('./commands/dare');
const { truthCommand } = require('./commands/truth');
const { clearCommand } = require('./commands/clear');

const { autoDeleteLongMessage } = require('./commands/autodelete');

// owner command
const { groupListCommand } = require('./commands/grouplist');
const createGroupCommand = require('./commands/creategroup');
const setGroupIconCommand = require('./commands/setgroupicon');
const { joinGroupCommand, leaveGroupCommand } = require('./commands/groupactions');
const setDescriptionCommand = require('./commands/setdesc');
const grouplinkCommand = require('./commands/grouplink');

// Import command add user
const addUserCommand = require('./commands/adduser');

// Import command tag admin
const tagAdminCommand = require('./commands/tagadmin');

// Import group settings commands
const { muteGroupCommand, unmuteGroupCommand, closeGroupCommand, openGroupCommand } = require('./commands/groupsettings');

// Import set welcome command
const setWelcomeCommand = require('./commands/setwelcome');

// Import song command
const songCommand = require('./commands/song');

// Import broadcast command
const { broadcastCommand, loadBroadcastSchedules } = require('./commands/broadcast');

// Data storage path
const dataDirectory = path.join(__dirname, './data');
const dataFile = path.join(dataDirectory, 'userGroupData.json');

// Ensure data directory exists
if (!fs.existsSync(dataDirectory)) {
    fs.mkdirSync(dataDirectory);
}

// Initialize or load user group data
let userGroupData = { users: [], groups: [] };
if (fs.existsSync(dataFile)) {
    userGroupData = JSON.parse(fs.readFileSync(dataFile, 'utf-8'));
} else {
    fs.writeFileSync(dataFile, JSON.stringify(userGroupData, null, 2));
}

// Function to save user and group data to file
function saveUserGroupData() {
    try {
        fs.writeFileSync(dataFile, JSON.stringify(userGroupData, null, 2));
        console.log('Database has been created');
    } catch (error) {
        console.error('Error Creating Database:', error);
    }
}

// Function to send a global broadcast message
const globalBroadcastMessage = ``;

async function sendGlobalBroadcastMessage(sock) {
    if (userGroupData.groups.length === 0 && userGroupData.users.length === 0) return;

    for (const groupId of userGroupData.groups) {
        console.log(`Sending broadcast to group: ${groupId}`);
        await sock.sendMessage(groupId, { text: globalBroadcastMessage });
    }
}

// owner command handler
const handleOwnerCommands = require('./commands/ownercommands');

// Definisikan fungsi clear langsung di cmd.js untuk menghindari masalah impor
async function clearGroupChat(sock, chatId, senderId) {
    try {
        // Periksa apakah ini adalah grup
        if (!chatId.endsWith('@g.us')) {
            await sock.sendMessage(chatId, { 
                text: '❌ Perintah ini hanya dapat digunakan di grup.',
            });
            return;
        }

        // Periksa apakah pengirim adalah owner
        if (!isOwner(senderId)) {
            await sock.sendMessage(chatId, { 
                text: '❌ Hanya owner bot yang dapat menggunakan perintah ini.',
            });
            return;
        }

        // Kirim pesan kosong dengan banyak baris untuk "membersihkan" chat
        const clearText = '\n'.repeat(400) + '🧹 *Chat telah dibersihkan oleh owner!* 🧹';
        
        await sock.sendMessage(chatId, { 
            text: clearText
        });

    } catch (error) {
        console.error('Error clearing chat:', error);
        await sock.sendMessage(chatId, { 
            text: `❌ Error: ${error.message}`,
        });
    }
}

// Tambahkan di awal file
process.on('uncaughtException', (err) => {
    console.error('Uncaught Exception:', err);
});

process.on('unhandledRejection', (err) => {
    console.error('Unhandled Rejection:', err);
});

// Tambahkan fungsi untuk membersihkan sesi yang rusak
function cleanupSession() {
    try {
        const sessionFiles = fs.readdirSync(sessionDir);
        for (const file of sessionFiles) {
            if (file.endsWith('.json')) {
                const filePath = path.join(sessionDir, file);
                const fileContent = fs.readFileSync(filePath, 'utf8');
                try {
                    JSON.parse(fileContent);
                } catch (e) {
                    console.log(`Menghapus file sesi rusak: ${file}`);
                    fs.unlinkSync(filePath);
                }
            }
        }
    } catch (error) {
        console.error('Error membersihkan sesi:', error);
    }
}

// Tambahkan garbage collection manual setiap interval
setInterval(() => {
    if (global.gc) {
        global.gc();
    }
}, 30 * 60 * 1000); // Setiap 30 menit

// Batasi ukuran cache
const messageCache = new Map();
const MAX_CACHE_SIZE = 1000;

function addToCache(key, value) {
    if (messageCache.size >= MAX_CACHE_SIZE) {
        const firstKey = messageCache.keys().next().value;
        messageCache.delete(firstKey);
    }
    messageCache.set(key, value);
}

// Tambahkan fungsi helper untuk mengirim pesan dengan retry
async function sendMessageWithRetry(sock, chatId, message, retries = 3) {
    for (let i = 0; i < retries; i++) {
        try {
            const sent = await sock.sendMessage(chatId, message);
            return sent;
        } catch (error) {
            console.log(`Percobaan ${i + 1} gagal, mencoba lagi...`);
            if (i === retries - 1) throw error;
            await new Promise(resolve => setTimeout(resolve, 1000 * (i + 1)));
        }
    }
}

// Function to start the bot
async function startBot() {
    try {
        cleanupSession();
        // Menggunakan direktori session sesuai nama bot
        const { state, saveCreds } = await useMultiFileAuthState(sessionDir);
        const sock = makeWASocket({
            auth: state,
            printQRInTerminal: true,
            logger: P({ level: 'warn' }),
            browser: ['KnightBot MD', 'Chrome', '114'],
            connectTimeoutMs: 60000,
            qrTimeout: 40000,
            defaultQueryTimeoutMs: 30000,
            keepAliveIntervalMs: 10000,
            emitOwnEvents: false,
            retryRequestDelayMs: 250,
            msgRetryCounterMap: {},
            getMessage: async (key) => {
                return { conversation: 'retry message' };
            }
        });

        // Membuat direktori data khusus untuk bot ini
        const botDataDir = path.join(__dirname, `./data/${botName}`);
        if (!fs.existsSync(botDataDir)) {
            fs.mkdirSync(botDataDir, { recursive: true });
        }

        // Mengubah path file data sesuai nama bot
        const dataFile = path.join(botDataDir, 'userGroupData.json');

        // Initialize or load user group data
        let userGroupData = { users: [], groups: [] };
        if (fs.existsSync(dataFile)) {
            userGroupData = JSON.parse(fs.readFileSync(dataFile, 'utf-8'));
        } else {
            fs.writeFileSync(dataFile, JSON.stringify(userGroupData, null, 2));
        }

        // Function to save user and group data to file
        function saveUserGroupData() {
            try {
                fs.writeFileSync(dataFile, JSON.stringify(userGroupData, null, 2));
                console.log(`Database untuk ${botName} telah dibuat`);
            } catch (error) {
                console.error(`Error membuat database untuk ${botName}:`, error);
            }
        }

        sock.ev.on('creds.update', saveCreds);

        // Broadcast message every 12 hours
        setInterval(async () => {
            if (sock) await sendGlobalBroadcastMessage(sock);
        }, 12 * 60 * 60 * 1000);

        // Load broadcast schedules
        loadBroadcastSchedules(sock, userGroupData, botName);

        // Message handling
        sock.ev.on('messages.upsert', async (messageUpdate) => {
            try {
                const message = messageUpdate.messages[0];
                if (!message || !message.message) return;

                const chatId = message.key.remoteJid;
                const senderId = message.key.participant || message.key.remoteJid;

                // Tambahkan penanganan status pesan
                if (message.status) {
                    console.log(`Status pesan: ${message.status}`);
                    return;
                }

                // Gunakan fungsi sendMessageWithRetry untuk setiap pengiriman pesan
                const sendResponse = async (text) => {
                    try {
                        await sendMessageWithRetry(sock, chatId, { text });
                    } catch (error) {
                        console.error('Error sending message:', error);
                    }
                };

                const isGroup = chatId.endsWith('@g.us');

                if (isGroup) {
                    if (!userGroupData.groups.includes(chatId)) {
                        userGroupData.groups.push(chatId);
                        console.log(`Added new group: ${chatId}`);
                        saveUserGroupData();
                    }
                } else {
                    if (!userGroupData.users.includes(chatId)) {
                        userGroupData.users.push(chatId);
                        console.log(`Added new user: ${chatId}`);
                        saveUserGroupData();
                    }
                }

                let userMessage = message.message?.conversation?.trim() ||
                    message.message?.extendedTextMessage?.text?.trim() || 
                    message.message?.imageMessage?.caption?.trim() ||
                    message.message?.videoMessage?.caption?.trim() || '';
                userMessage = userMessage.replace(/\.\s+/g, '.').trim();
                console.log('Received message:', userMessage);
                // jika pesan nya berisi sebuah link, maka akan di proses oleh fungsi handleLinkDetection

                // jika pesan nya lebih dari 300 karakter, maka akan di proses oleh fungsi autoDeleteLongMessage
                if (userMessage.length > 3000) {
                    await autoDeleteLongMessage(sock, chatId, message, userMessage);
                    return;
                }

                // Basic message response in private chat
                if (!isGroup && (userMessage === 'hi' || userMessage === 'hello' || userMessage === 'bot')) {
                    await sendResponse('Hi, How can I help you?\nYou can use .menu for more info and commands.');
                    return;
                }

                // Ignore messages that don't start with a command prefix
                if (!userMessage.startsWith('.')) return;

                // List of admin commands
                const adminCommands = ['.mute', '.unmute', '.ban', '.promote', '.demote', '.kick', '.tagall', '.antilink'];
                const isAdminCommand = adminCommands.some(cmd => userMessage.startsWith(cmd));

                let isSenderAdmin = false;
                let isBotAdmin = false;

                if (isGroup && isAdminCommand) {
                    const adminStatus = await isAdmin(sock, chatId, senderId);
                    isSenderAdmin = adminStatus.isSenderAdmin;
                    isBotAdmin = adminStatus.isBotAdmin;

                    if (!isBotAdmin) {
                        await sendResponse('Please make the bot an admin to use admin commands.');
                        return;
                    }

                    if (
                        userMessage.startsWith('.mute') ||
                        userMessage === '.unmute' ||
                        userMessage.startsWith('.ban') ||
                        userMessage.startsWith('.promote') ||
                        userMessage.startsWith('.demote')
                    ) {
                        if (!isSenderAdmin && !message.key.fromMe) {
                            await sendResponse('Sorry, only group admins can use this command.');
                            return;
                        }
                    }

                    // Handling promote and demote commands
                    if (userMessage.startsWith('.promote')) {
                        const mentionedJidList = message.message.extendedTextMessage?.contextInfo?.mentionedJid || [];
                        await promoteCommand(sock, chatId, mentionedJidList);
                    } else if (userMessage.startsWith('.demote')) {
                        const mentionedJidList = message.message.extendedTextMessage?.contextInfo?.mentionedJid || [];
                        await demoteCommand(sock, chatId, mentionedJidList);
                    }
                }

                if (!message.key.fromMe) incrementMessageCount(chatId, senderId);

                // Command handlers
                switch (true) {
                    case userMessage === '.simage': {
                        const quotedMessage = message.message?.extendedTextMessage?.contextInfo?.quotedMessage;
                        if (quotedMessage?.stickerMessage) {
                            await simageCommand(sock, quotedMessage, chatId);
                        } else {
                            await sendResponse('Please reply to a sticker with the .simage command to convert it.');
                        }
                        break;
                    }
                    case userMessage.startsWith('.kick'):
                        const mentionedJidListKick = message.message.extendedTextMessage?.contextInfo?.mentionedJid || [];
                        if (mentionedJidListKick.length > 0) {
                            await kickCommand(sock, chatId, senderId, mentionedJidListKick, message.message?.extendedTextMessage?.contextInfo);
                        } else {
                            await sendResponse('Please mention a user to kick.');
                        }
                        break;
                    case userMessage.startsWith('.ban'):
                        const mentionedJidListBan = message.message.extendedTextMessage?.contextInfo?.mentionedJid || [];
                        if (mentionedJidListBan.length > 0) {
                            await banCommand(sock, chatId, senderId, mentionedJidListBan);
                        } else {
                            await sendResponse('Please mention users to ban.');
                        }
                        break;
                    case userMessage === '.help' || userMessage === '.menu' || userMessage === '.bot' || userMessage === '.list':
                        await helpCommand(sock, chatId, global.channelLink);
                        break;
                    case userMessage.startsWith('.sticker'):
                        await stickerCommand(sock, chatId, message);
                        break;
                    case userMessage.startsWith('.warnings'):
                        const mentionedJidListWarnings = message.message.extendedTextMessage?.contextInfo?.mentionedJid || [];
                        await warningsCommand(sock, chatId, mentionedJidListWarnings);
                        break;
                    case userMessage.startsWith('.warn'):
                        const mentionedJidListWarn = message.message.extendedTextMessage?.contextInfo?.mentionedJid || [];
                        await warnCommand(sock, chatId, senderId, mentionedJidListWarn);
                        break;
                    case userMessage.startsWith('.tts'):
                        const text = userMessage.slice(4).trim();
                        await ttsCommand(sock, chatId, text);
                        break;
                    case userMessage === '.delete' || userMessage === '.del':
                        await deleteCommand(sock, chatId, message, senderId);
                        break;
                    case userMessage.startsWith('.attp'):
                        await attpCommand(sock, chatId, message);
                        break;
                    case userMessage === '.owner':
                        await ownerCommand(sock, chatId, botName);
                        break;
                    case userMessage === '.tagall':
                        if (isSenderAdmin || message.key.fromMe) {
                            await tagAllCommand(sock, chatId, senderId);
                        } else {
                            await sendResponse('Sorry, only group admins can use the .tagall command.');
                        }
                        break;
                    case userMessage.startsWith('.tag'):
                        const messageText = userMessage.slice(4).trim();
                        const replyMessage = message.message?.extendedTextMessage?.contextInfo?.quotedMessage || null;
                        await tagCommand(sock, chatId, senderId, messageText, replyMessage);
                        break;
                    case userMessage.startsWith('.antilink'):
                        await handleAntilinkCommand(sock, chatId, userMessage, senderId, isSenderAdmin);
                        break;
                    case userMessage === '.meme':
                        await memeCommand(sock, chatId);
                        break;
                    case userMessage === '.joke':
                        await jokeCommand(sock, chatId);
                        break;
                    case userMessage === '.quote':
                        await quoteCommand(sock, chatId);
                        break;
                    case userMessage === '.fact':
                        await factCommand(sock, chatId);
                        break;
                    case userMessage.startsWith('.weather'):
                        const city = userMessage.slice(9).trim();
                        if (city) {
                            await weatherCommand(sock, chatId, city);
                        } else {
                            await sendResponse('Please specify a city, e.g., .weather Syurga');
                        }
                        break;
                    case userMessage === '.news':
                        await newsCommand(sock, chatId);
                        break;
                    case userMessage.startsWith('.tictactoe'):
                        const mentions = message.message.extendedTextMessage?.contextInfo?.mentionedJid || [];
                        if (mentions.length === 1) {
                            const playerX = senderId;
                            const playerO = mentions[0];
                            tictactoeCommand(sock, chatId, playerX, playerO, isGroup);
                        } else {
                            await sendResponse('Please mention one player to start a game of Tic-Tac-Toe.');
                        }
                        break;
                    case userMessage.startsWith('.move'):
                        const position = parseInt(userMessage.split(' ')[1]);
                        if (isNaN(position)) {
                            await sendResponse('Please provide a valid position number for Tic-Tac-Toe move.');
                        } else {
                            tictactoeMove(sock, chatId, senderId, position);
                        }
                        break;
                    case userMessage === '.topmembers':
                        topMembers(sock, chatId, isGroup);
                        break;

                    case userMessage.startsWith('.hangman'):
                        startHangman(sock, chatId);
                        break;

                    case userMessage.startsWith('.guess'):
                        const guessedLetter = userMessage.split(' ')[1];
                        if (guessedLetter) {
                            guessLetter(sock, chatId, guessedLetter);
                        } else {
                            sendResponse('Please guess a letter using .guess <letter>');
                        }
                        break;

                    case userMessage.startsWith('.trivia'):
                        startTrivia(sock, chatId);
                        break;

                    case userMessage.startsWith('.answer'):
                        const answer = userMessage.split(' ').slice(1).join(' ');
                        if (answer) {
                            answerTrivia(sock, chatId, answer);
                        } else {
                            sendResponse('Please provide an answer using .answer <answer>');
                        }
                        break;
                    case userMessage.startsWith('.compliment'):
                        const mentionedComplimentUser = message.message.extendedTextMessage?.contextInfo?.mentionedJid[0];
                        await complimentCommand(sock, chatId, mentionedComplimentUser);
                        break;

                    case userMessage.startsWith('.insult'):
                        const mentionedInsultUser = message.message.extendedTextMessage?.contextInfo?.mentionedJid[0];
                        await insultCommand(sock, chatId, mentionedInsultUser);
                        break;

                    case userMessage.startsWith('.8ball'):
                        const question = userMessage.split(' ').slice(1).join(' ');
                        await eightBallCommand(sock, chatId, question);
                        break;

                    case userMessage.startsWith('.lyrics'):
                        const songTitle = userMessage.split(' ').slice(1).join(' ');
                        await lyricsCommand(sock, chatId, songTitle);
                        break;

                    case userMessage === '.dare':
                        await dareCommand(sock, chatId);
                        break;

                    case userMessage === '.truth':
                        await truthCommand(sock, chatId);
                        break;

                    case userMessage === '.clear':
                        if (isGroup) await clearGroupChat(sock, chatId, senderId);
                        break;

                    case userMessage === '.mimurubank':
                        if (isGroup) await bankCommand(sock, chatId);
                        break;

                    case userMessage.startsWith('.creategroup') || 
                         userMessage.startsWith('.join') || 
                         userMessage.startsWith('.leave') || 
                         userMessage === '.grouplist' ||
                         userMessage === '.clear' ||
                         userMessage.startsWith('.broadcast') ||
                         userMessage.startsWith('.setbroadcast') ||
                         userMessage.startsWith('.pp') && !isGroup:
                        await handleOwnerCommands(sock, chatId, senderId, message, userMessage, isGroup, userGroupData, botName);
                        break;
                    
                    case userMessage.startsWith('.setdesc') || userMessage.startsWith('.desc') || userMessage.startsWith('.setdescription'):
                        await setDescriptionCommand(sock, chatId, senderId, userMessage);
                        break;
                    
                    case userMessage.startsWith('.setgroupicon') || userMessage.startsWith('.gruppp'):
                        await setGroupIconCommand(sock, chatId, senderId, message);
                        break;

                    case userMessage === '.grouplink' || userMessage === '.getlink' || userMessage === '.link':
                        await grouplinkCommand(sock, chatId, senderId);
                        break;

                    case userMessage.startsWith('.add'):
                        await addUserCommand(sock, chatId, senderId, message, userMessage);
                        break;

                    case userMessage.startsWith('.tagadmin') || userMessage.startsWith('.admins'):
                        await tagAdminCommand(sock, chatId, senderId, userMessage);
                        break;

                    case userMessage === '.mutegroup' || userMessage === '.mute':
                        await muteGroupCommand(sock, chatId, senderId);
                        break;
                    
                    case userMessage === '.unmutegroup' || userMessage === '.unmute':
                        await unmuteGroupCommand(sock, chatId, senderId);
                        break;
                    
                    case userMessage === '.close':
                        await closeGroupCommand(sock, chatId, senderId);
                        break;
                    
                    case userMessage === '.open':
                        await openGroupCommand(sock, chatId, senderId);
                        break;

                    case userMessage.startsWith('.setwelcome') || 
                         userMessage.startsWith('.setgoodbye') || 
                         userMessage === '.welcomeon' || 
                         userMessage === '.welcomeoff' ||
                         userMessage === '.goodbyeoff' ||    // Add this line
                         userMessage === '.goodbyeon' ||     // Add this line
                         userMessage === '.resetwelcome' ||
                         userMessage === '.resetgoodbye':
                        await setWelcomeCommand(sock, chatId, senderId, userMessage, botName);
                        break;

                    case userMessage.startsWith('.song'):
                        const songQuery = userMessage.substring(6).trim();
                        await songCommand(sock, chatId, songQuery);
                        break;

                    default:
                        await handleLinkDetection(sock, chatId, message, userMessage, senderId);
                        break;
                }
                if (userMessage.includes('http') || userMessage.includes('www.')) {
                    await handleLinkDetection(sock, chatId, message, userMessage, senderId);
                    return;
                }
            } catch (error) {
                console.error('Error in message handler:', error);
            }
        });

        // Tambahkan event listener untuk status pengiriman pesan
        sock.ev.on('messages.update', async (updates) => {
            for (const update of updates) {
                if (update.status) {
                    console.log('Status update:', update);
                }
            }
        });

        // Handle bot being removed from group or group participant updates
        sock.ev.on('group-participants.update', async (update) => {
            const chatId = update.id;
            const botNumber = sock.user.id.split(':')[0] + '@s.whatsapp.net';  // Define botNumber

            try {
                if (update.action === 'remove') {
                    const removedMembers = update.participants;

                    // Check if the bot itself was removed
                    if (removedMembers.includes(botNumber)) {
                        console.log(`Bot has been removed from group: ${chatId}`);
                        // Remove the group from the saved data
                        userGroupData.groups = userGroupData.groups.filter(group => group !== chatId);
                        saveUserGroupData();
                    } else {
                        if (removedMembers.length > 0) await sayGoodbye(sock, chatId, removedMembers, botName);
                    }
                } else if (update.action === 'add') {
                    const newMembers = update.participants;
                    if (newMembers.length > 0) await welcomeNewMembers(sock, chatId, newMembers, botName);
                }
            } catch (error) {
                console.error('Error handling group update:', error);
            }
        });

        // Handle connection updates
        sock.ev.on('connection.update', async (update) => {
            const { connection, lastDisconnect } = update;
            
            if (connection === 'close') {
                const shouldReconnect = (lastDisconnect?.error)?.output?.statusCode !== DisconnectReason.loggedOut;
                // console.log('Koneksi terputus karena:', lastDisconnect?.error, ', reconnect:', shouldReconnect);
                
                if (shouldReconnect) {
                    // Bersihkan sesi yang mungkin rusak
                    cleanupSession();
                    // Tunggu sebentar sebelum reconnect
                    setTimeout(async () => {
                        console.log('Mencoba menghubungkan kembali...');
                        await startBot();
                    }, 5000);
                }
            } else if (connection === 'connecting') {
                console.log('Menghubungkan...');
            } else if (connection === 'open') {
                console.log(chalk.green(`Bot ${botName} telah terhubung ke WhatsApp!`));
            }
        });
    } catch (error) {
        // console.error('Error starting bot:', error);
        // Tambahkan delay sebelum mencoba ulang
        setTimeout(startBot, 10000);
    }
}

// Start the bot
startBot();
