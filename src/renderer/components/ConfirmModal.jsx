/* src/renderer/components/ConfirmModal.jsx */
import React, { useEffect, useRef } from "react";
import "../styles/app.css";

export default function ConfirmModal({ title, message, children, confirmLabel = "Confirm", cancelLabel = "Cancel", onConfirm, onCancel }) {
  const ref = useRef(null);
  useEffect(() => { ref.current?.focus(); }, []);
  return (
    <div className="modal-overlay" role="dialog" aria-modal="true">
      <div className="modal-content" style={{ width: "720px", maxWidth: "95vw" }}>
        <div className="modal-header">
          <span className="modal-title">{title}</span>
          <button className="modal-close" onClick={onCancel}>âœ•</button>
        </div>
        <div className="modal-body">
          <p className="modal-message">{message}</p>
          {children ? <div style={{ marginTop:12, padding:12, background:"var(--bg-dark)", border:"1px solid var(--border)", borderRadius:6, maxHeight:"45vh", overflow:"auto", fontFamily:"var(--font-mono)" }}>{children}</div> : null}
        </div>
        <div className="modal-footer">
          <button className="btn btn-secondary" onClick={onCancel}>{cancelLabel}</button>
          <button ref={ref} className="btn btn-primary" onClick={onConfirm} style={{ marginLeft:8 }}>{confirmLabel}</button>
        </div>
      </div>
    </div>
  );
}
