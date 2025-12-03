/* src/renderer/lib/ai/toolParser.js
   Parses tool calls from AI text.
*/
function tryParseJSON(s) {
    try { return JSON.parse(s); } catch { return null; }
}

export default function parseToolCalls(text) {
    if (!text || typeof text !== "string") return [];
    const calls = [];

    // JSON fenced blocks with a tool object
    const fenced = /```(?:json|tool)?\\s*([\\s\\S]*?)```/gi;
    let m;
    while ((m = fenced.exec(text)) !== null) {
        const inner = m[1].trim();
        const parsed = tryParseJSON(inner);

        // Handle array of tool calls
        if (Array.isArray(parsed)) {
            for (const item of parsed) {
                if (item && (item.tool || item.name)) {
                    // Extract params - either nested or flat format
                    let params = item.params || item.parameters || item.args || {};

                    // If params is empty, extract all keys except tool/name (flat format)
                    if (Object.keys(params).length === 0) {
                        params = { ...item };
                        delete params.tool;
                        delete params.name;
                    }

                    calls.push({
                        tool: item.tool || item.name,
                        params,
                        raw: inner
                    });
                }
            }
        }
        // Handle single tool call object  
        else if (parsed && (parsed.tool || parsed.name)) {
            // Extract params - either nested or flat format
            let params = parsed.params || parsed.parameters || parsed.args || {};

            // If params is empty, extract all keys except tool/name (flat format)
            if (Object.keys(params).length === 0) {
                params = { ...parsed };
                delete params.tool;
                delete params.name;
            }

            calls.push({
                tool: parsed.tool || parsed.name,
                params,
                raw: inner
            });
        }
    }

    // Inline JSON after marker: AesopTool: runCommand {"cmd":"git status"}
    const inlineJson = /Aesop(?:Tool|IDE tool):\\s*([^\\s{]+)\\s*(\\{[\\s\\S]*?\\})/gi;
    while ((m = inlineJson.exec(text)) !== null) {
        const tool = m[1].trim();
        const obj = tryParseJSON(m[2]);
        if (tool) calls.push({ tool, params: obj || {}, raw: m[0] });
    }

    // Simple key=value: AesopTool: writeFile path=src/foo.js content="..."
    const simple = /Aesop(?:Tool|IDE tool):\\s*([^\\s]+)\\s*([^\\n`]+)/gi;
    while ((m = simple.exec(text)) !== null) {
        const tool = m[1].trim();
        const rest = (m[2] || "").trim();
        const params = {};
        const kv = /([a-zA-Z0-9_\\-]+)=(".*?"|'.*?'|\\S+)/g;
        let k;
        while ((k = kv.exec(rest)) !== null) {
            let v = k[2];
            if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1);
            params[k[1]] = v;
        }
        if (tool) calls.push({ tool, params, raw: m[0] });
    }

    return calls;
}
