// src/renderer/components/PlanReview.jsx
import React, { useState, useEffect } from 'react';
import { executeChain, readPlanFile } from '../lib/tasks/manager';
import '../styles/planreview.css';

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

    const planSections = planContent.split(/^(#+ .+\n)/gm).filter(s => s.trim().length > 0);

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

                    <pre className="plan-content">
                        {planSections.map((section, index) => {
                            if (section.startsWith('#')) {
                                return <h4 key={index} className="plan-header">{section.trim()}</h4>;
                            }
                            // Basic markdown rendering (just displays code/list items cleanly)
                            return <p key={index} className="plan-text">{section.trim()}</p>;
                        })}
                    </pre>

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
                        onClick={() => {
                            setStatus("Executing...");
                            onExecute(); // Triggers execution chain in App.jsx
                        }}
                        disabled={status === 'Executing...' || status.startsWith('Error') || !initialPlanContent}
                    >
                        🚀 Approve and Execute
                    </button>
                </div>
            </div>
        </div>
    );
}