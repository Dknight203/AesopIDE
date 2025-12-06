// src/renderer/components/PlanReview.jsx
import React, { useState, useEffect } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { executeChain, readPlanFile } from '../lib/tasks/manager';
import Mermaid from './Mermaid';
import '../styles/planreview.css';
import '../styles/markdown.css'; // New styles

export default function PlanReview({
    rootPath,
    onClose,
    onExecute,
    onCancel,
    initialPlanContent
}) {
    const [planContent, setPlanContent] = useState(initialPlanContent || "Loading implementation plan...");
    const [status, setStatus] = useState("Awaiting approval");

    useEffect(() => {
        // If no initial content is passed, try to load it from the disk (Phase 3.2 Artifact)
        if (!initialPlanContent) {
            loadPlan();
        }
    }, [initialPlanContent]);

    async function loadPlan() {
        try {
            const content = await readPlanFile(rootPath);
            if (content) {
                setPlanContent(content);
                setStatus("Ready to execute");
            } else {
                setPlanContent("No implementation plan found on disk. Ask the AI to generate one.");
                setStatus("Error loading plan");
            }
        } catch (error) {
            setPlanContent(`Error loading plan: ${error.message}`);
            setStatus("Error");
        }
    }

    // NEW FUNCTION to handle execution flow and close the modal
    async function handleExecute() {
        if (status === 'Executing...') return;

        // FIX: Add a safeguard check for the onExecute prop.
        if (typeof onExecute !== 'function') {
            console.error("Critical Error: onExecute prop is missing or not a function.");
            setStatus("Error: Execution function missing.");
            setTimeout(() => onClose(), 1500);
            return;
        }

        setStatus("Executing...");

        try {
            // 🌟 CRITICAL FIX: Pass the planContent string to the parent's function.
            await onExecute(planContent);

            // If execution succeeds, close the modal.
            onClose();

        } catch (error) {
            // If execution fails, log it and update status.
            console.error("Execution chain failed:", error);
            setStatus("Execution Failed");

            // Close after a brief delay so the user sees the error status.
            setTimeout(() => onClose(), 1500);
        }
    }

    return (
        <div className="modal-overlay">
            <div className="plan-review-modal modal-content">
                <div className="modal-header">
                    <span className="modal-title">🤖 Plan Review: implementation_plan.md</span>
                    <button className="modal-close" onClick={onCancel} title="Cancel Review">✕</button>
                </div>

                <div className="plan-body modal-body scrollable">
                    <div className={`plan-status-bar status-${status.toLowerCase().replace(/\s/g, '-')}`}>
                        Current Status: {status}
                    </div>

                    <div className="markdown-body">
                        <ReactMarkdown
                            children={planContent}
                            remarkPlugins={[remarkGfm]}
                            components={{
                                code({ node, inline, className, children, ...props }) {
                                    const match = /language-(\w+)/.exec(className || '')
                                    const language = match ? match[1] : ''

                                    if (!inline && language === 'mermaid') {
                                        return <Mermaid chart={String(children).replace(/\n$/, '')} />
                                    }

                                    return !inline && match ? (
                                        <pre className={className}>
                                            <code className={className} {...props}>
                                                {children}
                                            </code>
                                        </pre>
                                    ) : (
                                        <code className={className} {...props}>
                                            {children}
                                        </code>
                                    )
                                }
                            }}
                        />
                    </div>

                    <p className="plan-warning">
                        Review the entire plan above. Execution may modify files, run commands, and commit code. Proceed with caution.
                    </p>
                </div>

                <div className="modal-footer">
                    <button className="btn btn-secondary" onClick={onCancel} disabled={status === 'Executing...'}>
                        Cancel
                    </button>
                    <button
                        className="btn btn-primary"
                        onClick={handleExecute} // Call the corrected async handler
                        disabled={status === 'Executing...' || status.startsWith('Error') || !initialPlanContent}
                    >
                        🚀 Approve and Execute
                    </button>
                </div>
            </div>
        </div>
    );
}
