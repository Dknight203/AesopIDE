/* ipcHandlers.js - full file will be replaced (backup made) with tool handlers included */
const { ipcMain, dialog, BrowserWindow } = require("electron");
const path = require("path");
const fs = require("fs").promises;
const fsSync = require("fs");
const simpleGit = require("simple-git");
const { createClient } = require("@supabase/supabase-js");
const { GoogleGenerativeAI } = require("@google/generative-ai");
const { exec } = require("child_process");

// Track current project root
let currentRoot = process.cwd();

function normalizeRelPath(arg, objectKeys = []) {
  if (!arg) return ".";
  if (typeof arg === "string") return arg;
  if (typeof arg === "object" && arg !== null) {
    for (const key of objectKeys) if (typeof arg[key] === "string" && arg[key].length>0) return arg[key];
  }
  return ".";
}
function ensureRoot() { return currentRoot || process.cwd(); }

function registerIpcHandlers() {
  ipcMain.handle("project:getRoot", async () => currentRoot);
  ipcMain.handle("project:openFolder", async () => {
    const win = BrowserWindow.getFocusedWindow();
    const result = await dialog.showOpenDialog(win, { properties: ["openDirectory"] });
    if (result.canceled || !result.filePaths || result.filePaths.length===0) return { canceled:true, root:null };
    currentRoot = result.filePaths[0];
    return { canceled:false, root: currentRoot };
  });

  // Filesystem handlers (readDir/readFile/writeFile/newFile/newFolder)
  ipcMain.handle("fs:readDir", async (event, arg) => {
    const root = ensureRoot();
    const relPath = normalizeRelPath(arg, ["dir","path"]);
    const target = relPath && relPath !== "." ? path.resolve(root, relPath) : root;
    const entries = await fs.readdir(target, { withFileTypes: true });
    return entries.map(e => ({ name: e.name, path: path.relative(root, path.join(target, e.name)).replace(/\\/g,"/") || ".", isDirectory: e.isDirectory() }));
  });

  ipcMain.handle("fs:readFile", async (event, arg) => {
    const root = ensureRoot();
    const relPath = normalizeRelPath(arg, ["filePath","path"]);
    if (!relPath || typeof relPath !== "string") throw new Error("fs:readFile requires a relative path string");
    const full = path.resolve(root, relPath);
    return await fs.readFile(full, "utf8");
  });

  ipcMain.handle("fs:writeFile", async (event, arg1, arg2) => {
    const root = ensureRoot();
    let relPath, content;
    if (typeof arg1 === "string") { relPath = arg1; content = arg2; } else if (typeof arg1 === "object" && arg1 !== null) { relPath = arg1.filePath || arg1.path; content = arg1.content; }
    if (!relPath || typeof relPath !== "string") throw new Error("fs:writeFile requires a relative path string");
    const full = path.resolve(root, relPath);
    const dir = path.dirname(full);
    await fs.mkdir(dir, { recursive:true });
    await fs.writeFile(full, content ?? "", "utf8");
    return { ok:true };
  });

  // Codebase search handlers are expected to exist already (Phase1). Add tools handlers below.

  // Simple command runner (stores outputs)
  const commandRuns = new Map();
  function genCmdId() { return `cmd-${Date.now()}-${Math.floor(Math.random()*10000)}`; }
  function runShellCommand(cmd, cwd) {
    return new Promise((resolve) => {
      const id = genCmdId();
      commandRuns.set(id, { id, cmd, startTime: Date.now(), complete:false, stdout:"", stderr:"", exitCode:null });
      const child = exec(cmd, { cwd }, (error, stdout, stderr) => {
        const entry = commandRuns.get(id);
        if (!entry) return resolve({ ok:false, error:"missing entry" });
        entry.stdout += stdout || "";
        entry.stderr += stderr || "";
        entry.complete = true;
        entry.exitCode = error ? (error.code ?? 1) : 0;
        resolve({ ok:true, id, stdout: entry.stdout, stderr: entry.stderr, exitCode: entry.exitCode });
      });
      child.stdout?.on("data", d => { const e = commandRuns.get(id); if (e) e.stdout += String(d); });
      child.stderr?.on("data", d => { const e = commandRuns.get(id); if (e) e.stderr += String(d); });
    });
  }

  ipcMain.handle("tools:runCommand", async (event, cmd) => {
    try {
      if (!cmd || typeof cmd !== "string") throw new Error("tools:runCommand requires a string command");
      const root = ensureRoot();
      const res = await runShellCommand(cmd, root);
      return res;
    } catch (err) {
      console.error("[tools:runCommand error]", err);
      return { ok:false, error: err.message || String(err) };
    }
  });

  ipcMain.handle("tools:getCommandOutput", async (event, id) => {
    try {
      if (!id || typeof id !== "string") throw new Error("tools:getCommandOutput requires an id");
      const entry = commandRuns.get(id);
      if (!entry) return { ok:false, error:"Unknown id" };
      return { ok:true, ...entry };
    } catch (err) {
      console.error("[tools:getCommandOutput error]", err);
      return { ok:false, error: err.message || String(err) };
    }
  });

  console.log("IPC Handlers registered.");
}

module.exports = registerIpcHandlers;
