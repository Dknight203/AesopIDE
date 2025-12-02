// electron.cjs
const path = require("path");
const { app, BrowserWindow, Menu } = require("electron");
require("dotenv").config();
const registerIpcHandlers = require("./ipcHandlers");

let windows = new Set();

function createWindow() {
  const win = new BrowserWindow({
    width: 1500,
    height: 950,
    webPreferences: {
      preload: path.join(__dirname, "preload", "index.js"),
      nodeIntegration: false,
      contextIsolation: true,
    },
  });

  if (process.env.VITE_DEV_SERVER_URL) {
    // Dev mode uses Vite dev server
    win.loadURL(process.env.VITE_DEV_SERVER_URL);
    win.webContents.openDevTools();
  } else {
    // Production uses bundled renderer
    win.loadFile(path.join(__dirname, "renderer", "index.html"));
  }

  win.on("closed", () => {
    windows.delete(win);
  });

  windows.add(win);
  return win;
}

function createMenu() {
  const template = [
    {
      label: "File",
      submenu: [
        { role: "quit" },
      ],
    },
    {
      label: "Window",
      submenu: [
        {
          label: "New Window",
          accelerator: "Ctrl+Shift+N",
          click: () => {
            createWindow();
          },
        },
        { type: "separator" },
        { role: "minimize" },
        { role: "close" },
      ],
    },
    {
      label: "Help",
      submenu: [
        {
          label: "Toggle DevTools",
          accelerator:
            process.platform === "darwin"
              ? "Alt+Command+I"
              : "Ctrl+Shift+I",
          click: (_item, browserWindow) => {
            if (browserWindow) {
              browserWindow.webContents.toggleDevTools();
            }
          },
        },
      ],
    },
  ];

  const menu = Menu.buildFromTemplate(template);
  Menu.setApplicationMenu(menu);
}

app.whenReady().then(() => {
  console.log("[AesopIDE] Environment Loaded:");
  console.log("SUPABASE_URL:", !!process.env.SUPABASE_URL);
  console.log("SUPABASE_SERVICE_ROLE:", !!process.env.SUPABASE_SERVICE_ROLE);
  console.log("GITHUB_READ_TOKEN:", !!process.env.GITHUB_READ_TOKEN);
  console.log("GITHUB_PUSH_TOKEN:", !!process.env.GITHUB_PUSH_TOKEN);
  console.log("GEMINI_API_KEY:", !!process.env.GEMINI_API_KEY);

  registerIpcHandlers();
  console.log("[AesopIDE] IPC Handlers registered.");

  createMenu();
  createWindow();

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});
