const path = require('path');
const { app, BrowserWindow } = require('electron');

// Load environment variables
require('dotenv').config();

// IPC handlers (Supabase, filesystem, etc)
const registerIpcHandlers = require('./ipcHandlers');

function createWindow() {
  const win = new BrowserWindow({
    width: 1400,
    height: 900,
    webPreferences: {
      preload: path.join(__dirname, 'preload', 'index.js'),
    },
  });

  // Load Vite (dev) OR built index.html (prod)
  if (process.env.VITE_DEV_SERVER_URL) {
    // Dev mode: load Vite server
    win.loadURL(`${process.env.VITE_DEV_SERVER_URL}/src/renderer/index.html`);
    win.webContents.openDevTools();
  } else {
    // Production build
    win.loadFile(path.join(__dirname, 'renderer', 'index.html'));
  }
}

app.whenReady().then(() => {
  console.log("ENV Loaded:", {
    SUPABASE_URL: process.env.SUPABASE_URL ? "OK" : "MISSING",
    SUPABASE_SERVICE_ROLE: process.env.SUPABASE_SERVICE_ROLE ? "OK" : "MISSING",
  });

  // Register all backend APIs
  registerIpcHandlers();

  // Create main window
  createWindow();

  // macOS: reopen window
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

// Quit fully in Windows / Linux
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
