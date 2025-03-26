const fs = require('fs');
const path = require('path');

const antilinkFilePath = path.join(__dirname, '../data', 'antilinkSettings.json');

function loadAntilinkSettings() {
    try {
        if (fs.existsSync(antilinkFilePath)) {
            const data = fs.readFileSync(antilinkFilePath);
            return JSON.parse(data);
        }
    } catch (error) {
        console.error('Error loading antilink settings:', error);
    }
    return {};
}

function saveAntilinkSettings(settings) {
    fs.writeFileSync(antilinkFilePath, JSON.stringify(settings, null, 2));
}

function setAntilinkSetting(groupId, type) {
    if (!groupId) {
        throw new Error('GroupId tidak boleh kosong');
    }
    
    const validTypes = ['off', 'whatsappGroup', 'whatsappChannel', 'telegram', 'allLinks'];
    if (!validTypes.includes(type)) {
        throw new Error('Tipe antilink tidak valid');
    }

    const settings = loadAntilinkSettings();
    settings[groupId] = type;
    saveAntilinkSettings(settings);
}

function getAntilinkSetting(groupId) {
    const settings = loadAntilinkSettings();
    return settings[groupId] || 'off';
}

module.exports = {
    setAntilinkSetting,
    getAntilinkSetting
};
