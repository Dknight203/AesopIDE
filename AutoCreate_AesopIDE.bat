@echo off
setlocal enabledelayedexpansion

echo Creating folders...

mkdir src
mkdir src\renderer
mkdir src\preload
mkdir src\main

echo Writing package.json...
> package.json echo {
>> package.json echo   "name": "aesop-ide",
>> package.json echo   "version": "1.0.0",
>> package.json echo   "description": "Unlimited AntiGravity Replacement IDE",
>> package.json echo   "main": "electron.js",
>> package.json echo   "scripts": {
>> package.json echo     "start": "electron .",
>> package.json echo     "dev": "concurrently \"vite\" \"electron .\"",
>> package.json echo     "build": "vite build && electron-builder"
>> package.json echo   },
>> package.json echo   "dependencies": {
>> package.json echo     "concurrently": "^8.2.0",
>> package.json echo     "electron": "^28.0.0"
>> package.json echo   },
>> package.json echo   "devDependencies": {
>> package.json echo     "vite": "^4.5.0",
>> package.json echo     "@vitejs/plugin-react": "^4.0.4",
>> package.json echo     "react": "^18.3.1",
>> package.json echo     "react-dom": "^18.3.1"
>> package.json echo   }
>> package.json echo }

echo Writing electron.js...
> electron.js echo const { app, BrowserWindow } = require("electron");
>> electron.js echo const path = require("path");
>> electron.js echo
>> electron.js echo function createWindow() {
>> electron.js echo   const win = new BrowserWindow({
>> electron.js echo     width: 1400,
>> electron.js echo     height: 900,
>> electron.js echo     webPreferences: {
>> electron.js echo       preload: path.join(__dirname, "src/preload/preload.js")
>> electron.js echo     }
>> electron.js echo   });
>> electron.js echo
>> electron.js echo   win.loadURL("http://localhost:5173");
>> electron.js echo }
>> electron.js echo
>> electron.js echo app.whenReady().then(createWindow);

echo Writing vite.config.js...
> vite.config.js echo import { defineConfig } from "vite";
>> vite.config.js echo import react from "@vitejs/plugin-react";
>> vite.config.js echo
>> vite.config.js echo export default defineConfig({
>> vite.config.js echo   plugins: [react()],
>> vite.config.js echo   root: "./src/renderer",
>> vite.config.js echo   base: "",
>> vite.config.js echo   server: {
>> vite.config.js echo     port: 5173
>> vite.config.js echo   },
>> vite.config.js echo   build: {
>> vite.config.js echo     outDir: "../../dist",
>> vite.config.js echo     emptyOutDir: true
>> vite.config.js echo   }
>> vite.config.js echo });

echo Writing src/preload/preload.js...
> src/preload/preload.js echo const { contextBridge } = require("electron");
>> src/preload/preload.js echo
>> src/preload/preload.js echo contextBridge.exposeInMainWorld("AesopAPI", {
>> src/preload/preload.js echo   ping: () => "pong"
>> src/preload/preload.js echo });

echo Writing src/main/main.js...
> src/main/main.js echo // Backend logic will be added later.

echo Writing src/renderer/index.html...
> src/renderer/index.html echo <!DOCTYPE html>
>> src/renderer/index.html echo <html lang="en">
>> src/renderer/index.html echo <head>
>> src/renderer/index.html echo   <meta charset="UTF-8" />
>> src/renderer/index.html echo   <title>AesopIDE</title>
>> src/renderer/index.html echo </head>
>> src/renderer/index.html echo <body>
>> src/renderer/index.html echo   <div id="root"></div>
>> src/renderer/index.html echo   <script type="module" src="/main.jsx"></script>
>> src/renderer/index.html echo </body>
>> src/renderer/index.html echo </html>

echo Writing src/renderer/main.jsx...
> src/renderer/main.jsx echo import React from "react";
>> src/renderer/main.jsx echo import ReactDOM from "react-dom/client";
>> src/renderer/main.jsx echo import App from "./App.jsx";
>> src/renderer/main.jsx echo
>> src/renderer/main.jsx echo ReactDOM.createRoot(document.getElementById("root")).render(
>> src/renderer/main.jsx echo   <React.StrictMode>
>> src/renderer/main.jsx echo     <App />
>> src/renderer/main.jsx echo   </React.StrictMode>
>> src/renderer/main.jsx echo );

echo Writing src/renderer/App.jsx...
> src/renderer/App.jsx echo export default function App() {
>> src/renderer/App.jsx echo   return (
>> src/renderer/App.jsx echo     <div style={{
>> src/renderer/App.jsx echo       display: "flex",
>> src/renderer/App.jsx echo       height: "100vh",
>> src/renderer/App.jsx echo       background: "#141414",
>> src/renderer/App.jsx echo       color: "white",
>> src/renderer/App.jsx echo       justifyContent: "center",
>> src/renderer/App.jsx echo       alignItems: "center",
>> src/renderer/App.jsx echo       fontSize: "32px"
>> src/renderer/App.jsx echo     }}>
>> src/renderer/App.jsx echo       AesopIDE Base App Loaded
>> src/renderer/App.jsx echo     </div>
>> src/renderer/App.jsx echo   );
>> src/renderer/App.jsx echo }

echo All files created successfully!
echo.
echo Next:
echo 1. Run: npm install
echo 2. Run: npm run dev
echo.
pause
