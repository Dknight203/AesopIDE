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
    const fenced = /```(?:json|tool)?\s*([\s\S]*?)```/gi;
    let m;
    while ((m = fenced.exec(text)) !== null) {
        const inner = m[1].trim();
        const parsed = tryParseJSON(inner);

        console.log("[ToolParser] Parsed JSON:", JSON.stringify(parsed));

        // Handle array of tool calls
        if (Array.isArray(parsed)) {
            for (const item of parsed) {
                // Handle standard tool/name format
                if (item && (item.tool || item.name)) {
                    // Extract params - either nested or flat format
                    let params = item.params || item.parameters || item.args || {};

                    // If params is empty, extract all keys except tool/name (flat format)
                    if (Object.keys(params).length === 0) {
                        params = { ...item };
                        delete params.tool;
                        delete params.name;
                    }
                    console.log("[ToolParser] Extracted params (array item):", params);
                    calls.push({ tool: item.tool || item.name, params, raw: inner });
                }
                // Handle "tool_code" format: writeFile("path", "content")
                else if (item && item.tool_code) {
                    const code = item.tool_code;
                    const match = /^([a-zA-Z0-9_]+)\((.*)\)$/.exec(code);
                    if (match) {
                        const toolName = match[1];
                        const argsStr = match[2];
                        // Parse arguments - naive comma split for now, but handles quoted strings
                        // Better: use a proper parser or regex for args
                        // For now, let's try to parse it as a JSON array by wrapping in []
                        let args = [];
                        try {
                            args = JSON.parse(`[${argsStr}]`);
                        } catch (e) {
                            console.error("[ToolParser] Failed to parse tool_code args:", argsStr);
                        }

                        // Map args to params based on tool name (hardcoded mapping needed for this format)
                        let params = {};
                        if (toolName === 'writeFile') {
                            params = { path: args[0], content: args[1] };
                        } else if (toolName === 'readFile') {
                            params = { path: args[0] };
                        } else if (toolName === 'runCommand') {
                            params = { cmd: args[0] };
                        } else if (toolName === 'findFiles') {
                            params = { pattern: args[0] };
                        } else {
                            // Fallback: assign to arg1, arg2...
                            args.forEach((arg, i) => params[`arg${i + 1}`] = arg);
                        }

                        console.log("[ToolParser] Extracted params from tool_code:", params);
                        calls.push({ tool: toolName, params, raw: inner });
                    }
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

            console.log("[ToolParser] Extracted params (single object):", params);

            calls.push({
                tool: parsed.tool || parsed.name,
                params,
                raw: inner
            });
        }
    }

    // Inline JSON after marker: AesopTool: runCommand {"cmd":"git status"}
    const inlineJson = /Aesop(?:Tool|IDE tool):\s*([^\s{]+)\s*(\{[\s\S]*?\})/gi;
    while ((m = inlineJson.exec(text)) !== null) {
        const tool = m[1].trim();
        const obj = tryParseJSON(m[2]);
        if (tool) calls.push({ tool, params: obj || {}, raw: m[0] });
    }

    // Simple key=value: AesopTool: writeFile path=src/foo.js content="..."
    const simple = /Aesop(?:Tool|IDE tool):\s*([^\s]+)\s*([^\n`]+)/gi;
    while ((m = simple.exec(text)) !== null) {
        const tool = m[1].trim();
        const rest = (m[2] || "").trim();
        const params = {};
        const kv = /([a-zA-Z0-9_\-]+)=(".*?"|'.*?'|\S+)/g;
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
