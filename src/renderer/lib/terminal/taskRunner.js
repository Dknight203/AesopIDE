// src/renderer/lib/terminal/taskRunner.js
// VSCode-style task runner for structured command execution with error parsing

export class TaskRunner {
    constructor() {
        this.tasks = new Map();
    }

    /**
     * Register a task with command, working directory, and error pattern matcher
     * @param {string} name - Task name (e.g., "npm:dev")
     * @param {Object} config - Task configuration
     * @param {string} config.command - Command to execute
     * @param {string} config.cwd - Working directory
     * @param {RegExp|null} config.problemMatcher - Regex pattern for parsing errors
     */
    registerTask(name, config) {
        this.tasks.set(name, {
            command: config.command,
            cwd: config.cwd,
            problemMatcher: config.problemMatcher || null
        });
        console.log(`[TaskRunner] Registered task: ${name}`);
    }

    /**
     * Auto-discover npm scripts from package.json and register them as tasks
     * @param {string} projectPath - Path to project root containing package.json
     */
    async discoverScripts(projectPath) {
        try {
            const pkgPath = `${projectPath}/package.json`;
            const content = await window.aesop.fs.readFile(pkgPath);
            const pkg = JSON.parse(content);

            if (pkg.scripts) {
                console.log(`[TaskRunner] Discovering scripts from ${pkgPath}`);
                for (const [name, script] of Object.entries(pkg.scripts)) {
                    this.registerTask(`npm:${name}`, {
                        command: `npm run ${name}`,
                        cwd: projectPath,
                        problemMatcher: this.detectProblemMatcher(script)
                    });
                }
                console.log(`[TaskRunner] Discovered ${Object.keys(pkg.scripts).length} npm scripts`);
            } else {
                console.log(`[TaskRunner] No scripts found in ${pkgPath}`);
            }
        } catch (error) {
            console.error(`[TaskRunner] Failed to discover scripts:`, error);
        }
    }

    /**
     * Detect appropriate error pattern matcher based on script content
     * @param {string} script - Script command string
     * @returns {RegExp|null} Problem matcher regex or null
     */
    detectProblemMatcher(script) {
        // TypeScript compiler errors: "error TS2345: Argument of type..."
        if (script.includes('tsc')) {
            return /error TS(\d+): (.+)/g;
        }

        // ESLint errors: "path/file.js:12:5  error  'variable' is not defined"
        if (script.includes('eslint')) {
            return /(\d+):(\d+)\s+error\s+(.+)/g;
        }

        // Jest test failures: "● Test suite failed to run"
        if (script.includes('jest') || script.includes('test')) {
            return /● (.+)/g;
        }

        // Vitest errors
        if (script.includes('vitest')) {
            return /FAIL\s+(.+)/g;
        }

        // No specific matcher found
        return null;
    }

    /**
     * Execute a registered task and parse errors using its problem matcher
     * @param {string} name - Task name to execute
     * @returns {Promise<Object>} Result with stdout, stderr, exitCode, and parsedErrors
     */
    async executeTask(name) {
        const task = this.tasks.get(name);
        if (!task) {
            console.error(`[TaskRunner] Task not found: ${name}`);
            return {
                success: false,
                error: `Task "${name}" not found`,
                availableTasks: Array.from(this.tasks.keys())
            };
        }

        console.log(`[TaskRunner] Executing task: ${name}`);
        console.log(`[TaskRunner] Command: ${task.command}`);
        console.log(`[TaskRunner] Working directory: ${task.cwd}`);

        try {
            // Execute via terminal IPC
            const result = await window.aesop.terminal.exec(task.command, { cwd: task.cwd });

            // Parse errors using problem matcher if available
            const parsedErrors = [];
            if (task.problemMatcher && result.stderr) {
                console.log(`[TaskRunner] Parsing errors with problem matcher`);
                const matches = [...result.stderr.matchAll(task.problemMatcher)];

                for (const match of matches) {
                    parsedErrors.push({
                        raw: match[0],
                        groups: match.slice(1),
                        fullMatch: match
                    });
                }

                console.log(`[TaskRunner] Found ${parsedErrors.length} errors`);
            }

            return {
                success: result.exitCode === 0,
                stdout: result.stdout,
                stderr: result.stderr,
                exitCode: result.exitCode,
                parsedErrors,
                taskName: name,
                command: task.command
            };
        } catch (error) {
            console.error(`[TaskRunner] Execution failed:`, error);
            return {
                success: false,
                error: error.message,
                taskName: name,
                command: task.command
            };
        }
    }

    /**
     * Get list of all registered task names
     * @returns {string[]} Array of task names
     */
    getTaskNames() {
        return Array.from(this.tasks.keys());
    }

    /**
     * Get task configuration
     * @param {string} name - Task name
     * @returns {Object|null} Task config or null if not found
     */
    getTask(name) {
        return this.tasks.get(name) || null;
    }
}

// Create singleton instance
export const taskRunner = new TaskRunner();
