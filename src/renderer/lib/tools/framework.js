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

// Task Management Tools
registerTool({
  name: 'createTask',
  description: 'Create a new task.md file with structured tasks',
  params: {
    taskData: { type: 'object', required: true }
  },
  fn: async ({ taskData }) => {
    if (!window.aesop || !window.aesop.task) throw new Error('Task API not available');
    return await window.aesop.task.create(taskData);
  }
});

registerTool({
  name: 'readTask',
  description: 'Read the current task.md file',
  params: {},
  fn: async () => {
    if (!window.aesop || !window.aesop.task) throw new Error('Task API not available');
    return await window.aesop.task.read();
  }
});

registerTool({
  name: 'updateTask',
  description: 'Update a task status (pending/in-progress/complete)',
  params: {
    taskText: { type: 'string', required: true },
    status: { type: 'string', required: true }
  },
  fn: async ({ taskText, status }) => {
    if (!window.aesop || !window.aesop.task) throw new Error('Task API not available');
    return await window.aesop.task.update(taskText, status);
  }
});

// Planning Tools
import { createPlan, readPlan, approvePlan, rejectPlan, hasPendingPlan } from '../planning/planner.js';

registerTool({
  name: 'createPlan',
  description: 'Create an implementation plan for user review',
  params: {
    planData: { type: 'object', required: true }
  },
  fn: async ({ planData }) => {
    const projectPath = '.'; // Current project
    return await createPlan(projectPath, planData);
  }
});

registerTool({
  name: 'readPlan',
  description: 'Read the current implementation plan',
  params: {},
  fn: async () => {
    const projectPath = '.';
    return await readPlan(projectPath);
  }
});

registerTool({
  name: 'checkPendingPlan',
  description: 'Check if there is a pending plan awaiting approval',
  params: {},
  fn: async () => {
    const projectPath = '.';
    return { hasPending: await hasPendingPlan(projectPath) };
  }
});

export default { registerTool, getTool, listTools, executeTool };
