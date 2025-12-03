# tools/apply_phase2.ps1
# Run from repository root: PowerShell -ExecutionPolicy Bypass -File .\tools\apply_phase2.ps1

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

$repoRoot = (Get-Location).Path
if (-not (Test-Path (Join-Path $repoRoot 'package.json')) -and -not (Test-Path (Join-Path $repoRoot 'ipcHandlers.js'))) {
    Write-Error "Run this script from repository root (where package.json or ipcHandlers.js exists)."
    exit 1
}

$branch = 'feature/phase2-tool-system'
$backupRoot = Join-Path $repoRoot ('.backup_phase2_' + [int][double]::Parse((Get-Date -UFormat %s)))
New-Item -ItemType Directory -Force -Path $backupRoot | Out-Null

function Backup-IfExists($relPath) {
    $abs = Join-Path $repoRoot $relPath
    if (Test-Path $abs) {
        $dest = Join-Path $backupRoot $relPath
        $destDir = Split-Path $dest -Parent
        if (-not (Test-Path $destDir)) { New-Item -ItemType Directory -Force -Path $destDir | Out-Null }
        Copy-Item -Force -Path $abs -Destination $dest
        Write-Host "Backed up $relPath -> $dest"
    }
}

function Write-RepoFile($relPath, $content) {
    $abs = Join-Path $repoRoot $relPath
    $dir = Split-Path $abs -Parent
    if (-not (Test-Path $dir)) { New-Item -ItemType Directory -Force -Path $dir | Out-Null }
    $content | Set-Content -LiteralPath $abs -Encoding UTF8
    Write-Host "Wrote $relPath"
}

# Files to create/overwrite (single-quoted here-strings to avoid interpolation)
$files = @{}

$files['src/renderer/lib/tools/framework.js'] = @'
/* src/renderer/lib/tools/framework.js
   Tool registry + executor for Phase 2
*/
import { readFile, writeFile, readDirectory } from "../fileSystem";
import { searchCode, findFilesByName } from "../codebase/search";
import { scanProject, filterByExtension } from "../codebase/indexer";

const tools = new Map();

function validateParams(spec = {}, params = {}) {
  const errors = [];
  for (const [k, m] of Object.entries(spec)) {
    if (m.required && (params[k] === undefined || params[k] === null)) errors.push(`Missing required param: ${k}`);
  }
  return errors;
}

export function registerTool(def) {
  if (!def || !def.name || typeof def.fn !== 'function') throw new Error('Invalid tool');
  tools.set(def.name, def);
}

export function getTool(name) { return tools.get(name); }
export function listTools() { return Array.from(tools.values()).map(t => ({ name: t.name, description: t.description, params: t.params || {} })); }

export async function executeTool(name, params = {}) {
  const tool = getTool(name);
  if (!tool) throw new Error('Tool not found: ' + name);
  const errors = validateParams(tool.params || {}, params);
  if (errors.length) {
    const e = new Error('Invalid parameters: ' + errors.join('; '));
    e.validation = errors;
    throw e;
  }
  return await tool.fn(params);
}

// Built-ins (renderer side wrappers)
registerTool({
  name: 'readFile',
  description: 'Read file content relative to project root',
  params: { path: { type: 'string', required: true } },
  fn: async ({ path }) => ({ path, content: await readFile(path) })
});

registerTool({
  name: 'writeFile',
  description: 'Write content to file (destructive). Must confirm in UI.',
  params: { path: { type: 'string', required: true }, content: { type: 'string', required: true } },
  fn: async ({ path, content }) => { await writeFile(path, content); return { path, ok: true }; }
});

registerTool({
  name: 'listDirectory',
  description: 'List directory contents',
  params: { path: { type: 'string', required: false } },
  fn: async ({ path = '.' }) => ({ path, entries: await readDirectory(path) })
});

registerTool({
  name: 'searchCode',
  description: 'Search indexed files',
  params: { query: { type: 'string', required: true }, fileExtensions: { type: 'array', required: false }, caseSensitive: { type: 'boolean', required: false } },
  fn: async ({ query, fileExtensions = null, caseSensitive = false }) => {
    const index = await scanProject('.');
    const files = fileExtensions ? filterByExtension(index, fileExtensions) : index;
    const results = await searchCode(query, files, { caseSensitive, maxResults: 200 });
    return { query, results };
  }
});

registerTool({
  name: 'findFiles',
  description: 'Find files by pattern',
  params: { pattern: { type: 'string', required: true } },
  fn: async ({ pattern }) => ({ pattern, results: findFilesByName(pattern, await scanProject('.')) })
});

registerTool({
  name: 'getFileTree',
  description: 'Return project file index',
  params: {},
  fn: async () => ({ index: await scanProject('.') })
});

// runCommand and getCommandOutput are implemented in preload/ipc
registerTool({
  name: 'runCommand',
  description: 'Execute shell command via backend',
  params: { cmd: { type: 'string', required: true } },
  fn: async ({ cmd }) => {
    if (!window.aesop || !window.aesop.tools || typeof window.aesop.tools.runCommand !== 'function') throw new Error('runCommand not available');
    return await window.aesop.tools.runCommand(cmd);
  }
});

registerTool({
  name: 'getCommandOutput',
  description: 'Retrieve output for a previously run command',
  params: { id: { type: 'string', required: true } },
  fn: async ({ id }) => {
    if (!window.aesop || !window.aesop.tools || typeof window.aesop.tools.getCommandOutput !== 'function') throw new Error('getCommandOutput not available');
    return await window.aesop.tools.getCommandOutput(id);
  }
});

export default { registerTool, getTool, listTools, executeTool };
'@

$files['src/renderer/lib/ai/toolParser.js'] = @'
/* src/renderer/lib/ai/toolParser.js
   Parses tool calls from AI text.
*/
function tryParseJSON(s) {
  try { return JSON.parse(s); } catch { return null; }
}

export default function parseToolCalls(text) {
  if (!text || typeof text !== "string") return [];
  const calls = [];

  // JSON fenced blocks with a tool object
  const fenced = /```(?:json|tool)?\s*([\s\S]*?)```/gi;
  let m;
  while ((m = fenced.exec(text)) !== null) {
    const inner = m[1].trim();
    const parsed = tryParseJSON(inner);
    if (parsed && parsed.tool) calls.push({ tool: parsed.tool, params: parsed.params || {} , raw: inner });
    else if (parsed && parsed.name) calls.push({ tool: parsed.name || parsed.tool, params: parsed.args || parsed.params || {} , raw: inner });
  }

  // Inline JSON after marker: AesopTool: runCommand {"cmd":"git status"}
  const inlineJson = /Aesop(?:Tool|IDE tool):\s*([^\s{]+)\s*(\{[\s\S]*?\})/gi;
  while ((m = inlineJson.exec(text)) !== null) {
    const tool = m[1].trim();
    const obj = tryParseJSON(m[2]);
    if (tool) calls.push({ tool, params: obj || {}, raw: m[0] });
  }

  // Simple key=value: AesopTool: writeFile path=src/foo.js content="..."
  const simple = /Aesop(?:Tool|IDE tool):\s*([^\s]+)\s*([^\n`]+)/gi;
  while ((m = simple.exec(text)) !== null) {
    const tool = m[1].trim();
    const rest = (m[2] || "").trim();
    const params = {};
    const kv = /([a-zA-Z0-9_\-]+)=(".*?"|'.*?'|\S+)/g;
    let k;
    while ((k = kv.exec(rest)) !== null) {
      let v = k[2];
      if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1);
      params[k[1]] = v;
    }
    if (tool) calls.push({ tool, params, raw: m[0] });
  }

  return calls;
}
'@

$files['src/renderer/lib/ai/systemPrompt.js'] = @'
/* src/renderer/lib/ai/systemPrompt.js
   System prompt documents tools and usage for the assistant.
*/
export const SYSTEM_PROMPT = `
You are Aesop, an advanced AI coding assistant integrated into AesopIDE.
You may request the IDE to perform structured tool calls. Use JSON fenced blocks:

Destructive operations require explicit user confirmation.
`
'@

$files['src/renderer/components/ConfirmModal.jsx'] = @'
/* src/renderer/components/ConfirmModal.jsx */
import React, { useEffect, useRef } from "react";
import "../styles/app.css";

export default function ConfirmModal({ title, message, children, confirmLabel = "Confirm", cancelLabel = "Cancel", onConfirm, onCancel }) {
  const ref = useRef(null);
  useEffect(() => { ref.current?.focus(); }, []);
  return (
    <div className="modal-overlay" role="dialog" aria-modal="true">
      <div className="modal-content" style={{ width: "720px", maxWidth: "95vw" }}>
        <div className="modal-header">
          <span className="modal-title">{title}</span>
          <button className="modal-close" onClick={onCancel}>✕</button>
        </div>
        <div className="modal-body">
          <p className="modal-message">{message}</p>
          {children ? <div style={{ marginTop:12, padding:12, background:"var(--bg-dark)", border:"1px solid var(--border)", borderRadius:6, maxHeight:"45vh", overflow:"auto", fontFamily:"var(--font-mono)" }}>{children}</div> : null}
        </div>
        <div className="modal-footer">
          <button className="btn btn-secondary" onClick={onCancel}>{cancelLabel}</button>
          <button ref={ref} className="btn btn-primary" onClick={onConfirm} style={{ marginLeft:8 }}>{confirmLabel}</button>
        </div>
      </div>
    </div>
  );
}
'@

$files['src/renderer/components/PromptPanel.jsx'] = @'
/* src/renderer/components/PromptPanel.jsx
   Updated to detect tool calls and require confirmation for destructive actions.
*/
import React, { useState, useRef, useEffect } from "react";
import "../styles/prompt.css";
import { askGemini } from "../lib/gemini";
import { SYSTEM_PROMPT } from "../lib/ai/systemPrompt";
import { buildFileContext } from "../lib/codebase/context";
import ConfirmModal from "./ConfirmModal";
import parseToolCalls from "../lib/ai/toolParser";
import { executeTool } from "../lib/tools/framework";

export default function PromptPanel({ onClose, onApplyCode, activeTab, rootPath, codebaseIndex }) {
  const [messages, setMessages] = useState([{ role:"assistant", content:"Hello. I am your AI assistant inside AesopIDE.", timestamp: new Date() }]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [confirmRequest, setConfirmRequest] = useState(null);
  const messagesEndRef = useRef(null);
  const inputRef = useRef(null);

  useEffect(() => { messagesEndRef.current?.scrollIntoView({ behavior:"smooth" }); }, [messages]);
  useEffect(() => { inputRef.current?.focus(); }, []);

  async function handleSend() {
    if (!input.trim() || isLoading) return;
    const text = input;
    setMessages(prev => [...prev, { role:"user", content:text, timestamp: new Date() }]);
    setInput(""); setIsLoading(true);
    try {
      let fileContext = "";
      if (activeTab && activeTab.path) fileContext = await buildFileContext(activeTab.path, codebaseIndex || [], { includeImports:true, includeImporters:true });
      const reply = await askGemini(text, { systemPrompt: SYSTEM_PROMPT, fileContext });
      setMessages(prev => [...prev, { role:"assistant", content:reply, timestamp:new Date() }]);

      const toolCalls = parseToolCalls(reply || "");
      if (toolCalls.length) {
        for (const call of toolCalls) {
          const { tool, params } = call;
          setMessages(prev => [...prev, { role:"assistant", content:`⏳ Tool: ${tool}`, timestamp:new Date() }]);
          const destructive = tool === "writeFile" || (tool === "runCommand" && typeof params.cmd === "string" && /git\s+push|rm\s+|del\s+/i.test(params.cmd));
          if (destructive) {
            setConfirmRequest({
              title: "Confirm AI tool action",
              message: `The assistant requested to run tool "${tool}". Confirm to execute.`,
              content: JSON.stringify({ tool, params }, null, 2),
              onConfirm: async () => {
                try {
                  const res = await executeTool(tool, params);
                  setMessages(prev => [...prev, { role:"assistant", content:`✅ ${tool} result:\\n${JSON.stringify(res, null, 2)}`, timestamp:new Date() }]);
                } catch (e) {
                  setMessages(prev => [...prev, { role:"assistant", content:`❌ Tool error: ${e.message || String(e)}`, timestamp:new Date() }]);
                }
                setConfirmRequest(null);
              },
              onCancel: () => setConfirmRequest(null)
            });
          } else {
            try {
              const res = await executeTool(tool, params);
              setMessages(prev => [...prev, { role:"assistant", content:`✅ ${tool} result:\\n${JSON.stringify(res, null, 2)}`, timestamp:new Date() }]);
              if (tool === "readFile" && res && res.content && onApplyCode) onApplyCode(`AesopIDE open file: ${res.path}`);
            } catch (e) {
              setMessages(prev => [...prev, { role:"assistant", content:`❌ Tool error: ${e.message || String(e)}`, timestamp:new Date() }]);
            }
          }
        }
      } else {
        // Existing flow: if reply contains actionable code, ask confirmation before applying
        if (/\bAesopIDE open file:/i.test(reply)) { setTimeout(() => onApplyCode(reply), 100); }
        else if (reply.match(/```[\s\S]*?```/) && onApplyCode) {
          setConfirmRequest({ title:"AI suggests changes", message:"Review and confirm to apply AI-suggested edits.", content: reply, onConfirm: () => { onApplyCode(reply); setConfirmRequest(null); }, onCancel: () => setConfirmRequest(null) });
        }
      }
    } catch (err) {
      setMessages(prev => [...prev, { role:"assistant", content:"Error: " + (err.message || String(err)), timestamp:new Date() }]);
    } finally { setIsLoading(false); }
  }

  function renderMessageContent(content) {
    if (!content || typeof content !== "string") return content;
    const filePathPattern = /((?:[\w-]+\/)*[\w-]+\.\w+)/g;
    const parts = []; let last=0; let m;
    while ((m = filePathPattern.exec(content)) !== null) {
      if (m.index > last) parts.push(content.substring(last, m.index));
      const fp = m[1];
      parts.push(<span key={`fp-${m.index}`} className="file-link" onClick={() => onApplyCode && onApplyCode(`AesopIDE open file: ${fp}`)}>{fp}</span>);
      last = m.index + m[0].length;
    }
    if (last < content.length) parts.push(content.substring(last));
    return parts.length ? parts : content;
  }

  return (
    <div className="prompt-panel">
      <div className="prompt-header"><div className="prompt-header-left"><span className="prompt-title">✨ AI Assistant</span></div><div className="prompt-header-right"><button className="prompt-close-btn" onClick={onClose}>✕</button></div></div>
      <div className="prompt-messages scrollable">
        {messages.map((m,i) => <div key={i} className={`message ${m.role==="user"?"message-user":"message-assistant"}`}><div className="message-header"><span className="message-role">{m.role==="user"?"👤 You":"🤖 Assistant"}</span><span className="message-time">{m.timestamp.toLocaleTimeString()}</span></div><div className="message-content">{renderMessageContent(m.content)}</div></div>)}
        {isLoading && <div className="message message-assistant"><div className="message-header"><span className="message-role">🤖 Assistant</span></div><div className="message-content"><div className="loading-dots"><span></span><span></span><span></span></div></div></div>}
        <div ref={messagesEndRef} />
      </div>
      <div className="prompt-input-area"><textarea ref={inputRef} className="prompt-input" rows={3} value={input} onChange={e => setInput(e.target.value)} onKeyDown={e => { if (e.key==="Enter" && !e.shiftKey) { e.preventDefault(); handleSend(); } }} placeholder="Ask me anything..." /></div>
      <div style={{ padding: 12, display:'flex', justifyContent:'flex-end' }}><button className="prompt-send-btn" onClick={handleSend} disabled={!input.trim() || isLoading}>{isLoading ? '⏳' : '📤'} Send</button></div>

      {confirmRequest && <ConfirmModal title={confirmRequest.title} message={confirmRequest.message} onConfirm={confirmRequest.onConfirm} onCancel={confirmRequest.onCancel} confirmLabel="Apply" cancelLabel="Cancel"><pre style={{ whiteSpace:'pre-wrap', margin:0 }}>{(() => { const txt = confirmRequest.content || ""; const f = txt.match(/```(?:[a-zA-Z0-9]+)?\s*\n([\s\S]*?)```/); if (f && f[1]) return f[1].trim(); return txt.length>1000? txt.substring(0,1000) + "\n\n...[truncated]": txt; })()}</pre></ConfirmModal>}
    </div>
  );
}
'@

$files['preload/index.js'] = @'
/* preload/index.js - expose safe APIs to renderer */
const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("aesop", {
  project: {
    getRoot: () => ipcRenderer.invoke("project:getRoot"),
    openFolder: () => ipcRenderer.invoke("project:openFolder"),
  },
  fs: {
    readDir: (dir) => ipcRenderer.invoke("fs:readDir", { dir }),
    readFile: (filePath) => ipcRenderer.invoke("fs:readFile", { filePath }),
    writeFile: (filePath, content) => ipcRenderer.invoke("fs:writeFile", { filePath, content }),
    newFile: (filePath) => ipcRenderer.invoke("fs:newFile", { filePath }),
    newFolder: (dir) => ipcRenderer.invoke("fs:newFolder", { dir }),
  },
  git: {
    status: () => ipcRenderer.invoke("git:status"),
    commit: (message) => ipcRenderer.invoke("git:commit", message),
    push: () => ipcRenderer.invoke("git:push"),
    pull: () => ipcRenderer.invoke("git:pull"),
  },
  prompt: {
    send: (promptText, options = {}) => ipcRenderer.invoke("prompt:send", {
      prompt: promptText,
      systemPrompt: options.systemPrompt || "",
      fileContext: options.fileContext || null,
      cursor: options.cursor || null,
    }),
  },
  supabase: {
    test: () => ipcRenderer.invoke("supabase:test"),
  },
  tools: {
    runCommand: (cmd) => ipcRenderer.invoke("tools:runCommand", cmd),
    getCommandOutput: (id) => ipcRenderer.invoke("tools:getCommandOutput", id),
  },
});
'@

$files['ipcHandlers.js'] = @'
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
'@

# Backup existing targets
foreach ($rel in $files.Keys) { Backup-IfExists $rel }

# Create/switch branch (no prompts)
try {
  git rev-parse --verify $branch 2>$null
  git checkout $branch
  Write-Host "Checked out existing branch $branch"
} catch {
  git checkout -b $branch
  Write-Host "Created and checked out branch $branch"
}

# Write files
foreach ($rel in $files.Keys) {
  Write-RepoFile $rel $files[$rel]
}

# Stage & commit
try {
  git add -A
  git commit -m "Phase2: tool system (framework, parser, preload, prompt updates, ipc handlers)"
  Write-Host "Committed changes on $branch"
} catch {
  Write-Warning "Nothing to commit or commit failed"
}

Write-Host "`nDone. Backups at: $backupRoot"
Write-Host "Run `npm install` if needed, then `npm run dev` to test the app."
