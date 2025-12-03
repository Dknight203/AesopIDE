// src/renderer/lib/gemini.js
export async function askGemini(promptText, options = {}) {
    if (!window.aesop || !window.aesop.prompt || !window.aesop.prompt.send) {
        throw new Error("Aesop prompt bridge is not available");
    }

    const result = await window.aesop.prompt.send(promptText, options);

    if (!result || result.ok !== true) {
        const message =
            (result && typeof result.text === "string" && result.text) ||
            "Gemini request failed";
        throw new Error(message);
    }

    return result.text;
}
