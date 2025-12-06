// src/renderer/lib/tasks/manager.js

import { executeTool } from "../tools/framework";

// ---------------------------------------------------
// PHASE 3.3: MULTI-STEP EXECUTION ENGINE
// ---------------------------------------------------

/**
 * Executes a single tool call, serving as the core wrapper for verification/rollback hooks.
 * @param {string} toolName - The name of the tool to execute (e.g., 'readFile').
 * @param {Object} params - The parameters provided by the AI tool call.
 * @returns {Promise<Object>} The structured success result of the executed step.
 */
async function executeStep(toolName, params) {
    try {
        const result = await executeTool(toolName, params);

        // Return a structured success object
        return { success: true, tool: toolName, result };
    } catch (error) {
        // Phase 3.3: Implement Rollback on Errors (Placeholder)
        console.error(`Execution step failed for tool ${toolName}. Triggering rollback...`, error);

        // FIX: Throw a native Error instance with a structured message 
        // to ensure it propagates correctly through the async chain and IPC layer.
        const errorDetails = {
            success: false,
            tool: toolName,
            message: error.message || String(error)
        };
        // Throw a new Error object containing the structured details
        throw new Error(JSON.stringify(errorDetails));
    }
}

import { agentQueue } from "./queue";

/**
 * Implements the core Multi-Step Execution Engine.
 * delegates to TaskQueue for async execution and state management.
 * @param {Array<{tool: string, params: Object}>} actionChain - Array of tool calls to execute.
 * @returns {Promise<Array<Object>>} Array of successful results for each step.
 */
export async function executeChain(actionChain) {
    console.log(`[Execution Engine] Queuing ${actionChain.length} steps`);

    // Add all tasks to queue
    agentQueue.clear(); // For now, clear existing (simple mode)
    agentQueue.addAll(actionChain);

    // Start execution
    await agentQueue.start();

    // Return history as results (this waits for the queue to finish or pause)
    // Note: In async mode, this might return immediately if we don't await properly,
    // but agentQueue.start() awaits processQueue(), so it should block until done/paused.
    return agentQueue.history;
}

// Re-export queue for direct access if needed
export { agentQueue };

// ---------------------------------------------------
// PHASE 3.1 & 3.2: TASK & PLAN FILE MANAGEMENT (Your Existing Logic + Fix)
// ---------------------------------------------------

// Helper for writing a file to the .aesop directory
async function writeAesopFile(projectPath, fileName, markdown) {
    const filePath = `${projectPath}/.aesop/${fileName}`;
    try {
        await window.aesop.fs.newFolder(`${projectPath}/.aesop`);
    } catch (err) {
        // Directory might already exist, ignore
    }
    await window.aesop.fs.writeFile(filePath, markdown);
    return filePath;
}

// Helper for reading a file from the .aesop directory
async function readAesopFile(projectPath, fileName) {
    const filePath = `${projectPath}/.aesop/${fileName}`;
    try {
        const content = await window.aesop.fs.readFile(filePath);
        return content;
    } catch (err) {
        return null; // File doesn't exist
    }
}


/**
 * Create a new implementation_plan.md file. (Phase 3.2 Export FIX)
 * @param {string} projectPath - Path to project root
 * @param {string} markdown - Raw markdown content
 * @returns {Promise<string>} Path to created file
 */
export async function createPlanFile(projectPath, markdown) {
    return writeAesopFile(projectPath, 'implementation_plan.md', markdown);
}

/**
 * Read existing implementation_plan.md file. (Phase 3.2 Export FIX)
 * @param {string} projectPath - Path to project root
 * @returns {Promise<string>} Plan file content
 */
export async function readPlanFile(projectPath) {
    return readAesopFile(projectPath, 'implementation_plan.md');
}


/**
 * Create a new task.md file
 * @param {string} projectPath - Path to project root
 * @param {Object} taskData - Task structure
 * @returns {Promise<string>} Path to created file
 */
export async function createTaskFile(projectPath, taskData) {
    const { title, sections } = taskData;

    let markdown = `# ${title}\n\n`;

    for (const section of sections) {
        markdown += `## ${section.title}\n\n`;

        for (const subsection of section.subsections || []) {
            markdown += `### ${subsection.title}\n`;

            for (const task of subsection.tasks || []) {
                const indent = '  '.repeat(task.indent || 0);
                const checkbox = task.status === 'complete' ? '[x]' :
                    task.status === 'in-progress' ? '[/]' : '[ ]';
                markdown += `${indent}- ${checkbox} ${task.text}\n`;
            }

            markdown += '\n';
        }
    }
    return writeAesopFile(projectPath, 'task.md', markdown);
}

/**
 * Read existing task.md file
 * @param {string} projectPath - Path to project root
 * @returns {Promise<string>} Task file content
 */
export async function readTaskFile(projectPath) {
    return readAesopFile(projectPath, 'task.md');
}

/**
 * Parse a task.md file and return structured data
 * @param {string} content - Raw markdown content
 * @returns {Array} Array of task objects with hierarchy
 */
export function parseTaskFile(content) {
    if (!content || typeof content !== 'string') return [];

    const lines = content.split('\n');
    const tasks = [];
    let currentSection = null;
    let currentSubsection = null;

    for (const line of lines) {
        // Section header (## Phase X)
        if (line.startsWith('## ')) {
            currentSection = {
                type: 'section',
                title: line.replace('## ', '').trim(),
                tasks: [],
                subsections: []
            };
            tasks.push(currentSection);
            currentSubsection = null;
            continue;
        }

        // Subsection header (### X.X)
        if (line.startsWith('### ')) {
            if (currentSection) {
                currentSubsection = {
                    type: 'subsection',
                    title: line.replace('### ', '').trim(),
                    tasks: []
                };
                currentSection.subsections.push(currentSubsection);
            }
            continue;
        }

        // Task item (- [ ] or - [x] or - [/])
        const taskMatch = line.match(/^(\s*)- \[([ x/])\] (.+)$/);
        if (taskMatch) {
            const indent = taskMatch[1].length;
            const status = taskMatch[2];
            const text = taskMatch[3];

            const task = {
                type: 'task',
                indent,
                status: status === 'x' ? 'complete' : status === '/' ? 'in-progress' : 'pending',
                text,
                raw: line
            };

            if (currentSubsection) {
                currentSubsection.tasks.push(task);
            } else if (currentSection) {
                currentSection.tasks.push(task);
            }
        }
    }

    return tasks;
}

/**
 * Calculate task progress statistics
 * @param {Array} tasks - Parsed task structure
 * @returns {Object} Progress statistics
 */
export function getTaskProgress(tasks) {
    let total = 0;
    let completed = 0;
    let inProgress = 0;

    function countTasks(items) {
        for (const item of items) {
            if (item.type === 'task') {
                total++;
                if (item.status === 'complete') completed++;
                if (item.status === 'in-progress') inProgress++;
            } else if (item.subsections) {
                for (const sub of item.subsections) {
                    countTasks(sub.tasks);
                }
            } else if (item.tasks) {
                countTasks(item.tasks);
            }
        }
    }

    countTasks(tasks);

    return {
        total,
        completed,
        inProgress,
        pending: total - completed - inProgress,
        percentage: total > 0 ? Math.round((completed / total) * 100) : 0
    };
}

/**
 * Update task status in task.md
 * @param {string} projectPath - Path to project root
 * @param {string} taskText - Text of the task to update
 * @param {string} newStatus - New status ('pending', 'in-progress', 'complete')
 * @returns {Promise<boolean>} Success status
 */
export async function updateTaskStatus(projectPath, taskText, newStatus) {
    const content = await readTaskFile(projectPath);
    if (!content) return false;

    const statusChar = newStatus === 'complete' ? 'x' :
        newStatus === 'in-progress' ? '/' : ' ';

    // Find and replace the task line
    const lines = content.split('\n');
    let updated = false;

    for (let i = 0; i < lines.length; i++) {
        if (lines[i].includes(taskText) && lines[i].match(/- \[[ x/]\]/)) {
            lines[i] = lines[i].replace(/- \[[ x/]\]/, `- [${statusChar}]`);
            updated = true;
            break;
        }
    }

    if (updated) {
        const taskPath = `${projectPath}/.aesop/task.md`;
        await window.aesop.fs.writeFile(taskPath, lines.join('\n'));
    }

    return updated;
}

/**
 * Update multiple tasks at once
 * @param {string} projectPath - Path to project root
 * @param {Array} updates - Array of {taskText, status} objects
 * @returns {Promise<number>} Number of tasks updated
 */
export async function updateMultipleTasks(projectPath, updates) {
    const content = await readTaskFile(projectPath);
    if (!content) return 0;

    const lines = content.split('\n');
    let updateCount = 0;

    for (const update of updates) {
        const statusChar = update.status === 'complete' ? 'x' :
            update.status === 'in-progress' ? '/' : ' ';

        for (let i = 0; i < lines.length; i++) {
            if (lines[i].includes(update.taskText) && lines[i].match(/- \[[ x/]\]/)) {
                lines[i] = lines[i].replace(/- \[[ x/]\]/, `- [${statusChar}]`);
                updateCount++;
                break;
            }
        }
    }

    if (updateCount > 0) {
        const taskPath = `${projectPath}/.aesop/task.md`;
        await window.aesop.fs.writeFile(taskPath, lines.join('\n'));
    }

    return updateCount;
}

/**
 * Get current task being worked on (first in-progress task)
 * @param {Array} tasks - Parsed task structure
 * @returns {Object|null} Current task or null
 */
export function getCurrentTask(tasks) {
    function findInProgress(items) {
        for (const item of items) {
            if (item.type === 'task' && item.status === 'in-progress') {
                return item;
            } else if (item.subsections) {
                for (const sub of item.subsections) {
                    const found = findInProgress(sub.tasks);
                    if (found) return found;
                }
            } else if (item.tasks) {
                const found = findInProgress(item.tasks);
                if (found) return found;
            }
        }
        return null;
    }

    return findInProgress(tasks);
}