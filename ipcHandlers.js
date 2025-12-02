// ipcHandlers.js
const { ipcMain, dialog, BrowserWindow } = require("electron");
const path = require("path");
const fs = require("fs").promises;
const fsSync = require("fs");
const simpleGit = require("simple-git");
const { createClient } = require("@supabase/supabase-js");
const { GoogleGenerativeAI } = require("@google/generative-ai");

// Track current project root (folder opened in the IDE)
let currentRoot = process.cwd();

// Normalize a "relative path" argument that might be a string or an object
function normalizeRelPath(arg, objectKeys = []) {
  if (!arg) return ".";
  if (typeof arg === "string") return arg;

  if (typeof arg === "object" && arg !== null) {
    for (const key of objectKeys) {
      if (typeof arg[key] === "string" && arg[key].length > 0) {
        return arg[key];
      }
    }
  }

  return ".";
}

function ensureRoot() {
  // Fall back to process.cwd so we never throw just for reading the tree
  return currentRoot || process.cwd();
}

// Supabase client helper
let supabaseClient = null;
function getSupabaseClient() {
  if (supabaseClient) return supabaseClient;
  const url = process.env.SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE;
  if (!url || !serviceRoleKey) {
    throw new Error("SUPABASE_URL or SUPABASE_SERVICE_ROLE env var missing");
  }
  supabaseClient = createClient(url, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  return supabaseClient;
}

// Gemini helper
let geminiModel = null;
function getGeminiModel() {
  const apiKey =
    process.env.GEMINI_API_KEY || process.env.VITE_GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error("GEMINI_API_KEY or VITE_GEMINI_API_KEY not set in environment");
  }
  if (!geminiModel) {
    const genAI = new GoogleGenerativeAI(apiKey);
    // Use Gemini 2.5 Flash
    geminiModel = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });
  }
  return geminiModel;
}

function registerIpcHandlers() {
  // ---------------------------------------------------------------------------
  // PROJECT ROOT / FOLDER PICKER
  // ---------------------------------------------------------------------------

  ipcMain.handle("project:getRoot", async () => {
    return currentRoot;
  });

  ipcMain.handle("project:openFolder", async () => {
    const win = BrowserWindow.getFocusedWindow();
    const result = await dialog.showOpenDialog(win, {
      properties: ["openDirectory"],
    });

    if (result.canceled || !result.filePaths || result.filePaths.length === 0) {
      return { canceled: true, root: null };
    }

    const root = result.filePaths[0];
    currentRoot = root;

    return { canceled: false, root };
  });

  // Backwards compatible aliases used by some code paths
  ipcMain.handle("dialog:openFolder", async () => {
    const win = BrowserWindow.getFocusedWindow();
    const result = await dialog.showOpenDialog(win, {
      properties: ["openDirectory"],
    });

    if (result.canceled || !result.filePaths || result.filePaths.length === 0) {
      return { canceled: true, root: null };
    }

    const root = result.filePaths[0];
    currentRoot = root;

    return { canceled: false, root };
  });

  ipcMain.handle("app:getRoot", async () => {
    return currentRoot;
  });

  ipcMain.handle("app:setRoot", async (event, rootPath) => {
    if (!rootPath || typeof rootPath !== "string") {
      throw new Error("Invalid root path");
    }
    currentRoot = rootPath;
    return { ok: true, root: currentRoot };
  });

  // ---------------------------------------------------------------------------
  // FILESYSTEM
  // ---------------------------------------------------------------------------

  // FileTree calls this immediately on load; when no root is set yet, we use process.cwd()
  ipcMain.handle("fs:readDir", async (event, arg) => {
    const root = ensureRoot();
    // Accept either "src", ".", or { dir: "src" } or { path: "src" }
    const relPath = normalizeRelPath(arg, ["dir", "path"]);
    const target =
      relPath && relPath !== "." ? path.resolve(root, relPath) : root;

    const entries = await fs.readdir(target, { withFileTypes: true });

    return entries.map((entry) => {
      const full = path.join(target, entry.name);
      const relative = path.relative(root, full).replace(/\\/g, "/");
      return {
        name: entry.name,
        path: relative || ".",
        isDirectory: entry.isDirectory(),
      };
    });
  });

  ipcMain.handle("fs:readFile", async (event, arg) => {
    const root = ensureRoot();
    // Accept "src/renderer/App.jsx" or { filePath: "src/renderer/App.jsx" } or { path: "..." }
    const relPath = normalizeRelPath(arg, ["filePath", "path"]);
    if (!relPath || typeof relPath !== "string") {
      throw new Error("fs:readFile requires a relative path string");
    }
    const fullPath = path.resolve(root, relPath);
    const content = await fs.readFile(fullPath, "utf8");
    return content; // return plain string
  });

  ipcMain.handle("fs:writeFile", async (event, arg1, arg2) => {
    const root = ensureRoot();
    let relPath;
    let content;

    // Either (relPath, content) or ({ filePath, content })
    if (typeof arg1 === "string") {
      relPath = arg1;
      content = arg2;
    } else if (typeof arg1 === "object" && arg1 !== null) {
      relPath = arg1.filePath || arg1.path;
      content = arg1.content;
    }

    if (!relPath || typeof relPath !== "string") {
      throw new Error("fs:writeFile requires a relative path string");
    }

    const fullPath = path.resolve(root, relPath);
    const dir = path.dirname(fullPath);
    await fs.mkdir(dir, { recursive: true });
    await fs.writeFile(fullPath, content ?? "", "utf8");
    return { ok: true };
  });

  ipcMain.handle("fs:newFile", async (event, arg) => {
    const root = ensureRoot();
    const relPath = normalizeRelPath(arg, ["filePath", "path"]);
    if (!relPath || typeof relPath !== "string") {
      throw new Error("fs:newFile requires a relative path string");
    }

    const fullPath = path.resolve(root, relPath);
    const dir = path.dirname(fullPath);
    await fs.mkdir(dir, { recursive: true });

    if (!fsSync.existsSync(fullPath)) {
      await fs.writeFile(fullPath, "", "utf8");
    }

    return { ok: true };
  });

  ipcMain.handle("fs:newFolder", async (event, arg) => {
    const root = ensureRoot();
    // Accept "src/components" or { dir: "src/components" }
    const relPath = normalizeRelPath(arg, ["dir", "path"]);
    if (!relPath || typeof relPath !== "string") {
      throw new Error("fs:newFolder requires a relative path string");
    }

    const fullPath = path.resolve(root, relPath);
    await fs.mkdir(fullPath, { recursive: true });
    return { ok: true };
  });

  // ---------------------------------------------------------------------------
  // GIT using simple-git
  // ---------------------------------------------------------------------------

  function getGit() {
    const baseDir = ensureRoot();
    return simpleGit({ baseDir });
  }

  ipcMain.handle("git:status", async () => {
    try {
      const git = getGit();
      const status = await git.status();
      const branchLine = `## ${status.current || "(no branch)"}`;
      const fileLines = status.files.map(
        (f) => `${f.index}${f.working_tree} ${f.path}`
      );
      return { ok: true, output: [branchLine, ...fileLines].join("\n") };
    } catch (err) {
      console.error("[AesopIDE git:status error]", err);
      return { ok: false, output: err.message || String(err) };
    }
  });

  ipcMain.handle("git:commit", async (event, message) => {
    try {
      const git = getGit();
      const msg =
        message && typeof message === "string" && message.trim().length > 0
          ? message.trim()
          : "update";
      await git.add(".");
      const result = await git.commit(msg);
      return { ok: true, output: JSON.stringify(result) };
    } catch (err) {
      console.error("[AesopIDE git:commit error]", err);
      return { ok: false, output: err.message || String(err) };
    }
  });

  ipcMain.handle("git:push", async () => {
    try {
      const git = getGit();
      const result = await git.push();
      return { ok: true, output: JSON.stringify(result) };
    } catch (err) {
      console.error("[AesopIDE git:push error]", err);
      return { ok: false, output: err.message || String(err) };
    }
  });

  ipcMain.handle("git:pull", async () => {
    try {
      const git = getGit();
      const result = await git.pull();
      return { ok: true, output: JSON.stringify(result) };
    } catch (err) {
      console.error("[AesopIDE git:pull error]", err);
      return { ok: false, output: err.message || String(err) };
    }
  });

  // ---------------------------------------------------------------------------
  // ENV VARS IN PROJECT .env
  // ---------------------------------------------------------------------------

  ipcMain.handle("env:get", async (event, key) => {
    if (!key || typeof key !== "string") {
      throw new Error("env:get requires a key");
    }
    return process.env[key] ?? null;
  });

  ipcMain.handle("env:set", async (event, key, value) => {
    const root = ensureRoot();
    if (!key || typeof key !== "string") {
      throw new Error("env:set requires a key");
    }

    const envPath = path.join(root, ".env");
    let existing = "";

    if (fsSync.existsSync(envPath)) {
      existing = await fs.readFile(envPath, "utf8");
    }

    const lines = existing
      .split(/\r?\n/)
      .filter((line) => line.trim().length > 0);

    const keyLine = `${key}=${value ?? ""}`;
    const index = lines.findIndex((line) => line.startsWith(key + "="));
    if (index >= 0) {
      lines[index] = keyLine;
    } else {
      lines.push(keyLine);
    }

    await fs.writeFile(envPath, lines.join("\n"), "utf8");
    process.env[key] = value;
    return { ok: true };
  });

  // ---------------------------------------------------------------------------
  // PROMPT (Gemini) - used by the AI prompt window
  // ---------------------------------------------------------------------------

  ipcMain.handle("prompt:send", async (event, payloadOrText, maybeOptions = {}) => {
    try {
      const model = getGeminiModel();

      let systemPrompt = "";
      let userPrompt = "";
      let fileContext = null;
      let cursor = null;

      // Support two signatures:
      // 1) prompt:send(text, options)
      // 2) prompt:send({ prompt, systemPrompt, fileContext, cursor })
      if (
        typeof payloadOrText === "string" ||
        payloadOrText instanceof String
      ) {
        userPrompt = payloadOrText;
        if (maybeOptions && typeof maybeOptions === "object") {
          systemPrompt = maybeOptions.systemPrompt || "";
          fileContext = maybeOptions.fileContext || null;
          cursor = maybeOptions.cursor || null;
        }
      } else if (payloadOrText && typeof payloadOrText === "object") {
        userPrompt = payloadOrText.prompt || "";
        systemPrompt = payloadOrText.systemPrompt || "";
        fileContext = payloadOrText.fileContext || null;
        cursor = payloadOrText.cursor || null;
      }

      const parts = [];
      if (systemPrompt) {
        parts.push({ text: systemPrompt + "\n\n" });
      }
      if (fileContext) {
        parts.push({ text: "Project context:\n" + fileContext + "\n\n" });
      }
      if (cursor) {
        parts.push({ text: "Cursor context:\n" + cursor + "\n\n" });
      }
      parts.push({ text: userPrompt });

      const result = await model.generateContent({
        contents: [
          {
            role: "user",
            parts,
          },
        ],
      });

      const response = result.response;
      const outText =
        typeof response.text === "function" ? response.text() : "";

      return { ok: true, text: outText };
    } catch (err) {
      console.error("[AesopIDE prompt:send error]", err);
      return {
        ok: false,
        text: err.message || String(err),
      };
    }
  });

  // ---------------------------------------------------------------------------
  // SUPABASE TEST (simple connectivity check)
  // ---------------------------------------------------------------------------

  ipcMain.handle("supabase:test", async () => {
    try {
      const supabase = getSupabaseClient();
      const { data, error } = await supabase
        .from("profiles")
        .select("id")
        .limit(1);
      if (error) {
        throw error;
      }
      return { ok: true, rows: data.length };
    } catch (err) {
      console.error("[AesopIDE supabase:test error]", err);
      return {
        ok: false,
        error: err.message || String(err),
      };
    }
  });

  console.log("IPC Handlers registered.");
}

module.exports = registerIpcHandlers;
