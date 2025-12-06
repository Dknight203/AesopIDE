// src/renderer/components/AgentManager.jsx
import React, { useEffect, useState } from 'react';
import { agentQueue } from '../lib/tasks/queue';
import '../styles/agentmanager.css';

export default function AgentManager({ onClose }) {
  // Subscribe to queue state
  const [state, setState] = useState(agentQueue.getState());

  useEffect(() => {
    // Initial sync
    setState(agentQueue.getState());

    // Subscribe to updates
    const unsubscribe = agentQueue.subscribe((newState) => {
      setState(newState);
    });

    return unsubscribe;
  }, []);

  const { queue, history, status, currentTask } = state;
  const isPaused = status === 'paused';
  const isExecuting = status === 'running' || status === 'paused';

  // Combine all steps for display: History + Current + Queue
  const allSteps = [
    ...history,
    ...(currentTask ? [currentTask] : []),
    ...queue
  ];

  const hasSteps = allSteps.length > 0;
  const currentIndex = history.length;
  const isComplete = queue.length === 0 && !currentTask && history.length > 0;

  // Handlers
  const handlePause = () => agentQueue.pause();
  const handleResume = () => agentQueue.start();
  const handleCancel = () => {
    agentQueue.clear();
    onClose(); // Close panel on cancel
  };

  return (
    <div className="agent-manager-overlay" onClick={onClose}>
      <div className="agent-manager-panel" onClick={(e) => e.stopPropagation()}>
        <div className="agent-manager-header">
          <h2>🤖 Agent Manager {isPaused && "(Paused)"}</h2>
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
                      Executing step {currentIndex + 1} of {allSteps.length}
                    </span>
                  </div>
                )}
                {isPaused && (
                  <div className="status-indicator paused">
                    <span className="status-icon">⏸️</span>
                    <span className="status-text">Paused at step {currentIndex + 1}</span>
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
                {allSteps.map((step, index) => {
                  const isPast = index < currentIndex;
                  const isCurrent = index === currentIndex && !isComplete;
                  const isFuture = index > currentIndex;

                  // Status based on step object if available, otherwise inferred from index
                  const stepStatus = step.status || (isPast ? 'completed' : isCurrent ? 'running' : 'pending');

                  return (
                    <div
                      key={step.id || index}
                      className={`step-item ${stepStatus}`}
                    >
                      <div className="step-indicator">
                        {stepStatus === 'completed' && <span className="step-icon">✓</span>}
                        {stepStatus === 'running' && <span className="step-icon current">⚡</span>}
                        {stepStatus === 'failed' && <span className="step-icon error">✕</span>}
                        {(stepStatus === 'pending' || isFuture) && <span className="step-number">{index + 1}</span>}
                      </div>
                      <div className="step-content">
                        <div className="step-title">
                          {step.tool || `Step ${index + 1}`}
                          <span style={{ opacity: 0.5, fontSize: '0.8em', marginLeft: '10px' }}>
                            {stepStatus}
                          </span>
                        </div>
                        {step.params && (
                          <div className="step-params">
                            {Object.keys(step.params).length > 0
                              ? `Params: ${JSON.stringify(step.params).substring(0, 80)}...`
                              : 'No parameters'}
                          </div>
                        )}
                        {step.error && (
                          <div className="step-error" style={{ color: '#ff6b6b', fontSize: '0.85em', marginTop: '4px' }}>
                            Error: {step.error}
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
                  <button className="control-btn pause-btn" onClick={handlePause}>
                    ⏸️ Pause
                  </button>
                )}
                {isPaused && (
                  <button className="control-btn resume-btn" onClick={handleResume}>
                    ▶️ Resume
                  </button>
                )}
                {(isExecuting || isPaused) && (
                  <button className="control-btn cancel-btn" onClick={handleCancel}>
                    ⏹️ Cancel
                  </button>
                )}
                {isComplete && (
                  <button className="control-btn" onClick={handleCancel}>
                    Clear & Close
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
