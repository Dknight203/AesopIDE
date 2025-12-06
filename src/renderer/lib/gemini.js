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