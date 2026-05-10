const { app, BrowserWindow, ipcMain } = require('electron');
require('update-electron-app')({
  repo: 'YEA1233/An-Idle-Game-About-Coding',
  updateInterval: '1 hour',
});

function createWindow() {
  const win = new BrowserWindow({
    width: 900,
    height: 680,
    minWidth: 800,
    minHeight: 620,
    icon: 'icon.ico',
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false,
    },
  });

  win.loadFile('index.html');
  win.removeMenu();
}

ipcMain.on('toggle-fullscreen', (event) => {
  const win = BrowserWindow.fromWebContents(event.sender);
  if (!win) return;
  win.setFullScreen(!win.isFullScreen());
  event.sender.send('fullscreen-changed', win.isFullScreen());
});

app.whenReady().then(createWindow);
