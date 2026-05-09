const { app, BrowserWindow, Menu } = require('electron');

function createWindow() {
  const win = new BrowserWindow({
    width: 800,
    height: 600,
    icon: 'icon.ico', // Sets the window icon during development
    webPreferences: {
      nodeIntegration: true
    }
  });

  win.loadFile('index.html');
  win.removeMenu(); // This gets rid of File, Edit, etc.
}

app.whenReady().then(createWindow);
