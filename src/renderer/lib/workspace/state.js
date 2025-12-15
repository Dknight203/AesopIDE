// src/renderer/lib/workspace/state.js
// Phase 7.5: Workspace State Persistence
// Saves/restores IDE state across sessions (open tabs, panel sizes, scroll positions)

/**
 * WorkspaceState manages persistent IDE state for a project.
 * Inspired by VSCode's memento pattern.
 */
export class WorkspaceState {
    constructor(projectPath) {
        this.projectPath = projectPath;
        // Store in localStorage with project-specific key
        this.storageKey = `aesop_workspace_${this.hashPath(projectPath)}`;
    }

    /**
     * Simple hash function for creating unique storage keys
     * @param {string} path - Project path to hash
     * @returns {string} Hash string
     */
    hashPath(path) {
        if (!path) return 'default';
        let hash = 0;
        for (let i = 0; i < path.length; i++) {
            const char = path.charCodeAt(i);
            hash = ((hash << 5) - hash) + char;
            hash = hash & hash; // Convert to 32bit integer
        }
        return Math.abs(hash).toString(36);
    }

    /**
     * Get the default state structure
     * @returns {Object} Default workspace state
     */
    getDefaultState() {
        return {
            // Open tabs and active file
            openTabs: [],          // Array of { path, name, scrollTop }
            activeTabPath: null,

            // Panel dimensions
            sidebarWidth: 250,
            rightSidebarWidth: 400,
            bottomPanelHeight: 300,

            // Panel visibility
            sidebarCollapsed: false,
            bottomPanelCollapsed: false,
            promptOpen: false,

            // Scroll positions in file tree
            fileTreeScroll: 0,

            // Expanded folders in file tree
            expandedFolders: [],

            // Last saved timestamp
            lastSaved: null,
        };
    }

    /**
     * Save the current workspace state
     * @param {Object} state - State object to save
     */
    save(state) {
        try {
            const stateToSave = {
                ...state,
                lastSaved: new Date().toISOString(),
            };
            localStorage.setItem(this.storageKey, JSON.stringify(stateToSave));
            return true;
        } catch (err) {
            console.error('WorkspaceState: Failed to save state', err);
            return false;
        }
    }

    /**
     * Load the saved workspace state
     * @returns {Object} Saved state or default state
     */
    load() {
        try {
            const saved = localStorage.getItem(this.storageKey);
            if (saved) {
                const parsed = JSON.parse(saved);
                // Merge with defaults to handle any missing fields from older versions
                return { ...this.getDefaultState(), ...parsed };
            }
        } catch (err) {
            console.error('WorkspaceState: Failed to load state', err);
        }
        return this.getDefaultState();
    }

    /**
     * Update a specific key in the state
     * @param {string} key - State key to update
     * @param {*} value - New value
     */
    update(key, value) {
        const current = this.load();
        current[key] = value;
        this.save(current);
    }

    /**
     * Clear the saved state for this project
     */
    clear() {
        try {
            localStorage.removeItem(this.storageKey);
            return true;
        } catch (err) {
            console.error('WorkspaceState: Failed to clear state', err);
            return false;
        }
    }

    /**
     * Export state for backup/debugging
     * @returns {string} JSON string of current state
     */
    export() {
        return localStorage.getItem(this.storageKey) || JSON.stringify(this.getDefaultState());
    }
}

/**
 * React hook for workspace state management
 * @param {string} projectPath - Current project path
 * @returns {Object} { state, updateState, saveState, resetState }
 */
export function createWorkspaceStateManager(projectPath) {
    const manager = new WorkspaceState(projectPath);

    return {
        load: () => manager.load(),
        save: (state) => manager.save(state),
        update: (key, value) => manager.update(key, value),
        clear: () => manager.clear(),
        export: () => manager.export(),
    };
}

export default WorkspaceState;
