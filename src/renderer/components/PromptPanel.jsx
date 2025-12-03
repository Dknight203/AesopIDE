/* src/renderer/components/PromptPanel.jsx
   Updated to detect tool calls and require confirmation for destructive actions.
*/
import React, { useState, useRef, useEffect } from "react";
import "../styles/prompt.css";
import { askGemini } from "../lib/gemini";
import { SYSTEM_PROMPT } from "../lib/ai/systemPrompt";
import { buildFileContext } from "../lib/codebase/context";
import ConfirmModal from "./ConfirmModal";
import parseToolCalls from "../lib/ai/toolParser";
import { executeTool } from "../lib/tools/framework";

export default function PromptPanel({ onClose, onApplyCode, activeTab, rootPath, codebaseIndex }) {
  const [messages, setMessages] = useState([{ role:"assistant", content:"Hello. I am your AI assistant inside AesopIDE.", timestamp: new Date() }]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [confirmRequest, setConfirmRequest] = useState(null);
  const messagesEndRef = useRef(null);
  const inputRef = useRef(null);

  useEffect(() => { messagesEndRef.current?.scrollIntoView({ behavior:"smooth" }); }, [messages]);
  useEffect(() => { inputRef.current?.focus(); }, []);

  async function handleSend() {
    if (!input.trim() || isLoading) return;
    const text = input;
    setMessages(prev => [...prev, { role:"user", content:text, timestamp: new Date() }]);
    setInput(""); setIsLoading(true);
    try {
      let fileContext = "";
      if (activeTab && activeTab.path) fileContext = await buildFileContext(activeTab.path, codebaseIndex || [], { includeImports:true, includeImporters:true });
      const reply = await askGemini(text, { systemPrompt: SYSTEM_PROMPT, fileContext });
      setMessages(prev => [...prev, { role:"assistant", content:reply, timestamp:new Date() }]);

      const toolCalls = parseToolCalls(reply || "");
      if (toolCalls.length) {
        for (const call of toolCalls) {
          const { tool, params } = call;
          setMessages(prev => [...prev, { role:"assistant", content:`â³ Tool: ${tool}`, timestamp:new Date() }]);
          const destructive = tool === "writeFile" || (tool === "runCommand" && typeof params.cmd === "string" && /git\s+push|rm\s+|del\s+/i.test(params.cmd));
          if (destructive) {
            setConfirmRequest({
              title: "Confirm AI tool action",
              message: `The assistant requested to run tool "${tool}". Confirm to execute.`,
              content: JSON.stringify({ tool, params }, null, 2),
              onConfirm: async () => {
                try {
                  const res = await executeTool(tool, params);
                  setMessages(prev => [...prev, { role:"assistant", content:`âœ… ${tool} result:\\n${JSON.stringify(res, null, 2)}`, timestamp:new Date() }]);
                } catch (e) {
                  setMessages(prev => [...prev, { role:"assistant", content:`âŒ Tool error: ${e.message || String(e)}`, timestamp:new Date() }]);
                }
                setConfirmRequest(null);
              },
              onCancel: () => setConfirmRequest(null)
            });
          } else {
            try {
              const res = await executeTool(tool, params);
              setMessages(prev => [...prev, { role:"assistant", content:`âœ… ${tool} result:\\n${JSON.stringify(res, null, 2)}`, timestamp:new Date() }]);
              if (tool === "readFile" && res && res.content && onApplyCode) onApplyCode(`AesopIDE open file: ${res.path}`);
            } catch (e) {
              setMessages(prev => [...prev, { role:"assistant", content:`âŒ Tool error: ${e.message || String(e)}`, timestamp:new Date() }]);
            }
          }
        }
      } else {
        // Existing flow: if reply contains actionable code, ask confirmation before applying
        if (/\bAesopIDE open file:/i.test(reply)) { setTimeout(() => onApplyCode(reply), 100); }
        else if (reply.match(/```[\s\S]*?```/) && onApplyCode) {
          setConfirmRequest({ title:"AI suggests changes", message:"Review and confirm to apply AI-suggested edits.", content: reply, onConfirm: () => { onApplyCode(reply); setConfirmRequest(null); }, onCancel: () => setConfirmRequest(null) });
        }
      }
    } catch (err) {
      setMessages(prev => [...prev, { role:"assistant", content:"Error: " + (err.message || String(err)), timestamp:new Date() }]);
    } finally { setIsLoading(false); }
  }

  function renderMessageContent(content) {
    if (!content || typeof content !== "string") return content;
    const filePathPattern = /((?:[\w-]+\/)*[\w-]+\.\w+)/g;
    const parts = []; let last=0; let m;
    while ((m = filePathPattern.exec(content)) !== null) {
      if (m.index > last) parts.push(content.substring(last, m.index));
      const fp = m[1];
      parts.push(<span key={`fp-${m.index}`} className="file-link" onClick={() => onApplyCode && onApplyCode(`AesopIDE open file: ${fp}`)}>{fp}</span>);
      last = m.index + m[0].length;
    }
    if (last < content.length) parts.push(content.substring(last));
    return parts.length ? parts : content;
  }

  return (
    <div className="prompt-panel">
      <div className="prompt-header"><div className="prompt-header-left"><span className="prompt-title">âœ¨ AI Assistant</span></div><div className="prompt-header-right"><button className="prompt-close-btn" onClick={onClose}>âœ•</button></div></div>
      <div className="prompt-messages scrollable">
        {messages.map((m,i) => <div key={i} className={`message ${m.role==="user"?"message-user":"message-assistant"}`}><div className="message-header"><span className="message-role">{m.role==="user"?"ðŸ‘¤ You":"ðŸ¤– Assistant"}</span><span className="message-time">{m.timestamp.toLocaleTimeString()}</span></div><div className="message-content">{renderMessageContent(m.content)}</div></div>)}
        {isLoading && <div className="message message-assistant"><div className="message-header"><span className="message-role">ðŸ¤– Assistant</span></div><div className="message-content"><div className="loading-dots"><span></span><span></span><span></span></div></div></div>}
        <div ref={messagesEndRef} />
      </div>
      <div className="prompt-input-area"><textarea ref={inputRef} className="prompt-input" rows={3} value={input} onChange={e => setInput(e.target.value)} onKeyDown={e => { if (e.key==="Enter" && !e.shiftKey) { e.preventDefault(); handleSend(); } }} placeholder="Ask me anything..." /></div>
      <div style={{ padding: 12, display:'flex', justifyContent:'flex-end' }}><button className="prompt-send-btn" onClick={handleSend} disabled={!input.trim() || isLoading}>{isLoading ? 'â³' : 'ðŸ“¤'} Send</button></div>

      {confirmRequest && <ConfirmModal title={confirmRequest.title} message={confirmRequest.message} onConfirm={confirmRequest.onConfirm} onCancel={confirmRequest.onCancel} confirmLabel="Apply" cancelLabel="Cancel"><pre style={{ whiteSpace:'pre-wrap', margin:0 }}>{(() => { const txt = confirmRequest.content || ""; const f = txt.match(/```(?:[a-zA-Z0-9]+)?\s*\n([\s\S]*?)```/); if (f && f[1]) return f[1].trim(); return txt.length>1000? txt.substring(0,1000) + "\n\n...[truncated]": txt; })()}</pre></ConfirmModal>}
    </div>
  );
}
