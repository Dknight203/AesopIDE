// preload/ipcSchema.js
// Phase 7.5: IPC Channel Validation Schema
// Single source of truth for all IPC channel names to prevent typos and enable validation

/**
 * IPC Channel definitions organized by domain.
 * All renderer-to-main IPC calls should use these constants.
 */
export const IPC_CHANNELS = {
    // Filesystem operations
    FS_READ_FILE: 'fs:readFile',
    FS_WRITE_FILE: 'fs:writeFile',
    FS_READ_DIR: 'fs:readDir',
    FS_NEW_FILE: 'fs:newFile',
    FS_NEW_FOLDER: 'fs:newFolder',
    FS_DELETE_FILE: 'fs:deleteFile',
    FS_REVEAL_IN_EXPLORER: 'fs:revealInExplorer',
    FS_OPEN_TERMINAL: 'fs:openTerminal',

    // Project operations
    PROJECT_GET_ROOT: 'project:getRoot',
    PROJECT_OPEN_FOLDER: 'project:openFolder',

    // AI/Prompt operations
    PROMPT_SEND: 'prompt:send',
    PROMPT_STREAM: 'gemini:stream',
    PROMPT_STREAM_CHUNK: 'gemini:stream:chunk',
    PROMPT_STREAM_DONE: 'gemini:stream:done',
    PROMPT_STREAM_ERROR: 'gemini:stream:error',

    // Conversation history
    HISTORY_SAVE: 'history:save',
    HISTORY_LOAD: 'history:load',

    // Project memory (local)
    MEMORY_SAVE: 'memory:save',
    MEMORY_LOAD: 'memory:load',

    // Global memory (Supabase)
    GLOBAL_MEMORY_LOAD: 'globalMemory:load',
    GLOBAL_MEMORY_SAVE: 'globalMemory:save',

    // Document ingestion & RAG
    INGESTION_DOCUMENT: 'ingestion:document',
    INGESTION_FETCH_URL: 'ingestion:fetchUrl',
    DEVELOPER_LIBRARY_QUERY: 'developerLibrary:query',

    // Command execution
    CMD_RUN: 'cmd:run',
    CMD_GET_OUTPUT: 'cmd:getOutput',
    CMD_KILL: 'cmd:kill',

    // Codebase search
    CODEBASE_SEARCH: 'codebase:search',
    CODEBASE_FIND_FILES: 'codebase:findFiles',

    // Git operations
    GIT_DIFF: 'git:diff',
    GIT_APPLY_PATCH: 'git:applyPatch',

    // Supabase
    SUPABASE_TEST: 'supabase:test',

    // Workspace state (Phase 7.5)
    WORKSPACE_SAVE: 'workspace:save',
    WORKSPACE_LOAD: 'workspace:load',
};

/**
 * Get all valid channel names as an array
 * @returns {string[]} Array of all valid IPC channel names
 */
export function getValidChannels() {
    return Object.values(IPC_CHANNELS);
}

/**
 * Check if a channel name is valid
 * @param {string} channel - The channel name to validate
 * @returns {boolean} True if the channel is valid
 */
export function isValidChannel(channel) {
    return getValidChannels().includes(channel);
}

/**
 * Validate a channel and throw an error if invalid
 * @param {string} channel - The channel name to validate
 * @throws {Error} If the channel is not valid
 */
export function validateChannel(channel) {
    if (!isValidChannel(channel)) {
        const validChannels = getValidChannels().join(', ');
        throw new Error(
            `Invalid IPC channel: "${channel}". ` +
            `Valid channels are: ${validChannels}`
        );
    }
}

/**
 * Get channel by key (for dynamic lookups)
 * @param {string} key - The key name (e.g., 'FS_READ_FILE')
 * @returns {string|undefined} The channel name or undefined if not found
 */
export function getChannel(key) {
    return IPC_CHANNELS[key];
}

// Default export for convenience
export default IPC_CHANNELS;
