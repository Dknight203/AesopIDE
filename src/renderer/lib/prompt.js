// src/renderer/lib/prompt.js

export async function sendPrompt(promptText, options = {}) {
  // Talk to the API that preload exposes
  const res = await window.aesop.prompt.send(promptText, options);

  // ipcHandlers returns an object like { ok: true, text: "..." }
  if (res && typeof res === "object" && "ok" in res) {
    if (!res.ok) {
      return {
        ok: false,
        error: res.text || res.message || "Unknown prompt error",
      };
    }

    return {
      ok: true,
      response: res.text || "",
    };
  }

  // Fallback in case main ever returns a plain string
  return {
    ok: true,
    response: String(res ?? ""),
  };
}
