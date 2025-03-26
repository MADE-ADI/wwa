/**
 * Knight Bot - API Server untuk QR Code Login
 * Copyright (c) 2024 Professor
 */
const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const { exec } = require('child_process');
const fs = require('fs');
const path = require('path');
const cors = require('cors');
const { Boom } = require('@hapi/boom');
const { 
    default: makeWASocket,
    useMultiFileAuthState,
    DisconnectReason,
    fetchLatestBaileysVersion,
    makeCacheableSignalKeyStore
} = require("@whiskeysockets/baileys");
const pino = require('pino');
const NodeCache = require('node-cache');
const settings = require('./settings');
const { startWhatsAppBot } = require('./simple-pairing');
const multer = require('multer');
const sharp = require('sharp');

// Inisialisasi Express
const app = express();
const server = http.createServer(app);
const io = socketIo(server, {
    cors: {
        origin: "*",
        methods: ["GET", "POST"]
    }
});
const crypto = require('crypto')

global.crypto = require('crypto')

// Tambahan untuk login via kode pairing
const pairingRequests = new Map(); // Menyimpan permintaan pairing aktif
const PAIRING_EXPIRY = 5 * 60 * 1000; // Kode pairing berlaku 5 menit

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static('public'));
app.use(express.static('public'));
// Konstanta
const BOT_SESSIONS_DIR = './bot-sessions';
const PORT = process.env.PORT || 5004;
const activeSessions = new Map();

// Pastikan folder bot-sessions ada
if (!fs.existsSync(BOT_SESSIONS_DIR)) {
    fs.mkdirSync(BOT_SESSIONS_DIR);
}

// Di awal file, tambahkan ini untuk debugging
process.on('unhandledRejection', (reason, promise) => {
    console.error('Unhandled Rejection at:', promise, 'reason:', reason);
});

process.on('uncaughtException', (error) => {
    console.error('Uncaught Exception:', error);
});

// Rute utama untuk frontend
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// API untuk mendapatkan daftar sesi yang tersedia
app.get('/api/sessions', (req, res) => {
    try {
        const sessions = fs.readdirSync(BOT_SESSIONS_DIR);
        res.json({ success: true, sessions });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// API untuk membuat sesi baru
app.post('/api/create-session', async (req, res) => {
    const { sessionName } = req.body;
    
    if (!sessionName) {
        return res.status(400).json({ success: false, error: 'Nama sesi diperlukan' });
    }
    
    const sessionPath = path.join(BOT_SESSIONS_DIR, sessionName);
    
    // Periksa apakah sesi sudah ada
    if (fs.existsSync(sessionPath)) {
        return res.status(400).json({ success: false, error: 'Sesi dengan nama ini sudah ada' });
    }
    
    try {
        // Buat folder sesi baru
        fs.mkdirSync(sessionPath, { recursive: true });
        
        // Simpan owner dari settings
        fs.writeFileSync(
            path.join(sessionPath, 'owner.json'), 
            JSON.stringify(settings.ownerNumber)
        );
        
        // Mulai proses pembuatan QR
        startQRSession(sessionName, req.socket.remoteAddress);
        
        res.json({ 
            success: true, 
            message: 'Sesi sedang dibuat, silakan scan QR code',
            sessionName
        });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// API untuk menghapus sesi
app.delete('/api/delete-session/:sessionName', (req, res) => {
    const { sessionName } = req.params;
    const sessionPath = path.join(BOT_SESSIONS_DIR, sessionName);
    
    if (!fs.existsSync(sessionPath)) {
        return res.status(404).json({ success: false, error: 'Sesi tidak ditemukan' });
    }
    
    try {
        // Hapus folder sesi
        fs.rmSync(sessionPath, { recursive: true, force: true });
        res.json({ success: true, message: 'Sesi berhasil dihapus' });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// API untuk menjalankan bot
app.post('/api/run-bot', (req, res) => {
    const { sessionName } = req.body;
    
    if (!sessionName) {
        return res.status(400).json({ success: false, error: 'Nama sesi diperlukan' });
    }
    
    const sessionPath = path.join(BOT_SESSIONS_DIR, sessionName);
    
    if (!fs.existsSync(sessionPath)) {
        return res.status(404).json({ success: false, error: 'Sesi tidak ditemukan' });
    }
    
    try {
        // Jalankan bot dengan PM2
        const scriptPath = path.resolve('cmd.js');
        const pmCommand = `pm2 start ${scriptPath} --name "bot-${sessionName}" -- --run ${sessionName}`;
        
        exec(pmCommand, (error, stdout, stderr) => {
            if (error) {
                console.error(`Error saat menjalankan PM2: ${error.message}`);
                return res.status(500).json({ success: false, error: error.message });
            }
            
            if (stderr) {
                console.error(`PM2 stderr: ${stderr}`);
            }
            
            console.log(`Bot ${sessionName} berhasil dijalankan dengan PM2`);
            console.log(`PM2 stdout: ${stdout}`);
            
            res.json({ 
                success: true, 
                message: `Bot ${sessionName} berhasil dijalankan di background dengan PM2` 
            });
        });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// Tambahkan API untuk menghentikan bot
app.post('/api/stop-bot', (req, res) => {
    const { sessionName } = req.body;
    
    if (!sessionName) {
        return res.status(400).json({ success: false, error: 'Nama sesi diperlukan' });
    }
    
    try {
        // Hentikan bot dengan PM2
        exec(`pm2 stop bot-${sessionName}`, (error, stdout, stderr) => {
            if (error) {
                console.error(`Error saat menghentikan bot: ${error.message}`);
                return res.status(500).json({ success: false, error: error.message });
            }
            
            console.log(`Bot ${sessionName} berhasil dihentikan`);
            res.json({ success: true, message: `Bot ${sessionName} berhasil dihentikan` });
        });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// Tambahkan API untuk menghapus proses PM2
app.delete('/api/delete-pm2/:sessionName', (req, res) => {
    const { sessionName } = req.params;
    
    if (!sessionName) {
        return res.status(400).json({ success: false, error: 'Nama sesi diperlukan' });
    }
    
    try {
        // Menghapus proses PM2 (delete bukan hanya stop)
        exec(`pm2 delete bot-${sessionName}`, (error, stdout, stderr) => {
            if (error) {
                console.error(`Error saat menghapus proses PM2: ${error.message}`);
                return res.status(500).json({ success: false, error: error.message });
            }
            
            console.log(`Proses PM2 untuk bot ${sessionName} berhasil dihapus`);
            res.json({ success: true, message: `Proses PM2 untuk bot ${sessionName} berhasil dihapus` });
        });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// Tambahkan API untuk melihat status bot yang berjalan
app.get('/api/running-bots', (req, res) => {
    try {
        exec('pm2 jlist', (error, stdout, stderr) => {
            if (error) {
                console.error(`Error saat mendapatkan daftar proses PM2: ${error.message}`);
                return res.status(500).json({ success: false, error: error.message });
            }
            
            try {
                const processes = JSON.parse(stdout);
                const bots = processes.filter(proc => proc.name.startsWith('bot-')).map(proc => ({
                    name: proc.name.replace('bot-', ''),
                    status: proc.pm2_env.status,
                    uptime: proc.pm2_env.pm_uptime,
                    memory: proc.monit.memory,
                    cpu: proc.monit.cpu
                }));
                
                res.json({ success: true, bots });
            } catch (parseError) {
                console.error(`Error saat parsing output PM2: ${parseError.message}`);
                res.status(500).json({ success: false, error: parseError.message });
            }
        });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// Socket.IO untuk komunikasi real-time
io.on('connection', (socket) => {
    console.log('Client connected:', socket.id);
    
    socket.on('request-qr', async (sessionName) => {
        console.log(`QR requested for session: ${sessionName}`);
        try {
            await startQRSession(sessionName, socket.id);
        } catch (error) {
            console.error('Error starting QR session:', error);
            socket.emit('error', `Failed to start QR session: ${error.message}`);
        }
    });
    
    socket.on('disconnect', () => {
        console.log('Client disconnected:', socket.id);
    });
});

// Fungsi untuk memulai sesi QR
async function startQRSession(sessionName, socketId) {
    const sessionPath = path.join(BOT_SESSIONS_DIR, sessionName);
    
    // Create session directory if it doesn't exist
    if (!fs.existsSync(sessionPath)) {
        fs.mkdirSync(sessionPath, { recursive: true });
    }
    
    // Load authentication state
    const { state, saveCreds } = await useMultiFileAuthState(sessionPath);
    
    // Create WhatsApp socket
    const waSocket = makeWASocket({
        printQRInTerminal: false, // Also print in terminal for debugging
        auth: {
            creds: state.creds,
            keys: state.keys,
        },
        logger: pino({ level: 'silent' }),

    });
    
    // Save to active sessions
    activeSessions.set(sessionName, waSocket);
    
    // Handle credentials update
    waSocket.ev.on('creds.update', saveCreds);
    
    // Handle connection updates
    waSocket.ev.on('connection.update', async ({ connection, lastDisconnect, qr }) => {
        console.log(`Connection update for ${sessionName}:`, connection, qr ? 'QR Available' : 'No QR');
        
        if (qr) {
            io.to(socketId).emit('qr', { sessionName, qr });
            // console.log('QR code emitted to client:', socketId);
        }
        
        if (connection === 'open') {
            console.log(`Session ${sessionName} connected successfully!`);
            io.to(socketId).emit('connected', { 
                sessionName, 
                user: waSocket.user,
                message: 'Connected successfully!' 
            });
            
            try {
                const botNumber = waSocket.user.id.split(':')[0] + '@s.whatsapp.net';
                await waSocket.sendMessage(botNumber, { 
                    text: `🤖 Bot Login Successfully!\n\n⏰ Time: ${new Date().toLocaleString()}`
                });
                
                // Setelah berhasil terkoneksi, hentikan event listener
                waSocket.ev.removeAllListeners('connection.update');
                return; // Keluar dari event handler
            } catch (err) {
                console.error('Error sending confirmation message:', err);
            }
        }
    
        if (connection === 'close') {
            const statusCode = lastDisconnect?.error?.output?.statusCode;
            // console.log(`Connection closed with status: ${statusCode}`);
                        // Specific handling for stream error (515)
            if (statusCode === 515 || (lastDisconnect?.error && 
                lastDisconnect.error.message.includes('Stream Errored'))) {
                console.log('Stream error detected, restarting connection...');
                
                // Give some time before reconnecting
                await delay(3000);
                startQRSession(sessionName, socketId);
                return; // Exit this instance of the handler
            }
            
            
            io.to(socketId).emit('error', `Connection closed (code: ${statusCode})`);
            
            if (statusCode !== DisconnectReason.loggedOut) {
                console.log('Attempting to reconnect...');
                // Auto reconnect logic could be implemented here
            }
        }
    });
}

// Tambahkan fungsi delay
function delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

// Function to handle pairing code requests with the simpler approach from simple-pairing.js
async function handlePairingCodeRequest(sessionName, phoneNumber) {
    const sessionPath = path.join(BOT_SESSIONS_DIR, sessionName);
    
    try {
        // Hapus sesi lama jika ada
        if (fs.existsSync(sessionPath)) {
            fs.rmSync(sessionPath, { recursive: true, force: true });
        }

        fs.mkdirSync(sessionPath, { recursive: true });
        
        // Format nomor telepon dengan metode yang lebih bersih dari simple-pairing.js
        let formattedNumber = phoneNumber.replace(/[^0-9]/g, '');
        if (formattedNumber.startsWith('0')) {
            formattedNumber = '62' + formattedNumber.slice(1);
        } else if (!formattedNumber.startsWith('62')) {
            formattedNumber = '62' + formattedNumber;
        }
 
        console.log(`Meminta kode pairing untuk nomor: ${formattedNumber}`);

        // Inisialisasi sesi WhatsApp dengan konfigurasi yang lebih sederhana seperti di simple-pairing.js
        const { state, saveCreds } = await useMultiFileAuthState(sessionPath);

        // Konfigurasi socket yang lebih sederhana dari simple-pairing.js
        const waSocket = makeWASocket({
            logger: pino({ level: 'silent' }),
            printQRInTerminal: false,
            auth: {
                creds: state.creds,
                keys: state.keys,
            },

        });
        
        // Simpan sesi
        activeSessions.set(sessionName, waSocket);
        
        // Event handler untuk credentials
        waSocket.ev.on('creds.update', saveCreds);
        
        // Event handlers untuk koneksi dengan error handling dari simple-pairing.js
        waSocket.ev.on('connection.update', async (update) => {
            const { connection, lastDisconnect } = update;
            console.log(`Connection update for ${sessionName}:`, connection);
            
            if (connection === 'open') {
                console.log(`Sesi ${sessionName} berhasil terhubung!`);
                try {
                    const botNumber = waSocket.user.id.split(':')[0] + '@s.whatsapp.net';
                    await waSocket.sendMessage(botNumber, { 
                        text: `🤖 Bot Login Successfully!\n\n⏰ Time: ${new Date().toLocaleString()}`
                    });
                } catch (err) {
                    console.error('Error saat mengirim pesan konfirmasi:', err);
                }
            }
            
            if (connection === 'close') {
                const statusCode = lastDisconnect?.error?.output?.statusCode;
                // console.log(`Connection closed with status: ${statusCode}`);
                
                // Penanganan status code seperti di simple-pairing.js
                if (statusCode === 515 || (lastDisconnect?.error && 
                    lastDisconnect.error.message.includes('Stream Errored'))) {
                    console.log('Stream error detected, attempting to reconnect...');
                    //activeSessions.delete(sessionName);
                    // Coba menyambung kembali setelah delay
                    if (!waSocket.authState.creds.registered) {
                        console.log('File sudah ada, skip...');
                        return waSocket;
                    }
                    await delay(3000);
                    handlePairingCodeRequest(sessionName, phoneNumber);
                } else if (statusCode !== DisconnectReason.loggedOut) {
                    console.log('Mencoba menyambung kembali...');
                    // Auto reconnect logic could be implemented here if needed
                }
            }
        });

            // Tunggu sejenak seperti di simple-pairing.js untuk memastikan koneksi dimulai
            await new Promise(resolve => setTimeout(resolve, 3000));
            
            console.log(`Meminta kode pairing...`);
            let code = await waSocket.requestPairingCode(formattedNumber);
            
            // Format kode dengan pemisah strip untuk keterbacaan
            const formattedCode = code?.match(/.{1,4}/g)?.join("-") || code;
            console.log(`Kode pairing untuk ${sessionName}: ${formattedCode}`);
            
            // Simpan permintaan pairing dengan informasi lebih lengkap
            pairingRequests.set(sessionName, {
                phoneNumber: formattedNumber,
                pairingCode: formattedCode,
                expiry: Date.now() + PAIRING_EXPIRY,
                requestTime: new Date().toISOString()
            });
            
            return {
                success: true,
                pairingCode: formattedCode,
                expiresIn: PAIRING_EXPIRY / 1000
        };
    } catch (error) {
        console.error('Error dalam proses pairing:', error);
        activeSessions.delete(sessionName);
        
        // Throw error untuk penanganan oleh caller function
        throw error;
    }
}

// API endpoint yang menggunakan fungsi pairing  
app.post('/api/request-pairing-code', async (req, res) => {
    const { sessionName, phoneNumber } = req.body;
    
    if (!sessionName || !phoneNumber) {
        return res.status(400).json({ success: false, error: 'Nama sesi dan nomor telepon diperlukan' });
    }
    
    try {
        // Mulai proses pairing
        const pairingResult = await startWhatsAppBot(phoneNumber, sessionName);
        console.log('Pairing result:', pairingResult);
        
        // Simpan detail pairing
        const data = typeof pairingResult === 'string' ? JSON.parse(pairingResult) : pairingResult;
        
        // Tambahkan event listener untuk mendeteksi koneksi sukses
        if (data.success) {
            // Store the pairing request
            pairingRequests.set(sessionName, {
                phoneNumber: data.formattedNumber || phoneNumber,
                pairingCode: data.pairingCode,
                expiry: Date.now() + PAIRING_EXPIRY,
                requestTime: new Date().toISOString(),
                status: 'pending'
            });
            
            // Get the socket from simple-pairing.js result if available
            const socket = global.activeSockets && global.activeSockets[sessionName];
            if (socket) {
                // Listen for connection events from this socket
                socket.ev.on('connection.update', (update) => {
                    const { connection } = update;
                    
                    if (connection === 'open' && socket.user) {
                        console.log(`Pairing connection successful for ${sessionName}!`);
                        
                        // Update pairing request status to "connected"
                        if (pairingRequests.has(sessionName)) {
                            const pairingData = pairingRequests.get(sessionName);
                            pairingData.status = 'connected';
                            pairingData.user = socket.user;
                            pairingRequests.set(sessionName, pairingData);
                        }
                        
                        // Also update activeSessions
                        activeSessions.set(sessionName, socket);
                    }
                });
            }
        }
        
        res.json({
            ...data,
            success: true,
            expiresIn: PAIRING_EXPIRY / 1000,
            message: 'Masukkan kode pairing ini di aplikasi WhatsApp Anda',
            tips: [
                'Pastikan WhatsApp Anda versi terbaru',
                'Buka WhatsApp di ponsel Anda',
                'Ketuk Menu (⋮) atau Setelan',
                'Ketuk Perangkat Tertaut',
                'Ketuk Tautkan Perangkat',
                'Masukkan kode pairing yang diberikan'
            ]
        });
    } catch (error) {
        console.error('Error saat memulai sesi:', error);
        
        // Berikan tips troubleshooting seperti di simple-pairing.js
        res.status(500).json({
            success: false,
            error: error.message,
            tips: [
                'Pastikan nomor WhatsApp aktif dan terdaftar',
                'Coba restart aplikasi WhatsApp di ponsel',
                'Pastikan format nomor benar (628xxx)',
                'Pastikan WhatsApp Anda versi terbaru',
                'Coba metode QR code jika masalah berlanjut'
            ]
        });
    }
});

// Update the pairing status endpoint to check global activeSockets

app.get('/api/pairing-status/:sessionName', (req, res) => {
    const { sessionName } = req.params;
    
    if (!sessionName) {
        return res.status(400).json({ success: false, error: 'Nama sesi diperlukan' });
    }
    
    try {
        // Check if the session is already connected in activeSessions
        if (activeSessions.has(sessionName)) {
            const waSocket = activeSessions.get(sessionName);
            
            if (waSocket.user) {
                // Session is connected
                return res.json({
                    success: true,
                    status: 'connected',
                    user: waSocket.user,
                    message: 'WhatsApp successfully connected'
                });
            }
        }
        
        // Also check global.activeSockets from simple-pairing.js
        if (global.activeSockets && global.activeSockets[sessionName]) {
            const socket = global.activeSockets[sessionName];
            if (socket.user && socket.connectionStatus === 'connected') {
                // Update our local sessions map
                activeSessions.set(sessionName, socket);
                
                return res.json({
                    success: true,
                    status: 'connected',
                    user: socket.user,
                    message: 'WhatsApp successfully connected via simple-pairing'
                });
            }
        }
        
        // Check if there's an active pairing request
        if (pairingRequests.has(sessionName)) {
            const pairingData = pairingRequests.get(sessionName);
            
            // Check if the pairing request has a connected status
            if (pairingData.status === 'connected' && pairingData.user) {
                return res.json({
                    success: true, 
                    status: 'connected',
                    user: pairingData.user,
                    message: 'WhatsApp successfully connected'
                });
            }
            
            // Check if the pairing code has expired
            if (Date.now() > pairingData.expiry) {
                pairingRequests.delete(sessionName);
                return res.json({
                    success: true,
                    status: 'expired',
                    message: 'Pairing code has expired'
                });
            }
            
            return res.json({
                success: true,
                status: 'pending',
                pairingCode: pairingData.pairingCode,
                expiresIn: Math.floor((pairingData.expiry - Date.now()) / 1000) // remaining time in seconds
            });
        }
        
        // No active pairing request
        res.json({
            success: true,
            status: 'none',
            message: 'No active pairing request'
        });
        
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// Tambahkan endpoint untuk mengambil nomor owner
app.get('/api/owner/:sessionName', (req, res) => {
    const { sessionName } = req.params;
    const ownerPath = path.join(BOT_SESSIONS_DIR, sessionName, 'owner.json');
    
    try {
        if (!fs.existsSync(ownerPath)) {
            return res.json({ 
                success: true, 
                owner: '' // Return empty string if owner file doesn't exist
            });
        }
        
        const ownerData = fs.readFileSync(ownerPath, 'utf8');
        const owner = JSON.parse(ownerData);
        res.json({ success: true, owner });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// Tambahkan endpoint untuk menyimpan nomor owner
app.post('/api/owner/:sessionName', (req, res) => {
    const { sessionName } = req.params;
    const { ownerNumber } = req.body;
    
    if (!ownerNumber) {
        return res.status(400).json({ 
            success: false, 
            error: 'Nomor owner diperlukan' 
        });
    }
    
    try {
        const sessionPath = path.join(BOT_SESSIONS_DIR, sessionName);
        const ownerPath = path.join(sessionPath, 'owner.json');
        
        // Pastikan folder sesi ada
        if (!fs.existsSync(sessionPath)) {
            return res.status(404).json({
                success: false,
                error: 'Sesi tidak ditemukan'
            });
        }
        
        // Simpan nomor owner
        fs.writeFileSync(ownerPath, JSON.stringify(ownerNumber));
        
        res.json({ 
            success: true, 
            message: 'Nomor owner berhasil disimpan',
            owner: ownerNumber 
        });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// Create a multer storage configuration for temporary file upload
const imageUpload = multer({
    storage: multer.memoryStorage(),
    limits: {
        fileSize: 5 * 1024 * 1024, // 5MB limit
    },
    fileFilter: (req, file, cb) => {
        // Accept only image files
        if (file.mimetype.startsWith('image/')) {
            cb(null, true);
        } else {
            cb(new Error('Only image files are allowed!'), false);
        }
    }
}).single('botImage');

// Add this endpoint for getting the current bot image
app.get('/api/bot-image/:sessionName', (req, res) => {
    const { sessionName } = req.params;
    const imagePath = path.join(BOT_SESSIONS_DIR, sessionName, 'bot_image.jpg');
    
    if (fs.existsSync(imagePath)) {
        res.sendFile(imagePath);
    } else {
        // If no custom image, check for default image
        const defaultImagePath = path.join(__dirname, 'assets/bot_image.jpg');
        if (fs.existsSync(defaultImagePath)) {
            res.sendFile(defaultImagePath);
        } else {
            res.status(404).json({ 
                success: false, 
                error: 'No bot image found' 
            });
        }
    }
});

// Add this API endpoint for uploading a bot image
app.post('/api/upload-bot-image/:sessionName', (req, res) => {
    imageUpload(req, res, async (err) => {
        if (err) {
            return res.status(400).json({ 
                success: false, 
                error: err.message 
            });
        }
        
        try {
            const { sessionName } = req.params;
            const sessionPath = path.join(BOT_SESSIONS_DIR, sessionName);
            
            // Check if session exists
            if (!fs.existsSync(sessionPath)) {
                return res.status(404).json({
                    success: false,
                    error: 'Session not found'
                });
            }
            
            // Check if file was uploaded
            if (!req.file) {
                return res.status(400).json({
                    success: false,
                    error: 'No image file provided'
                });
            }
            
            // Process and resize the image (maintain aspect ratio, max 500x500)
            const processedImage = await sharp(req.file.buffer)
                .resize({ 
                    width: 500,
                    height: 500,
                    fit: 'inside'
                })
                .jpeg({ quality: 85 })
                .toBuffer();
            
            // Save the processed image
            const imagePath = path.join(sessionPath, 'bot_image.jpg');
            fs.writeFileSync(imagePath, processedImage);
            
            res.json({
                success: true,
                message: 'Bot image uploaded successfully',
                imageUrl: `/api/bot-image/${sessionName}?t=${Date.now()}`
            });
            
        } catch (error) {
            console.error('Error uploading bot image:', error);
            res.status(500).json({
                success: false,
                error: 'Failed to process image: ' + error.message
            });
        }
    });
});

// Add this endpoint to delete a bot image
app.delete('/api/bot-image/:sessionName', (req, res) => {
    const { sessionName } = req.params;
    const imagePath = path.join(BOT_SESSIONS_DIR, sessionName, 'bot_image.jpg');
    
    try {
        if (fs.existsSync(imagePath)) {
            fs.unlinkSync(imagePath);
            res.json({
                success: true,
                message: 'Bot image deleted successfully'
            });
        } else {
            res.status(404).json({
                success: false,
                error: 'No custom bot image found'
            });
        }
    } catch (error) {
        res.status(500).json({
            success: false,
            error: 'Failed to delete image: ' + error.message
        });
    }
});

server.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on http://0.0.0.0:${PORT}`);
    console.log(`Access the Web UI at http://localhost:${PORT}`);
});