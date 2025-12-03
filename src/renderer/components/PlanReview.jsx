// src/renderer/components/PlanReview.jsx
import React, { useState, useEffect } from 'react';
import '../styles/planreview.css';

export default function PlanReview({ projectPath, onApprove, onReject, onClose }) {
    const [plan, setPlan] = useState(null);
    const [loading, setLoading] = useState(true);
    const [rejectionReason, setRejectionReason] = useState('');
    const [showRejectInput, setShowRejectInput] = useState(false);

    useEffect(() => {
        loadPlan();
    }, [projectPath]);

    async function loadPlan() {
        try {
            const planPath = `${projectPath}/.aesop/implementation_plan.md`;
            const content = await window.aesop.fs.readFile(planPath);
            setPlan(content);
        } catch (err) {
            console.error('[PlanReview] Failed to load plan:', err);
            setPlan(null);
        } finally {
            setLoading(false);
        }
    }

    function handleApprove() {
        if (onApprove) onApprove();
    }

    function handleReject() {
        if (!rejectionReason.trim()) {
            alert('Please provide a reason for rejection');
            return;
        }
        if (onReject) onReject(rejectionReason);
        setShowRejectInput(false);
        setRejectionReason('');
    }

    function renderMarkdown(text) {
        // Simple markdown rendering
        const lines = text.split('\n');
        return lines.map((line, idx) => {
            // Headers
            if (line.startsWith('# ')) {
                return <h1 key={idx}>{line.substring(2)}</h1>;
            }
            if (line.startsWith('## ')) {
                return <h2 key={idx}>{line.substring(3)}</h2>;
            }
            if (line.startsWith('### ')) {
                return <h3 key={idx}>{line.substring(4)}</h3>;
            }
            if (line.startsWith('#### ')) {
                return <h4 key={idx}>{line.substring(5)}</h4>;
            }

            // Horizontal rule
            if (line.trim() === '---') {
                return <hr key={idx} />;
            }

            // List items
            if (line.startsWith('- ')) {
                return <li key={idx}>{line.substring(2)}</li>;
            }

            // Bold text
            if (line.includes('**')) {
                const parts = line.split('**');
                return (
                    <p key={idx}>
                        {parts.map((part, i) =>
                            i % 2 === 1 ? <strong key={i}>{part}</strong> : part
                        )}
                    </p>
                );
            }

            // Blockquotes (alerts)
            if (line.startsWith('> ')) {
                const alertMatch = line.match(/>\s*\[!(\w+)\]/);
                if (alertMatch) {
                    const level = alertMatch[1].toLowerCase();
                    return <div key={idx} className={`alert alert-${level}`}></div>;
                }
                return <blockquote key={idx}>{line.substring(2)}</blockquote>;
            }

            // Regular paragraph
            if (line.trim()) {
                return <p key={idx}>{line}</p>;
            }

            return <br key={idx} />;
        });
    }

    if (loading) {
        return (
            <div className="plan-review">
                <div className="plan-review-loading">Loading plan...</div>
            </div>
        );
    }

    if (!plan) {
        return (
            <div className="plan-review">
                <div className="plan-review-error">No implementation plan found</div>
                <button className="plan-review-close" onClick={onClose}>Close</button>
            </div>
        );
    }

    return (
        <div className="plan-review">
            <div className="plan-review-header">
                <h2>📋 Implementation Plan Review</h2>
                <button className="plan-review-close-btn" onClick={onClose} title="Close">
                    ✕
                </button>
            </div>

            <div className="plan-review-content">
                {renderMarkdown(plan)}
            </div>

            <div className="plan-review-actions">
                {!showRejectInput ? (
                    <>
                        <button
                            className="plan-review-btn plan-review-approve"
                            onClick={handleApprove}
                        >
                            ✅ Approve Plan
                        </button>
                        <button
                            className="plan-review-btn plan-review-reject"
                            onClick={() => setShowRejectInput(true)}
                        >
                            ❌ Reject Plan
                        </button>
                    </>
                ) : (
                    <div className="plan-review-reject-form">
                        <textarea
                            className="plan-review-reject-input"
                            placeholder="Reason for rejection..."
                            value={rejectionReason}
                            onChange={(e) => setRejectionReason(e.target.value)}
                            rows={3}
                        />
                        <div className="plan-review-reject-actions">
                            <button
                                className="plan-review-btn plan-review-reject-submit"
                                onClick={handleReject}
                            >
                                Submit Rejection
                            </button>
                            <button
                                className="plan-review-btn plan-review-cancel"
                                onClick={() => {
                                    setShowRejectInput(false);
                                    setRejectionReason('');
                                }}
                            >
                                Cancel
                            </button>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
