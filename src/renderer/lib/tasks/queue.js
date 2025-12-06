import { executeTool } from "../tools/framework";

// Phase 7.1: Task Priorities
export const PRIORITY = {
    CRITICAL: 0,
    HIGH: 1,
    NORMAL: 2,
    LOW: 3
};

const STORAGE_KEY = 'aesop_task_queue_v1';

class TaskQueue {
    constructor() {
        this.queue = [];
        this.history = []; // Completed tasks
        this.status = 'idle'; // 'idle', 'running', 'paused', 'error'
        this.currentTask = null;
        this.listeners = new Set();
        this.stopRequested = false;

        // Phase 7.2: Persistence - Load state on startup
        this.loadFromStorage();
    }

    /**
     * Add a task to the queue
     * @param {Object} task - Task object { tool, params, id, title, priority, dependencies }
     */
    add(task) {
        const taskWithId = {
            ...task,
            id: task.id || crypto.randomUUID(),
            status: 'pending',
            addedAt: new Date(),
            priority: task.priority !== undefined ? task.priority : PRIORITY.NORMAL,
            dependencies: task.dependencies || [] // Array of IDs this task waits for
        };
        this.queue.push(taskWithId);
        this.saveToStorage(); // Persist
        this.notify();
        return taskWithId.id;
    }

    /**
     * Add multiple tasks
     * @param {Array} tasks 
     */
    addAll(tasks) {
        tasks.forEach(t => this.add(t));
    }

    /**
     * Start or resume execution
     */
    async start() {
        if (this.status === 'running') return;
        this.status = 'running';
        this.stopRequested = false;
        this.notify();

        await this.processQueue();
    }

    /**
     * Pause execution after current task
     */
    pause() {
        if (this.status === 'running') {
            this.status = 'paused';
            this.stopRequested = true;
            this.notify();
            this.saveToStorage();
        }
    }

    /**
     * Clear the queue (stops execution)
     */
    clear() {
        this.queue = [];
        this.history = []; // Optionally clear history too? Maybe keep for session.
        this.status = 'idle';
        this.currentTask = null;
        this.stopRequested = false;
        this.saveToStorage(); // Clear storage
        this.notify();
    }

    /**
     * Main execution loop
     */
    async processQueue() {
        while (this.queue.length > 0 && !this.stopRequested) {
            // Phase 7.1: Sort by Priority
            this.queue.sort((a, b) => a.priority - b.priority);

            // Phase 7.2: Dependency Resolution
            // Find the first task that is NOT blocked by unsatisfied dependencies
            const candidates = this.queue;
            let nextTaskIndex = -1;

            for (let i = 0; i < candidates.length; i++) {
                const candidate = candidates[i];
                const deps = candidate.dependencies;

                // Check if all deps are in history (completed)
                const allDepsMet = deps.every(depId =>
                    this.history.some(h => h.id === depId && h.status === 'completed')
                );

                if (allDepsMet) {
                    nextTaskIndex = i;
                    break;
                }
            }

            if (nextTaskIndex === -1) {
                // All remaining tasks are blocked or queue is empty
                if (this.queue.length > 0) {
                    console.warn("[TaskQueue] Deadlock detected or all tasks waiting for external events.");
                    this.status = 'paused'; // Pause to let user intervene
                    this.stopRequested = true;
                }
                break;
            }

            // Extract the ready task
            this.currentTask = this.queue.splice(nextTaskIndex, 1)[0];
            this.currentTask.status = 'running';
            this.currentTask.startedAt = new Date();
            this.notify();

            try {
                console.log(`[TaskQueue] Executing: ${this.currentTask.tool} (Priority: ${this.currentTask.priority})`);
                const result = await executeTool(this.currentTask.tool, this.currentTask.params);

                this.currentTask.status = 'completed';
                this.currentTask.result = result;
                this.currentTask.completedAt = new Date();
                this.history.push(this.currentTask);

                // Save after success
                this.saveToStorage();

            } catch (error) {
                console.error(`[TaskQueue] Task failed:`, error);
                this.currentTask.status = 'failed';
                this.currentTask.error = error.message;
                this.currentTask.completedAt = new Date();
                this.history.push(this.currentTask);

                // Stop on error
                this.status = 'paused';
                this.stopRequested = true;
                this.saveToStorage();
            } finally {
                this.currentTask = null;
                this.notify();
            }
        }

        if (this.queue.length === 0 && !this.currentTask) {
            this.status = 'idle';
        } else if (this.stopRequested) {
            // Status already set to paused
        }
        this.saveToStorage();
        this.notify();
    }

    /**
     * Subscribe to state changes
     */
    subscribe(callback) {
        this.listeners.add(callback);
        return () => this.listeners.delete(callback);
    }

    /**
     * Notify listeners
     */
    notify() {
        const state = this.getState();
        this.listeners.forEach(cb => cb(state));
    }

    /**
     * Get current state snapshot
     */
    getState() {
        return {
            status: this.status,
            queue: [...this.queue],
            history: [...this.history],
            currentTask: this.currentTask
        };
    }

    // --- Phase 7.2 Persistence ---

    saveToStorage() {
        try {
            const state = {
                queue: this.queue,
                history: this.history,
                status: this.status === 'running' ? 'paused' : this.status // Don't save 'running' state, revert to paused on reload
            };
            localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
        } catch (e) {
            console.warn("[TaskQueue] Failed to save state:", e);
        }
    }

    loadFromStorage() {
        try {
            const raw = localStorage.getItem(STORAGE_KEY);
            if (!raw) return;

            const state = JSON.parse(raw);
            if (state) {
                this.queue = state.queue || [];
                this.history = state.history || [];
                this.status = state.status || 'idle';

                // Restore dates if needed (JSON stringifies dates)
                // For now, strings are fine for display
                console.log(`[TaskQueue] Restored ${this.queue.length} pending tasks`);
            }
        } catch (e) {
            console.error("[TaskQueue] Failed to load state:", e);
        }
    }
}

// Singleton instance
export const agentQueue = new TaskQueue();
