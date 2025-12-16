import React, { useState } from 'react';
import '../styles/prompt.css';

/**
 * A collapsible component that groups tool execution logs and "thought processes".
 * Inspired by modern AI interfaces that hide the "plumbing" unless requested.
 */
export default function ThinkingBlock({ steps = [], isFinished = false }) {
    const [isExpanded, setIsExpanded] = useState(!isFinished);

    // If no steps, render nothing (or a skeleton if active)
    if (!steps || steps.length === 0) return null;

    const toggle = () => setIsExpanded(!isExpanded);

    return (
        <div className="thought-chain-container">
            <div className="thought-header" onClick={toggle}>
                <span className="thought-icon">{isFinished ? '✨' : '⚡'}</span>
                <span className="thought-summary">
                    {isFinished ? 'Finished processing' : 'Thinking...'}
                </span>
                <span className="thought-arrow">{isExpanded ? '▼' : '▶'}</span>
            </div>

            {(isExpanded || !isFinished) && (
                <div className="thought-steps">
                    {steps.map((step, idx) => (
                        <div key={idx} className={`thought-step ${step.status}`}>
                            <div className="step-icon">
                                {step.status === 'pending' && <span className="spinner-small"></span>}
                                {step.status === 'success' && '✓'}
                                {step.status === 'error' && '✕'}
                            </div>
                            <div className="step-content">
                                <span className="step-tool-name">{step.tool}</span>
                                <span className="step-desc">{step.description}</span>
                                {step.result && (
                                    <div className="step-result">
                                        <code>{JSON.stringify(step.result, null, 2)}</code>
                                    </div>
                                )}
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}
