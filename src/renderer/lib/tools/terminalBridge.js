// src/renderer/lib/tools/terminalBridge.js
// Command execution wrapper using TaskRunner for structured error parsing

import { taskRunner } from '../terminal/taskRunner.js';

/**
 * Execute a command with structured error parsing
 * @param {string} command - Command to execute
 * @param {string} cwd - Working directory
 * @param {Object} options - Additional options
 * @returns {Promise<Object>} Result with parsed errors
 */
export async function executeCommandWithParsing(command, cwd, options = {}) {
    console.log(`[TerminalBridge] Executing command: ${command}`);
    console.log(`[TerminalBridge] Working directory: ${cwd}`);

    // Check if this is a registered task
    const taskName = options.taskName || `cmd:${command}`;

    // Check for registered npm task first
    const npmMatch = command.match(/^npm run (\w+)/);
    if (npmMatch) {
        const scriptName = npmMatch[1];
        const npmTaskName = `npm:${scriptName}`;

        // Check if task is already registered
        if (taskRunner.getTask(npmTaskName)) {
            console.log(`[TerminalBridge] Using registered task: ${npmTaskName}`);
            return await taskRunner.executeTask(npmTaskName);
        } else {
            // Try to discover scripts first
            console.log(`[TerminalBridge] Discovering npm scripts for ${cwd}`);
            await taskRunner.discoverScripts(cwd);

            if (taskRunner.getTask(npmTaskName)) {
                return await taskRunner.executeTask(npmTaskName);
            }
        }
    }

    // Register as one-time task if not an npm script
    if (!taskRunner.getTask(taskName)) {
        const problemMatcher = detectProblemMatcherFromCommand(command);
        taskRunner.registerTask(taskName, {
            command,
            cwd,
            problemMatcher
        });
    }

    // Execute the task
    const result = await taskRunner.executeTask(taskName);

    return result;
}

/**
 * Detect problem matcher from command string
 * @param {string} command - Command string
 * @returns {RegExp|null} Problem matcher or null
 */
function detectProblemMatcherFromCommand(command) {
    if (command.includes('tsc')) return /error TS(\d+): (.+)/g;
    if (command.includes('eslint')) return /(\d+):(\d+)\s+error\s+(.+)/g;
    if (command.includes('jest')) return /● (.+)/g;
    if (command.includes('vitest')) return /FAIL\s+(.+)/g;
    if (command.includes('npm test')) return /● (.+)/g;
    return null;
}

/**
 * Format parsed errors for AI consumption
 * @param {Array} parsedErrors - Array of parsed error objects
 * @returns {string} Formatted error message for AI
 */
export function formatErrorsForAI(parsedErrors) {
    if (!parsedErrors || parsedErrors.length === 0) {
        return "No specific errors detected in output.";
    }

    const lines = [
        `Found ${parsedErrors.length} error(s):`,
        ""
    ];

    for (let i = 0; i < parsedErrors.length; i++) {
        const error = parsedErrors[i];
        lines.push(`Error ${i + 1}:`);
        lines.push(`  Raw: ${error.raw}`);

        if (error.groups && error.groups.length > 0) {
            lines.push(`  Details: ${error.groups.join(' | ')}`);
        }

        lines.push("");
    }

    return lines.join('\n');
}

/**
 * Validate command for safety (prevent dangerous operations)
 * @param {string} command - Command to validate
 * @returns {Object} Validation result with ok flag and optional error message
 */
export function validateCommand(command) {
    const dangerous = [
        /rm\s+-rf\s+\//,           // rm -rf /
        /del\s+\/[sq]/i,            // del /s or /q
        /format\s+[a-z]:/i,         // format C:
        /:\(\)\{.*\};\:/,           // fork bomb
        />.*\/dev\/(null|zero)/,    // redirect to /dev/null or /dev/zero improperly
    ];

    for (const pattern of dangerous) {
        if (pattern.test(command)) {
            return {
                ok: false,
                error: `Command blocked for safety: potentially dangerous operation detected`
            };
        }
    }

    return { ok: true };
}

/**
 * Execute command with retry logic and exponential backoff
 * @param {string} command - Command to execute
 * @param {string} cwd - Working directory
 * @param {number} maxRetries - Maximum retry attempts (default: 3)
 * @returns {Promise<Object>} Result after retries
 */
export async function executeWithRetry(command, cwd, maxRetries = 3) {
    // Validate command first
    const validation = validateCommand(command);
    if (!validation.ok) {
        return {
            success: false,
            error: validation.error
        };
    }

    let lastError = null;
    let attempt = 0;

    while (attempt < maxRetries) {
        attempt++;
        console.log(`[TerminalBridge] Attempt ${attempt}/${maxRetries}`);

        try {
            const result = await executeCommandWithParsing(command, cwd);

            if (result.success) {
                console.log(`[TerminalBridge] Command succeeded on attempt ${attempt}`);
                return result;
            }

            lastError = result;

            // Don't retry if this is the last attempt
            if (attempt < maxRetries) {
                const delay = Math.pow(2, attempt) * 1000; // Exponential backoff
                console.log(`[TerminalBridge] Waiting ${delay}ms before retry...`);
                await new Promise(resolve => setTimeout(resolve, delay));
            }
        } catch (error) {
            lastError = {
                success: false,
                error: error.message
            };

            if (attempt < maxRetries) {
                const delay = Math.pow(2, attempt) * 1000;
                await new Promise(resolve => setTimeout(resolve, delay));
            }
        }
    }

    console.error(`[TerminalBridge] Command failed after ${maxRetries} attempts`);
    return lastError;
}
