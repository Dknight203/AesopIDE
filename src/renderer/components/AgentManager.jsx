// src/renderer/components/AgentManager.jsx
import React from 'react';
import '../styles/agentmanager.css';

export default function AgentManager({
  onClose,
  steps = [],
  currentStepIndex = -1,
  isPaused = false,
  onPause,
  onResume,
  onCancel
}) {
  // Determine execution status
  const isExecuting = currentStepIndex >= 0 && currentStepIndex < steps.length;
  const isComplete = currentStepIndex >= steps.length && steps.length > 0;
  const hasSteps = steps.length > 0;

  return (
    <div className="agent-manager-overlay" onClick={onClose}>
      <div className="agent-manager-panel" onClick={(e) => e.stopPropagation()}>
        <div className="agent-manager-header">
          <h2>🤖 Agent Manager</h2>
          <button className="close-btn" onClick={onClose} title="Close">
            ✕
          </button>
        </div>

        <div className="agent-manager-body">
          {!hasSteps && (
            <div className="agent-placeholder">
              <p>👋 No active agent tasks</p>
              <p className="hint">
                Start a multi-step task by creating an implementation plan or asking the AI to complete a complex workflow.
              </p>
            </div>
          )}

          {hasSteps && (
            <>
              {/* Execution Status */}
              <div className="execution-status">
                {isExecuting && !isPaused && (
                  <div className="status-indicator running">
                    <span className="status-icon">⚡</span>
                    <span className="status-text">
                      Executing step {currentStepIndex + 1} of {steps.length}
                    </span>
                  </div>
                )}
                {isExecuting && isPaused && (
                  <div className="status-indicator paused">
                    <span className="status-icon">⏸️</span>
                    <span className="status-text">Paused at step {currentStepIndex + 1}</span>
                  </div>
                )}
                {isComplete && (
                  <div className="status-indicator complete">
                    <span className="status-icon">✅</span>
                    <span className="status-text">All steps completed</span>
                  </div>
                )}
              </div>

              {/* Step List */}
              <div className="steps-list">
                {steps.map((step, index) => {
                  const isPast = index < currentStepIndex;
                  const isCurrent = index === currentStepIndex;
                  const isFuture = index > currentStepIndex;

                  return (
                    <div
                      key={index}
                      className={`step-item ${isPast ? 'completed' : isCurrent ? 'active' : 'pending'
                        }`}
                    >
                      <div className="step-indicator">
                        {isPast && <span className="step-icon">✓</span>}
                        {isCurrent && <span className="step-icon current">⚡</span>}
                        {isFuture && <span className="step-number">{index + 1}</span>}
                      </div>
                      <div className="step-content">
                        <div className="step-title">
                          {step.tool || `Step ${index + 1}`}
                        </div>
                        {step.params && (
                          <div className="step-params">
                            {Object.keys(step.params).length > 0
                              ? `Params: ${JSON.stringify(step.params).substring(0, 100)}...`
                              : 'No parameters'}
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Control Buttons */}
              <div className="agent-controls">
                {isExecuting && !isPaused && (
                  <button className="control-btn pause-btn" onClick={onPause}>
                    ⏸️ Pause
                  </button>
                )}
                {isExecuting && isPaused && (
                  <button className="control-btn resume-btn" onClick={onResume}>
                    ▶️ Resume
                  </button>
                )}
                {isExecuting && (
                  <button className="control-btn cancel-btn" onClick={onCancel}>
                    ⏹️ Cancel
                  </button>
                )}
                {isComplete && (
                  <button className="control-btn" onClick={onCancel}>
                    Clear
                  </button>
                )}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
