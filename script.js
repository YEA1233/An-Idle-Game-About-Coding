const { ipcRenderer } = require('electron');
const fs = require('fs');
const path = require('path');

const saveFolderPath = path.resolve(process.cwd(), 'saves');
fs.mkdirSync(saveFolderPath, { recursive: true });

const game = {
    lines: 0,
    linesPerClick: 1,
    cps: 0,
    upgradeLevel: 0,
    items: [
        { name: 'Junior Dev', baseCost: 10, count: 0, cps: 1, description: '+1 CPS' },
        { name: 'Code Assistant', baseCost: 100, count: 0, cps: 5, description: '+5 CPS' },
        { name: 'Build Tool', baseCost: 1000, count: 0, cps: 20, description: '+20 CPS' },
    ],
    upgrade: { cost: 50, maxLevel: 5, step: 1 },
};

const elements = {
    linesCount: document.getElementById('linesCount'),
    linesPerClick: document.getElementById('linesPerClick'),
    cps: document.getElementById('cps'),
    message: document.getElementById('message'),
    upgradeCost: document.getElementById('upgrade-cost'),
    upgradeButton: document.getElementById('buyUpgrade'),
    codeButton: document.getElementById('codeButton'),
    fullscreenButton: document.getElementById('fullscreenButton'),
    settingsToggle: document.getElementById('settingsToggle'),
    settingsPanel: document.getElementById('settingsPanel'),
    darkModeToggle: document.getElementById('darkModeToggle'),
    saveFileSelect: document.getElementById('saveFileSelect'),
    refreshSavesButton: document.getElementById('refreshSavesButton'),
    loadSaveButton: document.getElementById('loadSaveButton'),
    manualSaveButton: document.getElementById('manualSaveButton'),
    wipeSaveButton: document.getElementById('wipeSaveButton'),
    exportBase64Button: document.getElementById('exportBase64Button'),
    importBase64Button: document.getElementById('importBase64Button'),
    base64Text: document.getElementById('base64Text'),
    itemButtons: document.querySelectorAll('[data-item]'),
};

function formatNumber(value) {
    return Math.floor(value).toLocaleString();
}

function getItemCost(item) {
    return Math.ceil(item.baseCost * Math.pow(1.15, item.count));
}

function updateUI() {
    elements.linesCount.textContent = formatNumber(game.lines);
    elements.linesPerClick.textContent = formatNumber(game.linesPerClick);
    elements.cps.textContent = formatNumber(game.cps);
    elements.upgradeCost.textContent = formatNumber(game.upgrade.cost);

    game.items.forEach((item, index) => {
        const costLabel = document.getElementById(`item-${index}-cost`);
        const ownedLabel = document.getElementById(`item-${index}-owned`);
        costLabel.textContent = formatNumber(getItemCost(item));
        ownedLabel.textContent = item.count;
        const button = document.querySelector(`[data-item='${index}']`);
        if (button) {
            button.disabled = game.lines < getItemCost(item);
        }
    });

    elements.upgradeButton.disabled = game.lines < game.upgrade.cost || game.upgradeLevel >= game.upgrade.maxLevel;
    elements.upgradeButton.textContent = game.upgradeLevel >= game.upgrade.maxLevel ? 'Maxed' : 'Upgrade';
}

function addLines(amount) {
    game.lines += amount;
    if (game.lines < 0) game.lines = 0;
    updateUI();
}

function showMessage(text) {
    elements.message.textContent = text;
}

function buyItem(index) {
    const item = game.items[index];
    const cost = getItemCost(item);
    if (game.lines >= cost) {
        game.lines -= cost;
        item.count += 1;
        updateCps();
        showMessage(`Bought 1 ${item.name}.`);
        saveGame();
    } else {
        showMessage(`You need ${formatNumber(cost)} lines to buy ${item.name}.`);
    }
}

function buyUpgrade() {
    if (game.upgradeLevel >= game.upgrade.maxLevel) {
        showMessage('Your setup is already maxed out.');
        return;
    }
    if (game.lines >= game.upgrade.cost) {
        game.lines -= game.upgrade.cost;
        game.upgradeLevel += 1;
        game.linesPerClick += game.upgrade.step;
        game.upgrade.cost = Math.ceil(game.upgrade.cost * 2.2);
        updateCps();
        showMessage(`Upgrade purchased! Code per click is now +${game.linesPerClick}.`);
        saveGame();
    } else {
        showMessage(`You need ${formatNumber(game.upgrade.cost)} lines for the upgrade.`);
    }
}

function updateCps() {
    game.cps = game.items.reduce((sum, item) => sum + item.count * item.cps, 0);
}

function toggleFullscreen() {
    ipcRenderer.send('toggle-fullscreen');
}

ipcRenderer.on('fullscreen-changed', (_event, isFullscreen) => {
    elements.fullscreenButton.textContent = isFullscreen ? 'Exit Fullscreen' : 'Enter Fullscreen';
});

function getSavedFiles() {
    const files = fs.readdirSync(saveFolderPath)
        .filter(file => file.endsWith('.json'))
        .map(file => {
            const filePath = path.join(saveFolderPath, file);
            const stat = fs.statSync(filePath);
            return { name: file, filePath, mtime: stat.mtimeMs };
        })
        .sort((a, b) => b.mtime - a.mtime);
    return files;
}

function refreshSaveList() {
    const files = getSavedFiles();
    elements.saveFileSelect.innerHTML = '';

    const newestOption = document.createElement('option');
    newestOption.value = '__newest__';
    newestOption.textContent = files.length ? `Newest save (${files[0].name})` : 'No saves yet';
    elements.saveFileSelect.appendChild(newestOption);

    files.forEach(file => {
        const option = document.createElement('option');
        option.value = file.name;
        option.textContent = `${file.name}`;
        elements.saveFileSelect.appendChild(option);
    });

    const selectedFile = localStorage.getItem('selectedSaveFile');
    if (selectedFile && files.some(f => f.name === selectedFile)) {
        elements.saveFileSelect.value = selectedFile;
    } else {
        elements.saveFileSelect.value = '__newest__';
        localStorage.removeItem('selectedSaveFile');
    }
}

function getSelectedSavePath() {
    const selected = elements.saveFileSelect.value;
    if (selected === '__newest__') {
        const files = getSavedFiles();
        return files.length ? files[0].filePath : null;
    }
    return path.join(saveFolderPath, selected);
}

function loadGameFromData(data, source = 'localStorage') {
    if (typeof data.lines !== 'number') return false;
    game.lines = data.lines;
    game.linesPerClick = data.linesPerClick ?? game.linesPerClick;
    game.cps = data.cps ?? game.cps;
    game.upgradeLevel = data.upgradeLevel ?? game.upgradeLevel;
    game.upgrade = { ...game.upgrade, ...(data.upgrade || {}) };
    game.items = data.items || game.items;
    updateCps();
    updateUI();
    showMessage(`Loaded game from ${source}.`);
    return true;
}

function loadGame() {
    const saved = localStorage.getItem('idleCodingGame');
    if (!saved) return false;
    try {
        const data = JSON.parse(saved);
        return loadGameFromData(data, 'localStorage');
    } catch (error) {
        console.warn('Could not load saved game:', error);
        return false;
    }
}

function loadSaveFromFile(filePath) {
    if (!filePath || !fs.existsSync(filePath)) {
        showMessage('No save file found to load.');
        return false;
    }
    try {
        const raw = fs.readFileSync(filePath, 'utf8');
        const data = JSON.parse(raw);
        const loaded = loadGameFromData(data, `file '${path.basename(filePath)}'`);
        if (loaded) {
            saveGame();
        }
        return loaded;
    } catch (error) {
        console.warn('Could not load save file:', error);
        showMessage('That save file could not be loaded.');
        return false;
    }
}

function saveGameToFile() {
    const fileName = `save-${new Date().toISOString().replace(/[:.]/g, '-')}.json`;
    const filePath = path.join(saveFolderPath, fileName);
    try {
        fs.writeFileSync(filePath, JSON.stringify(game, null, 2), 'utf8');
        refreshSaveList();
        showMessage(`Saved game to ${fileName}.`);
        return true;
    } catch (error) {
        console.warn('Could not save game file:', error);
        showMessage('Failed to save game file.');
        return false;
    }
}

function wipeSave() {
    try {
        const files = getSavedFiles();
        files.forEach(file => {
            const filePath = path.join(saveFolderPath, file.name);
            if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
        });
    } catch (error) {
        console.warn('Could not remove save files:', error);
    }

    localStorage.removeItem('idleCodingGame');
    localStorage.removeItem('idleCodingGameDarkMode');
    localStorage.removeItem('selectedSaveFile');

    game.lines = 0;
    game.linesPerClick = 1;
    game.cps = 0;
    game.upgradeLevel = 0;
    game.upgrade = { cost: 50, maxLevel: 5, step: 1 };
    game.items = [
        { name: 'Junior Dev', baseCost: 10, count: 0, cps: 1, description: '+1 CPS' },
        { name: 'Code Assistant', baseCost: 100, count: 0, cps: 5, description: '+5 CPS' },
        { name: 'Build Tool', baseCost: 1000, count: 0, cps: 20, description: '+20 CPS' },
    ];

    refreshSaveList();
    applyDarkMode(false);
    updateCps();
    updateUI();
    showMessage('All saves wiped and game reset.');
}

function exportBase64() {
    const json = JSON.stringify(game);
    const encoded = Buffer.from(json, 'utf8').toString('base64');
    elements.base64Text.value = encoded;
    showMessage('Save exported as Base64.');
}

function importBase64() {
    const raw = elements.base64Text.value.trim();
    if (!raw) {
        showMessage('Paste Base64 content first.');
        return;
    }
    try {
        const decoded = Buffer.from(raw, 'base64').toString('utf8');
        const data = JSON.parse(decoded);
        if (loadGameFromData(data, 'imported Base64')) {
            saveGame();
        }
    } catch (error) {
        console.warn('Invalid Base64 import:', error);
        showMessage('Invalid Base64 data.');
    }
}

function applyDarkMode(enabled) {
    document.body.classList.toggle('dark-mode', enabled);
    localStorage.setItem('idleCodingGameDarkMode', enabled ? '1' : '0');
}

function toggleSettings() {
    elements.settingsPanel.classList.toggle('hidden');
}

function saveLoadSelection() {
    const selected = elements.saveFileSelect.value;
    if (selected === '__newest__') {
        localStorage.removeItem('selectedSaveFile');
    } else {
        localStorage.setItem('selectedSaveFile', selected);
    }
}

function loadStartupSave() {
    const selectedFile = localStorage.getItem('selectedSaveFile');
    const files = getSavedFiles();
    if (selectedFile && files.some(f => f.name === selectedFile)) {
        return loadSaveFromFile(path.join(saveFolderPath, selectedFile));
    }
    if (files.length) {
        return loadSaveFromFile(files[0].filePath);
    }
    return loadGame();
}

function init() {
    refreshSaveList();

    const darkModeSaved = localStorage.getItem('idleCodingGameDarkMode') === '1';
    elements.darkModeToggle.checked = darkModeSaved;
    applyDarkMode(darkModeSaved);

    if (!loadStartupSave()) {
        updateCps();
        updateUI();
    }
}

elements.codeButton.addEventListener('click', () => {
    addLines(game.linesPerClick);
    showMessage(`You wrote ${formatNumber(game.linesPerClick)} line${game.linesPerClick === 1 ? '' : 's'} of code.`);
    saveGame();
});

elements.itemButtons.forEach((button) => {
    const index = Number(button.dataset.item);
    button.addEventListener('click', () => buyItem(index));
});

elements.upgradeButton.addEventListener('click', buyUpgrade);

elements.fullscreenButton.addEventListener('click', toggleFullscreen);

elements.settingsToggle.addEventListener('click', toggleSettings);

elements.darkModeToggle.addEventListener('change', () => applyDarkMode(elements.darkModeToggle.checked));

elements.refreshSavesButton.addEventListener('click', refreshSaveList);

elements.loadSaveButton.addEventListener('click', () => {
    saveLoadSelection();
    const selectedPath = getSelectedSavePath();
    if (selectedPath) {
        loadSaveFromFile(selectedPath);
    } else {
        showMessage('No save selected.');
    }
});

elements.manualSaveButton.addEventListener('click', () => {
    saveGame();
    saveGameToFile();
});

elements.wipeSaveButton.addEventListener('click', () => {
    if (confirm('Wipe all saves and reset the game? This cannot be undone.')) {
        wipeSave();
    }
});

elements.exportBase64Button.addEventListener('click', exportBase64);

elements.importBase64Button.addEventListener('click', importBase64);

let lastTime = performance.now();
function gameLoop(currentTime) {
    const deltaSeconds = Math.min((currentTime - lastTime) / 1000, 0.1);
    addLines(game.cps * deltaSeconds);
    lastTime = currentTime;
    requestAnimationFrame(gameLoop);
}

function saveGame() {
    localStorage.setItem('idleCodingGame', JSON.stringify(game));
}

init();
requestAnimationFrame(gameLoop);
setInterval(saveGame, 5000);