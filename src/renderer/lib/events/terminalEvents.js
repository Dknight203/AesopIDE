/**
 * Simple Event Bus for Terminal communication.
 * Allows the Agent (framework.js) to broadcast command activity to the UI (Terminal.jsx).
 */
class TerminalEventBus {
    constructor() {
        this.listeners = {};
    }

    /**
     * Subscribe to an event
     * @param {string} event - Event name ('command-start', 'command-output', 'command-end')
     * @param {Function} callback - Function to call when event is emitted
     * @returns {Function} Unsubscribe function
     */
    on(event, callback) {
        if (!this.listeners[event]) {
            this.listeners[event] = [];
        }
        this.listeners[event].push(callback);
        return () => this.off(event, callback);
    }

    /**
     * Unsubscribe from an event
     * @param {string} event 
     * @param {Function} callback 
     */
    off(event, callback) {
        if (!this.listeners[event]) return;
        this.listeners[event] = this.listeners[event].filter(cb => cb !== callback);
    }

    /**
     * Emit an event
     * @param {string} event 
     * @param {any} data 
     */
    emit(event, data) {
        if (!this.listeners[event]) return;
        this.listeners[event].forEach(cb => {
            try {
                cb(data);
            } catch (err) {
                console.error(`[TerminalEventBus] Error in listener for ${event}:`, err);
            }
        });
    }
}

export const terminalEvents = new TerminalEventBus();
