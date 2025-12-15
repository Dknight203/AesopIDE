// src/renderer/lib/tools/framework.js
import { terminalEvents } from "../events/terminalEvents";
import { executeCommandWithParsing, validateCommand, executeWithRetry } from "./terminalBridge.js";

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
            const content = await window.aesop.fs.readFile(params.path);
            return { content, path: params.path };

        case 'writeFile':
            if (!params.path || typeof params.content === 'undefined') throw new Error("writeFile requires 'path' and 'content' parameters.");
            await window.aesop.fs.writeFile(params.path, params.content);
            return { success: true, path: params.path };

        case 'listDirectory':
            const dirPath = params.path || '.';
            const entries = await window.aesop.fs.readDir(dirPath);
            return { entries, path: dirPath };

        // -----------------------------------------------------------
        // 2.2 Core Tools: Search
        // -----------------------------------------------------------
        case 'findFiles':
            if (!params.pattern) throw new Error("findFiles requires a 'pattern' parameter.");
            const findResult = await window.aesop.tools.findFiles(params.pattern);
            if (!findResult.ok) throw new Error(findResult.error || "Find files failed.");
            return { results: findResult.results };

        case 'searchCode':
            if (!params.query) throw new Error("searchCode requires a 'query' parameter.");
            const searchResult = await window.aesop.tools.searchCode(params.query, params.options || {});
            if (!searchResult.ok) throw new Error(searchResult.error || "Code search failed.");
            return { results: searchResult.results };

        case 'getFileTree':
            // Notify UI that a command is starting
            terminalEvents.emit('command-start', { command: params.cmd });

            try {
                const cmdResult = await window.aesop.tools.runCommand(params.cmd);

                if (!cmdResult.ok) {
                    const errorMsg = cmdResult.error || `Command failed with exit code ${cmdResult.exitCode || 'N/A'}`;
                    terminalEvents.emit('command-error', { error: errorMsg });
                    throw new Error(errorMsg);
                }

                // Notify UI of output
                terminalEvents.emit('command-output', { output: cmdResult.output });
                terminalEvents.emit('command-end', { exitCode: cmdResult.exitCode });

                return {
                    id: cmdResult.id,
                    command: params.cmd,
                    exitCode: cmdResult.exitCode,
                    outputPreview: cmdResult.output.substring(0, 500) + (cmdResult.output.length > 500 ? '... (truncated)' : '')
                };
            } catch (err) {
                terminalEvents.emit('command-error', { error: err.message });
                throw err;
            }

        case 'getCommandOutput':
            if (!params.id) throw new Error("getCommandOutput requires an 'id' parameter (from runCommand).");

            const outputResult = await window.aesop.tools.getCommandOutput(params.id);

            if (!outputResult.ok) throw new Error(outputResult.error || "Could not retrieve command output.");

            return { id: params.id, output: outputResult.output };

        // -----------------------------------------------------------
        // PHASE 4.2: PROJECT MEMORY TOOLS (Local & Global)
        // -----------------------------------------------------------

        // --- Project-Specific Memory (Local) ---
        case 'saveKnowledge':
            if (!params.knowledge || typeof params.knowledge !== 'object') {
                throw new Error("saveKnowledge requires a 'knowledge' object.");
            }
            await window.aesop.memory.save(params.knowledge);
            return { success: true };

        case 'loadKnowledge':
            const memoryResult = await window.aesop.memory.load();
            if (!memoryResult.ok) throw new Error(memoryResult.error || "Failed to load project memory.");
            return { knowledge: memoryResult.knowledge };

        // --- Global Cross-Project Memory (Supabase) ---
        case 'saveGlobalInsight':
            if (!params.insight || typeof params.insight !== 'object') {
                throw new Error("saveGlobalInsight requires an 'insight' object.");
            }
            const saveGlobalResult = await window.aesop.globalMemory.save(params.insight);
            if (!saveGlobalResult.ok) throw new Error(saveGlobalResult.error || "Failed to save global insight.");
            return { success: true };

        case 'loadGlobalInsights':
            const loadGlobalResult = await window.aesop.globalMemory.load();
            if (!loadGlobalResult.ok) throw new Error(loadGlobalResult.error || "Failed to load global insights.");
            return { insights: loadGlobalResult.knowledge };

        // -----------------------------------------------------------
        // 🌟 PHASE 6.1: INGESTION TOOL (Developer Library RAG)
        // -----------------------------------------------------------
        case 'ingestDocument':
            if (!params.content || typeof params.content !== 'string') {
                throw new Error("ingestDocument requires 'content' (the document text).");
            }

            const ingestResult = await window.aesop.ingestion.document(params.content, params.source || 'AI_Command');

            if (!ingestResult.ok) {
                throw new Error(ingestResult.error || "Document ingestion failed in the backend service.");
            }

            return { success: true, message: ingestResult.message || `Document ingested from ${params.source || 'AI_Command'}. Ready for vector processing.` };

        // -----------------------------------------------------------
        // 🌟 PHASE 6.2: QUERY TOOL (Developer Library RAG Retrieval)
        // -----------------------------------------------------------
        case 'queryDeveloperLibrary':
            if (!params.question || typeof params.question !== 'string') {
                throw new Error("queryDeveloperLibrary requires a 'question' string.");
            }
            const queryLibResult = await window.aesop.ingestion.query(params.question);
            if (!queryLibResult.ok) {
                throw new Error(queryLibResult.error || "Developer library query failed.");
            }
            return {
                results: queryLibResult.results,
                count: queryLibResult.results.length,
                message: queryLibResult.message
            };

        // -----------------------------------------------------------
        // PHASE 5.1: DIFF/PATCH TOOLS
        // -----------------------------------------------------------
        case 'generateDiff':
            const diffResult = await window.aesop.git.diff();
            if (!diffResult.ok) throw new Error(diffResult.error || "Failed to generate diff.");
            return { diff: diffResult.diff, status: "Uncommitted changes ready for review." };

        case 'applyPatch':
            if (!params.patchContent || typeof params.patchContent !== 'string') {
                throw new Error("applyPatch requires 'patchContent' (a string in standard Git diff format).");
            }
            const patchResult = await window.aesop.git.applyPatch(params.patchContent);
            if (!patchResult.ok) {
                throw new Error(patchResult.error || "Patch application failed.");
            }
            return { success: true, message: patchResult.output };

        // -----------------------------------------------------------
        // PHASE 5.2: TESTING INTEGRATION
        // -----------------------------------------------------------
        case 'runTests':
            const testCommand = params.script || 'npm test';

            const testCmdResult = await window.aesop.tools.runCommand(testCommand);

            if (!testCmdResult.ok) {
                throw new Error(testCmdResult.error || `Test command failed to execute: ${testCommand}`);
            }

            return {
                command: testCommand,
                exitCode: testCmdResult.exitCode,
                fullOutput: testCmdResult.output,
                summary: `Tests finished with exit code ${testCmdResult.exitCode}.`
            };

        // -----------------------------------------------------------
        // PHASE 5.3: LINTING INTEGRATION (NEW)
        // -----------------------------------------------------------
        case 'runLinter':
            // Linter command can include --fix for auto-fixing
            const linterCommand = params.cmd || 'npm run lint -- --format json';

            const linterCmdResult = await window.aesop.tools.runCommand(linterCommand);

            // A linter command failing (exitCode > 0) usually just means errors were found, not that the command crashed.
            if (!linterCmdResult.ok) {
                // If the command failed to execute (not just exit with errors), throw.
                if (linterCmdResult.error && !linterCmdResult.error.includes('exit code')) {
                    throw new Error(linterCmdResult.error || `Linter command failed to execute: ${linterCommand}`);
                }
            }

            return {
                command: linterCommand,
                exitCode: testCmdResult.exitCode,
                // Return full output (which might be JSON or plain text depending on flags)
                fullOutput: linterCmdResult.output,
                summary: `Linter completed with exit code ${testCmdResult.exitCode}. Check output for details.`
            };

        // -----------------------------------------------------------
        // PHASE 8: TERMINAL COMMAND TOOLS WITH ERROR PARSING
        // -----------------------------------------------------------
        case 'executeTerminalCommand':
        case 'runCommand':
            if (!params.cmd && !params.command) {
                throw new Error("executeTerminalCommand requires 'cmd' or 'command' parameter.");
            }

            const command = params.cmd || params.command;
            const cwd = params.cwd || params.workingDirectory || '.';

            // Validate command for safety
            const validation = validateCommand(command);
            if (!validation.ok) {
                throw new Error(validation.error);
            }

            // Use retry logic if requested
            const useRetry = params.retry !== false; // Default to true
            const maxRetries = params.maxRetries || 3;

            let terminalResult;
            if (useRetry) {
                console.log(`[Framework] Executing command with retry (max: ${maxRetries})`);
                terminalResult = await executeWithRetry(command, cwd, maxRetries);
            } else {
                console.log(`[Framework] Executing command without retry`);
                terminalResult = await executeCommandWithParsing(command, cwd);
            }

            // Emit terminal events for UI updates
            terminalEvents.emit('command-start', { command });

            if (terminalResult.success) {
                terminalEvents.emit('command-output', { output: terminalResult.stdout });
                terminalEvents.emit('command-end', { exitCode: terminalResult.exitCode });
            } else {
                terminalEvents.emit('command-error', {
                    error: terminalResult.error || terminalResult.stderr
                });
            }

            // Return structured result with parsed errors
            return {
                success: terminalResult.success,
                command: terminalResult.command || command,
                exitCode: terminalResult.exitCode,
                stdout: terminalResult.stdout,
                stderr: terminalResult.stderr,
                parsedErrors: terminalResult.parsedErrors || [],
                errorCount: terminalResult.parsedErrors?.length || 0,
                // Flag for self-correction if there are errors
                needsSelfCorrection: terminalResult.parsedErrors && terminalResult.parsedErrors.length > 0
            };

        default:
            throw new Error(`Unknown tool: ${toolName}`);
    }
}