const fs = require('fs');
const path = require('path');
const axios = require('axios');
const yts = require('yt-search');
const { exec } = require('child_process');
const { promisify } = require('util');
const execAsync = promisify(exec);

const channelInfo = {
    contextInfo: {
        forwardingScore: 999,
        isForwarded: true,
        forwardedNewsletterMessageInfo: {
            newsletterJid: '120363161513685998@newsletter',
            newsletterName: 'KnightBot MD',
            serverMessageId: -1
        }
    }
};

/**
 * Command to search and download songs
 * @param {Object} sock - Socket connection
 * @param {String} chatId - Chat ID
 * @param {String} query - Search query
 */
async function songCommand(sock, chatId, query) {
    try {
        // Validasi query
        if (!query || query.trim() === '') {
            await sock.sendMessage(chatId, { 
                text: '❌ Silakan berikan judul lagu!\n\nContoh: .song Dewa 19 Kangen',
            });
            return;
        }

        // Kirim pesan sedang mencari
        await sock.sendMessage(chatId, { 
            text: `🔍 Mencari lagu "${query}"...`,
        });

        // Cari video di YouTube
        const searchResults = await yts(query);
        
        // Ambil hasil pertama yang durasinya tidak lebih dari 10 menit
        const videos = searchResults.videos.filter(video => {
            const duration = parseInt(video.seconds);
            return duration <= 600; // Maksimal 10 menit
        });
        
        if (videos.length === 0) {
            await sock.sendMessage(chatId, { 
                text: `❌ Tidak dapat menemukan lagu "${query}" atau durasinya terlalu panjang (maksimal 10 menit).`,
            });
            return;
        }
        
        const video = videos[0];
        const videoUrl = video.url;
        const title = video.title;
        const thumbnail = video.thumbnail;
        const duration = video.timestamp;
        const views = video.views;
        const channel = video.author.name;

        // Kirim informasi lagu yang ditemukan
        await sock.sendMessage(chatId, { 
            text: `🎵 Lagu ditemukan!\n\n*Judul:* ${title}\n*Channel:* ${channel}\n*Durasi:* ${duration}\n*Views:* ${views}\n\n⏳ Sedang mengunduh lagu...`,
        });

        // Buat direktori temp jika belum ada
        const tempDir = path.join(__dirname, '../temp');
        if (!fs.existsSync(tempDir)) {
            fs.mkdirSync(tempDir, { recursive: true });
        }

        // Nama file untuk audio
        const timestamp = Date.now();
        const rawFilePath = path.join(tempDir, `raw_${timestamp}.mp3`);
        const convertedFilePath = path.join(tempDir, `converted_${timestamp}.mp3`);
        
        // Path ke file cookie
        const cookieFile = path.join(__dirname, '../kuki.txt');
        const cookieExists = fs.existsSync(cookieFile);

        try {
            // Gunakan yt-dlp dengan cookie jika tersedia untuk mengunduh
            let ytDlpCommand = '';
            
            if (cookieExists) {
                ytDlpCommand = `yt-dlp -x --audio-format mp3 --audio-quality 128K --cookies "${cookieFile}" -o "${rawFilePath}" ${videoUrl}`;
            } else {
                ytDlpCommand = `yt-dlp -x --audio-format mp3 --audio-quality 128K -o "${rawFilePath}" ${videoUrl}`;
            }
            
            console.log(`Executing yt-dlp: ${ytDlpCommand}`);
            await execAsync(ytDlpCommand);
            
            // Periksa apakah file berhasil dibuat
            if (!fs.existsSync(rawFilePath)) {
                console.error(`File tidak ditemukan di path: ${rawFilePath}`);
                
                // Cari file yang mungkin dibuat dengan nama yang berbeda
                const tempFiles = fs.readdirSync(tempDir);
                console.log('Files in temp directory:', tempFiles);
                
                // Cari file yang dibuat dalam 1 menit terakhir
                const recentFiles = tempFiles.filter(file => {
                    const fileStat = fs.statSync(path.join(tempDir, file));
                    return Date.now() - fileStat.mtimeMs < 60000; // 1 menit
                });
                
                if (recentFiles.length > 0) {
                    // Gunakan file terbaru
                    const newestFile = recentFiles[0];
                    console.log(`Menggunakan file terbaru: ${newestFile}`);
                    
                    // Update path file
                    const newRawFilePath = path.join(tempDir, newestFile);
                    
                    // Konversi dengan ffmpeg
                    await sock.sendMessage(chatId, { 
                        text: `⏳ Mengkonversi audio untuk WhatsApp...`,
                    });
                    
                    // Konversi ke format yang kompatibel dengan WhatsApp
                    const ffmpegCommand = `ffmpeg -i "${newRawFilePath}" -ar 44100 -ac 2 -b:a 128k -acodec libmp3lame -f mp3 "${convertedFilePath}"`;
                    console.log(`Executing ffmpeg: ${ffmpegCommand}`);
                    await execAsync(ffmpegCommand);
                    
                    // Kirim thumbnail
                    await sock.sendMessage(chatId, {
                        image: { url: thumbnail },
                        caption: `🎵 *${title}*\n\n*Channel:* ${channel}\n*Durasi:* ${duration}\n*Views:* ${views}\n\n⏳ Mengirim audio...`
                    });
                    
                    // Kirim file audio yang sudah dikonversi
                    await sock.sendMessage(chatId, {
                        audio: fs.readFileSync(convertedFilePath),
                        mimetype: 'audio/mpeg',
                        fileName: `${title}.mp3`
                    });
                    
                    // Hapus file setelah dikirim
                    fs.unlinkSync(newRawFilePath);
                    fs.unlinkSync(convertedFilePath);
                    
                    return;
                }
                
                throw new Error('File audio tidak ditemukan setelah unduhan');
            }
            
            // Konversi dengan ffmpeg untuk memastikan kompatibilitas dengan WhatsApp
            await sock.sendMessage(chatId, { 
                text: `⏳ Mengkonversi audio untuk WhatsApp...`,
            });
            
            // Konversi ke format yang kompatibel dengan WhatsApp
            const ffmpegCommand = `ffmpeg -i "${rawFilePath}" -ar 44100 -ac 2 -b:a 128k -acodec libmp3lame -f mp3 "${convertedFilePath}"`;
            console.log(`Executing ffmpeg: ${ffmpegCommand}`);
            await execAsync(ffmpegCommand);
            
            // Periksa ukuran file
            const fileStats = fs.statSync(convertedFilePath);
            const fileSizeMB = fileStats.size / (1024 * 1024);
            console.log(`Converted file size: ${fileSizeMB.toFixed(2)} MB`);
            
            // Kirim thumbnail
            await sock.sendMessage(chatId, {
                image: { url: thumbnail },
                caption: `🎵 *${title}*\n\n*Channel:* ${channel}\n*Durasi:* ${duration}\n*Views:* ${views}\n\n⏳ Mengirim audio... (${fileSizeMB.toFixed(2)} MB)`
            });

            // Baca file ke buffer
            console.log(`Membaca file: ${convertedFilePath}`);
            const fileBuffer = fs.readFileSync(convertedFilePath);
            console.log(`File buffer length: ${fileBuffer.length} bytes`);
            
            // Coba kirim sebagai audio
            console.log('Mengirim sebagai audio ke WhatsApp...');
            await sock.sendMessage(chatId, {
                audio: fileBuffer,
                mimetype: 'audio/mpeg',
                fileName: `${title}.mp3`
            });
            console.log('Audio berhasil dikirim!');

            // Hapus file setelah dikirim
            fs.unlinkSync(rawFilePath);
            fs.unlinkSync(convertedFilePath);
            console.log(`File dihapus: ${rawFilePath} dan ${convertedFilePath}`);
            
        } catch (error) {
            console.error('Error downloading or sending song:', error);
            
            // Coba kirim sebagai dokumen jika gagal sebagai audio
            try {
                console.log('Mencoba mengirim sebagai dokumen...');
                
                if (fs.existsSync(convertedFilePath)) {
                    await sock.sendMessage(chatId, {
                        document: fs.readFileSync(convertedFilePath),
                        mimetype: 'audio/mpeg',
                        fileName: `${title}.mp3`
                    });
                    console.log('Berhasil dikirim sebagai dokumen!');
                } else {
                    throw new Error('File konversi tidak ditemukan');
                }
            } catch (docError) {
                console.error('Error sending as document:', docError);
                
                // Kirim pesan error
                await sock.sendMessage(chatId, { 
                    text: `❌ Gagal mengunduh dan mengirim lagu. Detail error:\n\n${error.message}\n\nJika masalah berlanjut, pastikan file cookie YouTube valid dan terbaru.`,
                });
            }
            
            // Pastikan file dihapus jika terjadi error
            if (fs.existsSync(rawFilePath)) {
                fs.unlinkSync(rawFilePath);
            }
            if (fs.existsSync(convertedFilePath)) {
                fs.unlinkSync(convertedFilePath);
            }
        }

    } catch (error) {
        console.error('Error in song command:', error);
        await sock.sendMessage(chatId, { 
            text: `❌ Error: ${error.message}`,
        });
    }
}

module.exports = songCommand; 