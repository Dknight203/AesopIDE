// src/renderer/lib/gemini.js

/**
 * Sends a prompt to the Gemini model via the Electron main process.
 * @param {string} userPrompt - The main prompt text.
 * @param {object} options - Configuration options.
 * @param {string} options.systemPrompt - The system instruction.
 * @param {string} options.fileContext - Context about the currently active file and surrounding code.
 * @param {string} options.cursor - Context about the cursor location.
 * @param {Array<object>} options.history - Conversation history messages.
 * @param {string} options.knowledgeContext - Context from Project Knowledge.
 * @param {string} options.globalKnowledgeContext - Context from Global Knowledge.
 * @param {boolean} options.enableSearch - Whether to enable Google Search Grounding.
 * @returns {Promise<string>} The AI's text response or an error message.
 */
export async function askGemini(
    userPrompt,
    { systemPrompt = "", fileContext = null, cursor = null, history = [], knowledgeContext = "", globalKnowledgeContext = "", enableSearch = false }
) {
    if (!window.aesop || !window.aesop.prompt || !window.aesop.prompt.send) {
        return "Error: AI service bridge not available (window.aesop.prompt.send is missing).";
    }

    try {
        const result = await window.aesop.prompt.send(userPrompt, {
            systemPrompt,
            fileContext,
            cursor,
            history,
            knowledgeContext,
            globalKnowledgeContext,
            enableSearch,
        });

        if (!result.ok) {
            return `AI Error: ${result.text}`;
        }
        return result.text;
    } catch (err) {
        console.error("Gemini API call failed:", err);
        return `Internal Error: Could not connect to AI service. ${err.message}`;
    }
}

/**
 * Sends a prompt to the Gemini model and streams the response.
 * @param {string} userPrompt - The main prompt text.
 * @param {object} options - Configuration options (same as askGemini).
 * @param {function} onChunk - Callback function called with each text chunk.
 * @returns {Promise<string>} The full accumulated text response.
 */
export function askGeminiStream(
    userPrompt,
    { systemPrompt = "", fileContext = null, cursor = null, history = [], knowledgeContext = "", globalKnowledgeContext = "", enableSearch = false },
    onChunk
) {
    return new Promise((resolve, reject) => {
        if (!window.aesop || !window.aesop.prompt || !window.aesop.prompt.stream) {
            reject(new Error("AI service bridge not available (window.aesop.prompt.stream is missing)."));
            return;
        }

        const streamId = 'stream_' + Date.now().toString(36) + Math.random().toString(36).substr(2);
        let accumulatedText = "";

        const cleanup = () => {
            // In a real app with multiple streams, we would need to remove specific listeners.
            // Check if removeStreamListeners removes ALL listeners or just ours.
            // Our preload implementation removes ALL.
            // For now, this is acceptable as we likely only have one active stream.
            if (window.aesop.prompt.removeStreamListeners) {
                window.aesop.prompt.removeStreamListeners();
            }
        };

        // Setup listeners
        window.aesop.prompt.onStreamChunk(({ streamId: id, text }) => {
            if (id !== streamId) return;
            accumulatedText += text;
            if (onChunk) onChunk(text, accumulatedText);
        });

        window.aesop.prompt.onStreamDone(({ streamId: id }) => {
            if (id !== streamId) return;
            cleanup();
            resolve(accumulatedText);
        });

        window.aesop.prompt.onStreamError(({ streamId: id, error }) => {
            if (id !== streamId) return;
            cleanup();
            console.error("Gemini stream error:", error);
            // If we have some text, we might want to resolve with it?
            // But usually error means failure.
            reject(new Error(error));
        });

        // Start stream
        try {
            window.aesop.prompt.stream({
                prompt: userPrompt,
                streamId,
                systemPrompt,
                fileContext,
                cursor,
                history,
                knowledgeContext,
                globalKnowledgeContext,
                enableSearch
            });
        } catch (err) {
            cleanup();
            reject(err);
        }
    });
}