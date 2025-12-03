// src/renderer/lib/tools/framework.js

/**
 * Executes a tool called by the AI model by mapping the tool name 
 * to the appropriate IPC bridge call and structuring the arguments.
 * * This file implements the Tool Registry and Tool Executor for the renderer.
 * * @param {string} toolName - The name of the tool to execute (e.g., 'readFile').
 * @param {Object} params - The parameters provided by the AI tool call.
 * @returns {Promise<any>} The result of the tool execution.
 */
export async function executeTool(toolName, params) {
    if (!window.aesop || !window.aesop.fs || !window.aesop.tools) {
        throw new Error("Aesop IPC bridge not fully available for tools. Check preload/index.js.");
    }

    // This switch statement maps AI-facing tool names to low-level IPC bridge calls.
    switch (toolName) {
        // -----------------------------------------------------------
        // 2.2 Core Tools: File Operations
        // -----------------------------------------------------------
        case 'readFile':
            if (!params.path) throw new Error("readFile requires a 'path' parameter.");
            // Maps to window.aesop.fs.readFile which calls "fs:readFile" IPC
            const content = await window.aesop.fs.readFile(params.path);
            return { content, path: params.path };

        case 'writeFile':
            if (!params.path || typeof params.content === 'undefined') throw new Error("writeFile requires 'path' and 'content' parameters.");
            // Maps to window.aesop.fs.writeFile which calls "fs:writeFile" IPC
            await window.aesop.fs.writeFile(params.path, params.content);
            return { success: true, path: params.path };

        case 'listDirectory':
            const dirPath = params.path || '.';
            // Maps to window.aesop.fs.readDir which calls "fs:readDir" IPC
            const entries = await window.aesop.fs.readDir(dirPath);
            return { entries, path: dirPath };

        // -----------------------------------------------------------
        // 2.2 Core Tools: Search
        // -----------------------------------------------------------
        case 'findFiles':
            if (!params.pattern) throw new Error("findFiles requires a 'pattern' parameter.");
            // Maps to window.aesop.tools.findFiles which calls "codebase:findFiles" IPC
            const findResult = await window.aesop.tools.findFiles(params.pattern);
            // findResult is structured as { ok: true, results: [...] }
            if (!findResult.ok) throw new Error(findResult.error || "Find files failed.");
            return { results: findResult.results };

        case 'searchCode':
            if (!params.query) throw new Error("searchCode requires a 'query' parameter.");
            // Maps to window.aesop.tools.searchCode which calls "codebase:search" IPC
            const searchResult = await window.aesop.tools.searchCode(params.query, params.options || {});
            // searchResult is structured as { ok: true, results: [...] }
            if (!searchResult.ok) throw new Error(searchResult.error || "Code search failed.");
            return { results: searchResult.results };

        case 'getFileTree':
            // Maps to listDirectory at the root (reusing logic)
            const treeEntries = await window.aesop.fs.readDir('.');
            return { entries: treeEntries, path: '.' };

        // -----------------------------------------------------------
        // 3.4 Core Tools: Command Execution (Now Implemented)
        // -----------------------------------------------------------
        case 'runCommand':
            if (!params.cmd) throw new Error("runCommand requires a 'cmd' parameter with the command string.");
            
            // This runs the command and waits for it to finish on the main process
            const cmdResult = await window.aesop.tools.runCommand(params.cmd);
            
            if (!cmdResult.ok) throw new Error(cmdResult.error || `Command failed with exit code ${cmdResult.exitCode || 'N/A'}`);
            
            // Return only the essential success information for the next AI prompt
            return {
                id: cmdResult.id,
                command: params.cmd,
                exitCode: cmdResult.exitCode,
                // Truncate output for the prompt to save tokens, the AI can call getCommandOutput for full details.
                outputPreview: cmdResult.output.substring(0, 500) + (cmdResult.output.length > 500 ? '... (truncated)' : '')
            };

        case 'getCommandOutput':
            if (!params.id) throw new Error("getCommandOutput requires an 'id' parameter (from runCommand).");
            
            // Fetches the full output buffer for the command ID
            const outputResult = await window.aesop.tools.getCommandOutput(params.id);
            
            if (!outputResult.ok) throw new Error(outputResult.error || "Could not retrieve command output.");
            
            return { id: params.id, output: outputResult.output };

        default:
            throw new Error(`Unknown tool: ${toolName}`);
    }
}