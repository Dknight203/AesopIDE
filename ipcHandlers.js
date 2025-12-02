// ipcHandlers.js
const { ipcMain, dialog } = require("electron");
const path = require("path");
const fs = require("fs").promises;
const simpleGit = require("simple-git");
const { createClient } = require("@supabase/supabase-js");
const { GoogleGenerativeAI } = require("@google/generative-ai");

// Track current project root
let currentRoot = process.cwd();

function ensureRoot(explicitRoot) {
  return explicitRoot || currentRoot || process.cwd();
}

// Supabase client helper
function getSupabaseAdmin() {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE;

  if (!url || !key) {
    throw new Error("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE in .env");
  }

  return createClient(url, key, {
    auth: { persistSession: false }
  });
}

// Gemini client helper
let geminiModel = null;

function getGeminiModel() {
  const key = process.env.GEMINI_API_KEY;
  if (!key) {
    throw new Error("Missing GEMINI_API_KEY in .env");
  }

  if (!geminiModel) {
    const genAI = new GoogleGenerativeAI(key);
    geminiModel = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });
  }

  return geminiModel;
}

function registerIpcHandlers() {
  console.log("Registering IPC handlers...");

  // --------------------------------------------------
  // PROJECT ROOT
  // --------------------------------------------------

  // Ask what the current root is
  ipcMain.handle("project:getRoot", async () => {
    return ensureRoot(currentRoot);
  });

  // Open folder from the AesopIDE toolbar
  ipcMain.handle("project:openFolder", async () => {
    const result = await dialog.showOpenDialog({
      properties: ["openDirectory"]
    });

    if (result.canceled || !result.filePaths || !result.filePaths[0]) {
      return { canceled: true };
    }

    const root = result.filePaths[0];
    currentRoot = root;

    return { canceled: false, root };
  });

  // (Old name, unused by frontend but harmless to keep)
  ipcMain.handle("fs:openFolder", async () => {
    const result = await dialog.showOpenDialog({
      properties: ["openDirectory"]
    });

    if (result.canceled || !result.filePaths || !result.filePaths[0]) {
      return { canceled: true };
    }

    const root = result.filePaths[0];
    currentRoot = root;

    return { canceled: false, root };
  });

  // --------------------------------------------------
  // FILESYSTEM
  // --------------------------------------------------

  ipcMain.handle("fs:readDir", async (event, { dir }) => {
    const root = ensureRoot(currentRoot);
    const target = dir ? path.resolve(root, dir) : root;

    const entries = await fs.readdir(target, { withFileTypes: true });

    return entries.map((entry) => {
      const full = path.join(target, entry.name);
      return {
        name: entry.name,
        path: path
          .relative(root, full)
          .replace(/\\/g, "/"),
        isDirectory: entry.isDirectory()
      };
    });
  });

  ipcMain.handle("fs:readFile", async (event, { filePath }) => {
    const root = ensureRoot(currentRoot);
    const fullPath = path.resolve(root, filePath);
    const content = await fs.readFile(fullPath, "utf8");
    return { ok: true, content };
  });

  ipcMain.handle("fs:writeFile", async (event, { filePath, content }) => {
    const root = ensureRoot(currentRoot);
    const fullPath = path.resolve(root, filePath);

    await fs.writeFile(fullPath, content, "utf8");
    return { ok: true };
  });

  // --------------------------------------------------
  // GIT
  // --------------------------------------------------

  function makeGit() {
    const baseDir = ensureRoot(currentRoot);
    return simpleGit({ baseDir });
  }

  ipcMain.handle("git:status", async () => {
    try {
      const git = makeGit();
      const status = await git.status();

      let lines = [];
      lines.push(`On branch ${status.current || "unknown"}`);

      if (status.tracking) {
        lines.push(`Tracking ${status.tracking}`);
      }

      if (status.files.length === 0) {
        lines.push("Working tree clean");
      } else {
        lines.push("");
        lines.push("Changes:");
        status.files.forEach((f) => {
          lines.push(`${f.index}${f.working_tree} ${f.path}`);
        });
      }

      return {
        ok: true,
        text: lines.join("\n")
      };
    } catch (err) {
      return {
        ok: false,
        error: err.message || String(err)
      };
    }
  });

  ipcMain.handle("git:commit", async (event, { message }) => {
    try {
      const git = makeGit();
      const res = await git.commit(message || "AesopIDE commit");
      return {
        ok: true,
        summary: `Committed ${res.commit} (${res.summary.changes} changes, ${res.summary.insertions} insertions, ${res.summary.deletions} deletions)`
      };
    } catch (err) {
      return {
        ok: false,
        error: err.message || String(err)
      };
    }
  });

  ipcMain.handle("git:push", async () => {
    try {
      const git = makeGit();
      const res = await git.push();
      return {
        ok: true,
        summary: res ? JSON.stringify(res) : "Push complete"
      };
    } catch (err) {
      return {
        ok: false,
        error: err.message || String(err)
      };
    }
  });

  ipcMain.handle("git:pull", async () => {
    try {
      const git = makeGit();
      const res = await git.pull();
      return {
        ok: true,
        summary: res ? JSON.stringify(res) : "Pull complete"
      };
    } catch (err) {
      return {
        ok: false,
        error: err.message || String(err)
      };
    }
  });

  // --------------------------------------------------
  // SUPABASE TEST
  // --------------------------------------------------

  ipcMain.handle("supabase:test", async () => {
    try {
      const supabase = getSupabaseAdmin();
      const { data, error } = await supabase.from("profiles").select("id").limit(1);

      if (error) {
        return {
          ok: false,
          message: `Supabase error: ${error.message}`
        };
      }

      return {
        ok: true,
        message: `Supabase connected. Sample rows: ${data ? data.length : 0}`
      };
    } catch (err) {
      return {
        ok: false,
        message: err.message || String(err)
      };
    }
  });

  // --------------------------------------------------
  // GEMINI TEST
  // --------------------------------------------------

  ipcMain.handle("gemini:test", async () => {
    try {
      const model = getGeminiModel();
      const result = await model.generateContent(
        "Reply with exactly this text: AesopIDE Gemini test successful."
      );
      const text = result.response.text().trim();

      return {
        ok: true,
        message: text
      };
    } catch (err) {
      return {
        ok: false,
        message: err.message || String(err)
      };
    }
  });

  // --------------------------------------------------
  // MAIN PROMPT
  // --------------------------------------------------

  ipcMain.handle("prompt:send", async (event, { prompt, fileContext, cursor }) => {
    try {
      const model = getGeminiModel();

      let finalPrompt = prompt;

      if (fileContext) {
        finalPrompt =
          "You are AesopIDE, an AI pair programmer working inside a desktop IDE.\n\n" +
          "Here is the current file context:\n\n" +
          fileContext +
          "\n\n" +
          "User request:\n" +
          prompt;
      }

      if (cursor && cursor.file && typeof cursor.line === "number") {
        finalPrompt +=
          `\n\nCursor location: file ${cursor.file} line ${cursor.line}. Focus your answer on this region when suggesting edits.`;
      }

      const result = await model.generateContent(finalPrompt);
      const text = result.response.text();

      return {
        ok: true,
        text
      };
    } catch (err) {
      console.error("[AesopIDE prompt error]", err);
      return {
        ok: false,
        text: err.message || String(err)
      };
    }
  });

  console.log("IPC Handlers registered.");
}

module.exports = registerIpcHandlers;
