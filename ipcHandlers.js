// ipcHandlers.js
const { ipcMain, dialog, BrowserWindow } = require("electron");
const path = require("path");
const fs = require("fs").promises;
const fsSync = require("fs");
const simpleGit = require("simple-git");
const { GoogleGenerativeAI } = require("@google/generative-ai");
const { createClient } = require("@supabase/supabase-js");
const { spawn } = require('child_process');
const { nanoid } = require('nanoid');

// Track current project root (folder opened in the IDE)
let currentRoot = process.cwd();

// NEW: Track active commands by ID
const activeCommands = new Map();
const commandOutput = new Map();

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
        return { ok: true, path: relPath };
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

        return { ok: true, path: relPath };
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
        return { ok: true, path: relPath };
    });
    
    // ---------------------------------------------------------------------------
    // PHASE 4.1: CONVERSATION HISTORY
    // ---------------------------------------------------------------------------

    ipcMain.handle("history:save", async (event, messages) => {
        const root = ensureRoot();
        const historyPath = path.join(root, ".aesop", "history.json");
        
        try {
            // Ensure .aesop directory exists
            const dir = path.dirname(historyPath);
            await fs.mkdir(dir, { recursive: true });

            // Convert message timestamps (Date objects) to ISO strings for serialization
            const serializableMessages = messages.map(msg => ({
                ...msg,
                timestamp: msg.timestamp instanceof Date ? msg.timestamp.toISOString() : msg.timestamp
            }));

            await fs.writeFile(historyPath, JSON.stringify(serializableMessages, null, 2), "utf8");
            return { ok: true };
        } catch (err) {
            console.error("[AesopIDE history:save error]", err);
            return { ok: false, error: err.message || String(err) };
        }
    });

    ipcMain.handle("history:load", async () => {
        const root = ensureRoot();
        const historyPath = path.join(root, ".aesop", "history.json");

        if (!fsSync.existsSync(historyPath)) {
            return { ok: true, messages: [] }; // Return empty array if file doesn't exist
        }

        try {
            const content = await fs.readFile(historyPath, "utf8");
            const messages = JSON.parse(content);
            
            // Convert ISO strings back to Date objects
            const deserializedMessages = messages.map(msg => ({
                ...msg,
                timestamp: new Date(msg.timestamp)
            }));
            
            return { ok: true, messages: deserializedMessages };
        } catch (err) {
            console.error("[AesopIDE history:load error]", err);
            return { ok: false, error: err.message || String(err) };
        }
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
    // PHASE 3.4: COMMAND EXECUTION
    // ---------------------------------------------------------------------------

    ipcMain.handle("cmd:run", async (event, command) => {
        const root = ensureRoot();
        const commandId = nanoid(10);
        
        if (!command || typeof command !== "string") {
            return { ok: false, error: "Command string required." };
        }
        
        // Split command and arguments (simple approach for now)
        const parts = command.split(/\s+/).filter(p => p.length > 0);
        const cmd = parts[0];
        const args = parts.slice(1);
        
        // Initialize output buffer for this command
        commandOutput.set(commandId, `> ${command}\n`);
        const processStartTime = new Date();

        try {
            // Use shell: true to allow composite commands and system path resolution
            const child = spawn(cmd, args, { cwd: root, shell: true });
            activeCommands.set(commandId, child);

            child.stdout.on('data', (data) => {
                commandOutput.set(commandId, commandOutput.get(commandId) + data.toString());
            });

            child.stderr.on('data', (data) => {
                commandOutput.set(commandId, commandOutput.get(commandId) + data.toString());
            });

            const exitCode = await new Promise((resolve) => {
                child.on('close', resolve);
                child.on('error', (err) => {
                    commandOutput.set(commandId, commandOutput.get(commandId) + `\n--- ERROR ---\n${err.message}\n`);
                    resolve(1); // Non-zero exit code on error
                });
            });

            activeCommands.delete(commandId);
            const duration = new Date() - processStartTime;
            
            commandOutput.set(commandId, commandOutput.get(commandId) + `\n[Command finished in ${duration}ms with exit code ${exitCode}]`);

            return { ok: true, id: commandId, output: commandOutput.get(commandId), exitCode };

        } catch (err) {
            activeCommands.delete(commandId);
            return { ok: false, id: commandId, output: commandOutput.get(commandId), error: err.message || String(err) };
        }
    });

    ipcMain.handle("cmd:getOutput", (event, commandId) => {
        if (!commandId || !commandOutput.has(commandId)) {
            return { ok: false, error: "Command ID not found or output cleared." };
        }
        
        return { ok: true, output: commandOutput.get(commandId) };
    });

    ipcMain.handle("cmd:kill", (event, commandId) => {
        if (!commandId || !activeCommands.has(commandId)) {
            return { ok: false, error: "Command ID not found or already finished." };
        }
        
        const child = activeCommands.get(commandId);
        child.kill();
        activeCommands.delete(commandId);
        
        const output = commandOutput.get(commandId) + `\n[Command ${commandId} manually terminated.]`;
        commandOutput.set(commandId, output);
        
        return { ok: true, output: output };
    });


    // ---------------------------------------------------------------------------
    // CODEBASE SEARCH
    // ---------------------------------------------------------------------------

    ipcMain.handle("codebase:search", async (event, { query, options }) => {
        const root = ensureRoot();
        const { caseSensitive = false, maxResults = 100, fileExtensions = null } = options || {};
        const results = [];

        async function searchDir(dir) {
            if (results.length >= maxResults) return;

            const entries = await fs.readdir(dir, { withFileTypes: true });
            for (const entry of entries) {
                if (results.length >= maxResults) break;

                const fullPath = path.join(dir, entry.name);

                if (entry.isDirectory()) {
                    if (entry.name === "node_modules" || entry.name === ".git" || entry.name === "dist" || entry.name === "build") continue;
                    await searchDir(fullPath);
                } else {
                    // Check extension
                    if (fileExtensions) {
                        const ext = path.extname(entry.name).toLowerCase().replace('.', '');
                        if (!fileExtensions.includes(ext)) continue;
                    }

                    try {
                        const content = await fs.readFile(fullPath, "utf8");
                        const lines = content.split("\n");

                        for (let i = 0; i < lines.length; i++) {
                            const line = lines[i];
                            const match = caseSensitive
                                ? line.includes(query)
                                : line.toLowerCase().includes(query.toLowerCase());

                            if (match) {
                                const relPath = path.relative(root, fullPath).replace(/\\/g, "/");
                                results.push({
                                    file: relPath,
                                    line: i + 1,
                                    content: line.trim()
                                });
                                if (results.length >= maxResults) break;
                            }
                        }
                    } catch (err) {
                        // Ignore read errors
                    }
                }
            }
        }

        await searchDir(root);
        return { ok: true, results };
    });

    ipcMain.handle("codebase:findFiles", async (event, { pattern }) => {
        const root = ensureRoot();
        const results = [];
        const regex = new RegExp(pattern.replace(/\*/g, ".*"), "i");

        async function searchDir(dir) {
            const entries = await fs.readdir(dir, { withFileTypes: true });
            for (const entry of entries) {
                const fullPath = path.join(dir, entry.name);
                const relPath = path.relative(root, fullPath).replace(/\\/g, "/");

                if (entry.isDirectory()) {
                    if (entry.name === "node_modules" || entry.name === ".git" || entry.name === "dist" || entry.name === "build") continue;
                    await searchDir(fullPath);
                } else {
                    if (regex.test(entry.name) || regex.test(relPath)) {
                        results.push({
                            path: relPath,
                            name: entry.name
                        });
                    }
                }
            }
        }

        await searchDir(root);
        return { ok: true, results: results.slice(0, 50) };
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