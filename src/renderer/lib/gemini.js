// src/renderer/lib/gemini.js
export async function askGemini(promptText, options = {}) {
  if (!window.aesop || !window.aesop.prompt || !window.aesop.prompt.send) {
    throw new Error("AesopIDE prompt bridge is not available in the renderer.");
  }

  const result = await window.aesop.prompt.send(promptText, options);

  if (!result || !result.ok) {
    throw new Error(result?.text || "Unknown Gemini error.");
  }

  return result.text;
}
