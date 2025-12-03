// ---------------------------------------------------------------------------
// PROMPT (Gemini) - used by the AI prompt window
// ---------------------------------------------------------------------------

ipcMain.handle("prompt:send", async (event, payloadOrText, maybeOptions = {}) => {
    try {
        const model = getGeminiModel();

        let systemPrompt = "";
        let userPrompt = "";
        let fileContext = null;
        let cursor = null;
        let history = [];

        if (typeof payloadOrText === "string" || payloadOrText instanceof String) {
            userPrompt = payloadOrText;
            if (maybeOptions && typeof maybeOptions === "object") {
                systemPrompt = maybeOptions.systemPrompt || "";
                fileContext = maybeOptions.fileContext || null;
                cursor = maybeOptions.cursor || null;
                history = maybeOptions.history || [];
            }
        } else if (payloadOrText && typeof payloadOrText === "object") {
            userPrompt = payloadOrText.prompt || "";
            systemPrompt = payloadOrText.systemPrompt || "";
            fileContext = payloadOrText.fileContext || null;
            cursor = payloadOrText.cursor || null;
            history = payloadOrText.history || [];
        }

        const parts = [];
        if (systemPrompt) {
            parts.push({ text: systemPrompt + "\n\n" });
        }
        if (fileContext) {
            parts.push({ text: "Project context:\n" + fileContext + "\n\n" });
        }
        if (cursor) {
            parts.push({ text: "Cursor context:\n" + cursor + "\n\n" });
        }
        parts.push({ text: userPrompt });

        const contents = [];
        if (history && history.length > 0) {
            for (const msg of history) {
                if (msg.role === 'user' || msg.role === 'assistant') {
                    contents.push({
                        role: msg.role === 'assistant' ? 'model' : 'user',
                        parts: [{ text: msg.content }]
                    });
                }
            }
        }

        contents.push({
            role: "user",
            parts,
        });

        const result = await model.generateContent({ contents });
        const response = result.response;
        const outText = typeof response.text === "function" ? response.text() : "";

        return { ok: true, text: outText };
    } catch (err) {
        console.error("[AesopIDE prompt:send error]", err);
        return { ok: false, text: err.message || String(err) };
    }
});

