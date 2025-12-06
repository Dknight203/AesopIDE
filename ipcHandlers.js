const { ipcMain, dialog, BrowserWindow, shell } = require("electron");
const fs = require("fs").promises;
const fsSync = require("fs");
const path = require("path");
const simpleGit = require("simple-git");
const { GoogleGenerativeAI } = require("@google/generative-ai");
const { createClient } = require("@supabase/supabase-js");
const { spawn } = require('child_process');
const { nanoid } = require('nanoid/non-secure');


// 検 PHASE 4 & 6 TABLE NAMES
const GLOBAL_MEMORY_TABLE = "aesopide_global_memory";
const DEVELOPER_LIBRARY_TABLE = "aesopide_developer_library"; // New table name for RAG chunks/embeddings

// Track current project root (folder opened in the IDE)
let currentRoot = process.cwd();

// Track active commands by ID
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

// 検 NEW: Embedding model instance for RAG (uses a fast, dedicated model)
let embeddingModel = null;
function getEmbeddingModel() {
    const apiKey =
        process.env.GEMINI_API_KEY || process.env.VITE_GEMINI_API_KEY;
    if (!apiKey) {
        throw new Error("GEMINI_API_KEY or VITE_GEMINI_API_KEY not set in environment");
    }
    if (!embeddingModel) {
        const genAI = new GoogleGenerativeAI(apiKey);
        // Use text-embedding-004 model (or similar)
        embeddingModel = genAI.getGenerativeModel({ model: "text-embedding-004" });
    }
    return embeddingModel;
}

// ---------------------------------------------------------------------------
// 🌟 NEW RAG HELPER: Robust Text Chunking
// ---------------------------------------------------------------------------
function simpleTextChunker(content, chunkSize = 500) {
    // 1. Split by newlines first to preserve paragraph structure
    const lines = content.split('\n');
    const chunks = [];
    let currentChunk = '';

    for (const line of lines) {
        const trimmedLine = line.trim();
        if (!trimmedLine) continue;

        // If a single line is too long, force split it
        if (trimmedLine.length > chunkSize) {
            // Push current buffer if any
            if (currentChunk.length > 0) {
                chunks.push(currentChunk.trim());
                currentChunk = '';
            }

            // Split the long line into chunks
            let remaining = trimmedLine;
            while (remaining.length > 0) {
                chunks.push(remaining.substring(0, chunkSize));
                remaining = remaining.substring(chunkSize);
            }
        }
        // If adding this line exceeds chunk size, push current and start new
        else if ((currentChunk.length + trimmedLine.length + 1) > chunkSize) {
            if (currentChunk.length > 0) {
                chunks.push(currentChunk.trim());
            }
            currentChunk = trimmedLine;
        }
        // Otherwise append to current
        else {
            currentChunk += (currentChunk.length > 0 ? ' ' : '') + trimmedLine;
        }
    }

    if (currentChunk.length > 0) {
        chunks.push(currentChunk.trim());
    }

    return chunks;
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
    // PHASE 4.2: PROJECT MEMORY (Project-Specific)
    // ---------------------------------------------------------------------------
    const PROJECT_MEMORY_FILE = "project_knowledge.json";

    ipcMain.handle("memory:save", async (event, knowledge) => {
        const root = ensureRoot();
        const memoryPath = path.join(root, ".aesop", PROJECT_MEMORY_FILE);

        try {
            const dir = path.dirname(memoryPath);
            await fs.mkdir(dir, { recursive: true });

            await fs.writeFile(memoryPath, JSON.stringify(knowledge, null, 2), "utf8");
            return { ok: true };
        } catch (err) {
            console.error("[AesopIDE memory:save error]", err);
            return { ok: false, error: err.message || String(err) };
        }
    });

    ipcMain.handle("memory:load", async () => {
        const root = ensureRoot();
        const memoryPath = path.join(root, ".aesop", PROJECT_MEMORY_FILE);

        if (!fsSync.existsSync(memoryPath)) {
            return { ok: true, knowledge: {} }; // Return empty object if file doesn't exist
        }

        try {
            const content = await fs.readFile(memoryPath, "utf8");
            const knowledge = JSON.parse(content);
            return { ok: true, knowledge };
        } catch (err) {
            console.error("[AesopIDE memory:load error]", err);
            return { ok: false, error: err.message || String(err) };
        }
    });

    // ---------------------------------------------------------------------------
    // GLOBAL MEMORY (Cross-Project via Supabase)
    // ---------------------------------------------------------------------------
    const GLOBAL_MEMORY_TABLE = "aesopide_global_memory";

    ipcMain.handle("globalMemory:save", async (event, knowledge) => {
        try {
            const supabase = getSupabaseClient();

            // Use a fixed key (e.g., 'developer_insights') to store global memory for the user
            const fixedKey = 'global_developer_insights';

            // 検 CRITICAL FIX: Use simplified table name
            const { error } = await supabase
                .from(GLOBAL_MEMORY_TABLE)
                .upsert({ key: fixedKey, data: knowledge }, { onConflict: 'key' });

            if (error) throw error;

            return { ok: true, message: `Global developer insights saved to ${GLOBAL_MEMORY_TABLE}.` };
        } catch (err) {
            console.error("[AesopIDE globalMemory:save error]", err);
            return { ok: false, error: err.message || String(err) };
        }
    });

    ipcMain.handle("globalMemory:load", async () => {
        try {
            const supabase = getSupabaseClient();
            const fixedKey = 'global_developer_insights';

            // 検 CRITICAL FIX: Use simplified table name
            const { data, error } = await supabase
                .from(GLOBAL_MEMORY_TABLE)
                .select('data')
                .eq('key', fixedKey)
                .single();

            // If no row is found (error code PGRST116), return empty knowledge.
            if (error && error.code === 'PGRST116') {
                return { ok: true, knowledge: {} };
            }
            if (error) {
                throw error;
            }

            // Return the 'data' column content (which is the knowledge JSON)
            return { ok: true, knowledge: data ? data.data : {} };
        } catch (err) {
            console.error("[AesopIDE globalMemory:load error]", err);
            return { ok: false, error: err.message || String(err) };
        }
    });

    // ---------------------------------------------------------------------------
    // NEW: Fetch URL Content (Bypasses CORS)
    // ---------------------------------------------------------------------------
    ipcMain.handle("ingestion:fetchUrl", async (event, { url }) => {
        try {
            // Using the native Node.js/Electron fetch here
            const response = await fetch(url);
            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }
            const contentType = response.headers.get('content-type');
            const content = await response.text();

            return { ok: true, content, contentType };
        } catch (err) {
            console.error("[AesopIDE ingestion:fetchUrl error]", err);
            return { ok: false, error: err.message || String(err) };
        }
    });
    // ---------------------------------------------------------------------------
    // 検 PHASE 6: DOCUMENT INGESTION SERVICE (RAG BACKEND)
    // ---------------------------------------------------------------------------
    const DEVELOPER_LIBRARY_TABLE = "aesopide_developer_library";

    ipcMain.handle("ingestion:document", async (event, { content, source }) => {
        if (!content || typeof content !== 'string') {
            return { ok: false, error: "Ingestion requires 'content' (document text)." };
        }

        const sourceUrl = source || 'local_document';

        try {
            const chunks = simpleTextChunker(content, 300);  // Smaller chunks
            const supabase = getSupabaseClient();
            const embedder = getEmbeddingModel();
            const embeddingsToInsert = [];

            let successfulChunks = 0;

            for (const chunk of chunks) {
                // 1. Generate Vector Embedding
                // Note: The GenAI SDK for embeddings returns a response object
                const embeddingResponse = await embedder.embedContent(chunk);
                // The actual vector array is nested within the response
                const embedding = embeddingResponse.embedding.values;

                if (!embedding || embedding.length !== 768) {
                    console.warn(`Skipping chunk due to invalid embedding size: ${embedding?.length}`);
                    continue;
                }

                embeddingsToInsert.push({
                    content: chunk,
                    source: sourceUrl,
                    embedding: embedding,
                });
            }

            // 2. Store Vectors in Supabase (Use simple lowercase name)
            if (embeddingsToInsert.length > 0) {
                const { error } = await supabase
                    .from(DEVELOPER_LIBRARY_TABLE)
                    .insert(embeddingsToInsert);

                if (error) throw error;
                successfulChunks = embeddingsToInsert.length;
            }

            // Return a status indicating readiness for the next stage (Tool Framework/Frontend)
            return {
                ok: true,
                message: `Successfully processed and stored ${successfulChunks} document chunks from source: ${sourceUrl}.`
            };
        } catch (err) {
            console.error("[AesopIDE ingestion:document error]", err);
            return { ok: false, error: err.message || String(err) };
        }
    });

    // ---------------------------------------------------------------------------
    // 検 PHASE 6.2: DEVELOPER LIBRARY QUERY (RAG RETRIEVAL)
    // ---------------------------------------------------------------------------
    ipcMain.handle("developerLibrary:query", async (event, { question }) => {
        if (!question || typeof question !== 'string') {
            return { ok: false, error: "Query requires a 'question' string." };
        }

        try {
            // 1. Generate embedding for the user's question
            const embedder = getEmbeddingModel();
            const embeddingResponse = await embedder.embedContent(question);
            const queryVector = embeddingResponse.embedding.values;

            if (!queryVector || queryVector.length !== 768) {
                throw new Error(`Invalid embedding vector size: ${queryVector?.length}`);
            }

            // 2. Query Supabase for similar documents using vector similarity
            const supabase = getSupabaseClient();
            // Call the custom PostgreSQL RPC function (needs to be created in the DB)
            const { data, error } = await supabase.rpc('match_developer_library', {
                query_embedding: queryVector,
                match_threshold: 0.5,
                match_count: 5
            });

            if (error) throw error;

            return {
                ok: true,
                results: data || [],
                message: `Found ${(data || []).length} relevant knowledge chunks.`
            };
        } catch (err) {
            console.error("[developerLibrary:query error]", err);
            return { ok: false, error: err.message || String(err) };
        }
    });
    // End of new handler insertion


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
            let history = [];
            let knowledgeContext = ""; // Project knowledge
            let globalKnowledgeContext = ""; // Global knowledge
            let enableSearch = false; // Phase 16: Google Search Grounding

            if (typeof payloadOrText === "string" || payloadOrText instanceof String) {
                userPrompt = payloadOrText;
                if (maybeOptions && typeof maybeOptions === "object") {
                    systemPrompt = maybeOptions.systemPrompt || "";
                    fileContext = maybeOptions.fileContext || null;
                    cursor = maybeOptions.cursor || null;
                    history = maybeOptions.history || [];
                    knowledgeContext = maybeOptions.knowledgeContext || "";
                    globalKnowledgeContext = maybeOptions.globalKnowledgeContext || "";
                    enableSearch = maybeOptions.enableSearch || false;
                }
            } else if (payloadOrText && typeof payloadOrText === "object") {
                userPrompt = payloadOrText.prompt || "";
                systemPrompt = payloadOrText.systemPrompt || "";
                fileContext = payloadOrText.fileContext || null;
                cursor = payloadOrText.cursor || null;
                history = payloadOrText.history || [];
                knowledgeContext = payloadOrText.knowledgeContext || "";
                globalKnowledgeContext = payloadOrText.globalKnowledgeContext || "";
                enableSearch = payloadOrText.enableSearch || false;
            }

            const parts = [];
            if (systemPrompt) {
                parts.push({ text: systemPrompt + "\n\n" });
            }
            // Prioritize Global Insights first, then Project Knowledge
            if (globalKnowledgeContext) {
                parts.push({ text: `## GLOBAL INSIGHTS (Cross-Project Developer Knowledge)\n${globalKnowledgeContext}\n\n` });
            }
            if (knowledgeContext) {
                parts.push({ text: `## PROJECT KNOWLEDGE (Current Project Architecture)\n${knowledgeContext}\n\n` });
            }
            if (fileContext) {
                parts.push({ text: "Project context:\n" + fileContext + "\n\n" });
            }
            if (cursor) {
                parts.push({ text: "Cursor context:\n" + cursor + "\n\n" });
            }
            parts.push({ text: userPrompt });

            const contents = [];
            if (history && history.length > 0) {
                for (const msg of history) {
                    if (msg.role === 'user' || msg.role === 'assistant') {
                        contents.push({
                            role: msg.role === 'assistant' ? 'model' : 'user',
                            parts: [{ text: msg.content }]
                        });
                    }
                }
            }

            contents.push({
                role: "user",
                parts,
            });

            // Phase 16: Configure tools with Google Search Grounding if enabled
            const tools = [];
            if (enableSearch) {
                console.log('[Phase 16] Search enabled, configuring Google Search');
                tools.push({
                    googleSearch: {} // New API - simple declaration
                });
            } else {
                console.log('[Phase 16] Search disabled, no grounding');
            }

            const requestConfig = { contents };
            if (tools.length > 0) {
                requestConfig.tools = tools;
            }

            const result = await model.generateContent(requestConfig);
            const response = result.response;
            const outText = typeof response.text === "function" ? response.text() : "";

            // Phase 16: Extract and auto-ingest grounded content
            let groundingMetadata = null;
            if (enableSearch && result.response.candidates && result.response.candidates[0]) {
                const candidate = result.response.candidates[0];
                groundingMetadata = candidate.groundingMetadata || candidate;
                console.log("[Phase 16] Grounding metadata received:", {
                    hasWebSearchQueries: !!groundingMetadata?.webSearchQueries,
                    queries: groundingMetadata?.webSearchQueries
                });

                // Auto-ingest grounded content into RAG
                if (groundingMetadata.webSearchQueries && groundingMetadata.webSearchQueries.length > 0) {
                    const supabase = getSupabaseClient();
                    const embedder = getEmbeddingModel();

                    for (const query of groundingMetadata.webSearchQueries) {
                        try {
                            // Prepare content summary from grounding
                            const groundedContent = `Search Query: ${query}\n\nGrounded Response:\n${outText.substring(0, 1000)}`;

                            // Generate embedding
                            const embeddingResponse = await embedder.embedContent(groundedContent);
                            const embedding = embeddingResponse.embedding.values;

                            if (embedding && embedding.length === 768) {
                                // Store in developer library
                                await supabase.from(DEVELOPER_LIBRARY_TABLE).insert({
                                    embedding: embedding
                                });
                                console.log(`[Phase 16] Auto-ingested grounding for query: ${query}`);
                            }
                        } catch (ingestErr) {
                            console.warn("[Phase 16] Failed to ingest grounding:", ingestErr);
                        }
                    }
                }
            }

            return {
                ok: true,
                text: outText,
                groundingMetadata: groundingMetadata
            };
        } catch (err) {
            console.error("[AesopIDE prompt:send error]", err);
            return { ok: false, text: err.message || String(err) };
        }
    });

    ipcMain.handle("fs:deleteFile", async (event, targetPath) => {
        try {
            if (!targetPath) {
                return { ok: false, error: "No target path specified" };
            }
            const stats = await fs.stat(targetPath);
            if (stats.isDirectory()) {
                await fs.rm(targetPath, { recursive: true, force: true });
            } else {
                await fs.unlink(targetPath);
            }
            return { ok: true };
        } catch (err) {
            console.error("[AesopIDE fs:deleteFile error]", err);
            return { ok: false, error: err.message || String(err) };
        }
    });

    ipcMain.handle("fs:revealInExplorer", async (event, targetPath) => {
        try {
            if (!targetPath) return { ok: false, error: "No path" };
            const root = ensureRoot();
            const fullPath = path.isAbsolute(targetPath)
                ? targetPath
                : path.join(root, targetPath);

            shell.showItemInFolder(fullPath);
            return { ok: true };
        } catch (err) {
            console.error("[AesopIDE fs:revealInExplorer error]", err);
            return { ok: false, error: err.message };
        }
    });

    ipcMain.handle("fs:openTerminal", async (event, targetPath) => {
        try {
            if (!targetPath) return { ok: false, error: "No path" };
            const root = ensureRoot();
            const fullPath = path.isAbsolute(targetPath)
                ? targetPath
                : path.join(root, targetPath);

            let dir = fullPath;
            try {
                const stats = await fs.stat(fullPath);
                if (!stats.isDirectory()) {
                    dir = path.dirname(fullPath);
                }
            } catch (e) {
                dir = path.dirname(fullPath);
            }

            if (process.platform === 'win32') {
                spawn('start', ['cmd', '/k', `cd /d "${dir}"`], { shell: true });
            } else if (process.platform === 'darwin') {
                spawn('open', ['-a', 'Terminal', dir]);
            } else {
                spawn('x-terminal-emulator', [], { cwd: dir });
            }
            return { ok: true };
        } catch (err) {
            console.error("[AesopIDE fs:openTerminal error]", err);
            return { ok: false, error: err.message };
        }
    });

    function getGit() {
        const baseDir = ensureRoot();
        return simpleGit({ baseDir });
    }

    ipcMain.handle("git:diff", async () => {
        try {
            const git = getGit();
            const diff = await git.diff();
            return { ok: true, diff };
        } catch (err) {
            console.error("[AesopIDE git:diff error]", err);
            return { ok: false, error: err.message || String(err) };
        }
    });

    // PHASE 5.1: New Git Command
    ipcMain.handle("git:applyPatch", async (event, patchContent) => {
        const root = ensureRoot();
        const tempPatchPath = path.join(root, '.aesop', `patch-${nanoid()}.patch`);

        try {
            // Write the patch content to the temp file
            await fs.writeFile(tempPatchPath, patchContent, 'utf8');

            // Apply the patch using simple-git
            const git = getGit();
            // Note: `apply` is a safer version of `patch`
            const result = await git.applyPatch(tempPatchPath);

            // Clean up the temporary file
            await fs.unlink(tempPatchPath);

            return { ok: true, output: result.summary || 'Patch applied successfully.' };

        } catch (err) {
            try {
                // Attempt to clean up the file even if applying failed
                await fs.unlink(tempPatchPath).catch(() => { });
            } catch { }

            console.error("[AesopIDE git:applyPatch error]", err);
            // Check for specific Git conflict message
            if (err.message && err.message.includes('conflicts')) {
                return { ok: false, error: 'Patch application failed: CONFLICTS detected. User must manually resolve.' };
            }
            return { ok: false, error: err.message || String(err) };
        }
    });


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
            return { ok: false, output: JSON.stringify(err) };
        }
    });

    ipcMain.handle("git:pull", async () => {
        try {
            const git = getGit();
            const result = await git.pull();
            return { ok: true, output: JSON.stringify(result) || result.summary.summary };
        } catch (err) {
            console.error("[AesopIDE git:pull error]", err);
            return { ok: false, output: JSON.stringify(err) || String(err) };
        }
    });

    // ---------------------------------------------------------------------------
    // PHASE 3.4: COMMAND EXECUTION
    // ---------------------------------------------------------------------------

    ipcMain.handle("cmd:run", async (event, command) => {
        const root = ensureRoot();
        const commandId = nanoid();

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