/**
 * Simple WhatsApp Pairing Code Login Example
 * Based on Knightbot-MD
 */
const crypto = require('crypto')

global.crypto = require('crypto')
global.activeSockets = global.activeSockets || {};

// Import required libraries
const { default: makeWASocket, useMultiFileAuthState, delay, DisconnectReason } = require("@whiskeysockets/baileys");
const pino = require("pino");
const readline = require("readline");
const fs = require('fs');
const chalk = require('chalk');

// Create readline interface for user input
const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
const question = (text) => new Promise((resolve) => rl.question(text, resolve));

// Main function to start the bot
async function startWhatsAppBot(nomor,lokasi) {
    console.log(chalk.green('================================='));
    console.log(chalk.yellow('SIMPLE WHATSAPP PAIRING CODE LOGIN'));
    console.log(chalk.green('================================='));
    
    // Get authentication state
    const { state, saveCreds } = await useMultiFileAuthState("./bot-sessions/" + lokasi);

    // Create WhatsApp socket
    const bot = makeWASocket({
        logger: pino({ level: 'silent' }),
        printQRInTerminal: false, // We're using pairing code, not QR
        auth: {
            creds: state.creds,
            keys: state.keys,
        },
    });
    
    // Store the socket globally for access by webapi.js
    global.activeSockets = global.activeSockets || {};
    global.activeSockets[lokasi] = bot;

    // Handle credentials update
    bot.ev.on('creds.update', saveCreds);
    
    // Handle connection updates
    bot.ev.on('connection.update', async (update) => {
        const { connection, lastDisconnect } = update;
        console.log('Status koneksi:', connection, update?.lastDisconnect?.error?.output);
        
        if (connection === "close") {
            const statusCode = lastDisconnect?.error?.output?.statusCode;
            console.log(chalk.red(`Koneksi terputus dengan kode status: ${statusCode}`));
            
            // Khusus untuk error 515 (Stream Error)
            if (statusCode === 515) {
                console.log(chalk.yellow('Stream error terdeteksi, melakukan restart...'));
                await delay(3000); // Tunggu 3 detik
                startWhatsAppBot(nomor, lokasi);
                return;
            }
            
            // Untuk error lainnya
            const shouldReconnect = lastDisconnect?.error?.output?.statusCode !== DisconnectReason.loggedOut;
            
            if (shouldReconnect) {
                console.log(chalk.yellow('Mencoba menghubungkan kembali...'));
                await delay(5000);
                startWhatsAppBot(nomor, lokasi);
            } else {
                console.log(chalk.red('Koneksi terputus secara permanen, silakan login ulang.'));
            }
        }
        
        if (connection === "open") {
            console.log(chalk.green('\n✅ SUCCESSFULLY CONNECTED!'));
            console.log(chalk.yellow('Bot details:'), JSON.stringify(bot.user, null, 2));
            
            // Set connection status
            bot.connectionStatus = 'connected';
            
            // Store the socket globally
            global.activeSockets = global.activeSockets || {};
            global.activeSockets[lokasi] = bot;
            
            // After successful connection, you can close readline
            rl.close();
        }
    });

    // If not registered yet (first time login), use pairing code method
    if (!bot.authState.creds.registered) {
        // Ask for phone number
        let phoneNumber = nomor; // Example phone number
        
        // Clean up phone number - remove non-digits
        //phoneNumber = phoneNumber.replace(/[^0-9]/g, '');
        
        // Adjust format if needed
        if (phoneNumber.startsWith('0')) {
            phoneNumber = '62' + phoneNumber.slice(1); // Replace 0 with 62 for Indonesia
        }

        console.log(chalk.yellow('\nRequesting pairing code...'));
        
        try {
            // Request pairing code
            await delay(3000);
            const code = await bot.requestPairingCode(phoneNumber);
            // Format code for readability
            const formattedCode = code?.match(/.{1,4}/g)?.join("-") || code;
            console.log(chalk.green('\nYour pairing code:'), chalk.black(chalk.bgWhite(` ${formattedCode} `)));
            console.log(chalk.yellow('\nEnter this code in your WhatsApp app.'));
            console.log(chalk.yellow('Waiting for connection...'));

            return {
                success: true,
                formattedNumber: phoneNumber,
                pairingCode: formattedCode,
                expiresIn: 50000
        };
        } catch (error) {
            console.error(chalk.red('Error requesting pairing code:'), error);
            console.log(chalk.red('\nTroubleshooting tips:'));
            console.log(chalk.yellow('1. Make sure your phone number is registered on WhatsApp'));
            console.log(chalk.yellow('2. Try a different format (with or without country code)'));
            console.log(chalk.yellow('3. Make sure your WhatsApp is up to date'));
            // process.exit(1);
        }
    }

    return bot;
}
// // File watcher for hot reloading
// let file = require.resolve(__filename);
// fs.watchFile(file, () => {
//     fs.unwatchFile(file);
//     console.log(chalk.redBright(`Updated ${__filename}`));
//     delete require.cache[file];
//     require(file);
// });

// Ekspor fungsi startWhatsAppBot
module.exports = { startWhatsAppBot };