// src/renderer/components/ErrorBoundary.jsx
// Phase 7.5: React Error Boundary for crash protection
import React from "react";

/**
 * ErrorBoundary catches JavaScript errors anywhere in their child component tree,
 * logs those errors, and displays a fallback UI instead of crashing the whole IDE.
 */
export default class ErrorBoundary extends React.Component {
    constructor(props) {
        super(props);
        this.state = { hasError: false, error: null, errorInfo: null };
    }

    static getDerivedStateFromError(error) {
        // Update state so the next render shows the fallback UI
        return { hasError: true, error };
    }

    componentDidCatch(error, errorInfo) {
        // Log the error to console for debugging
        console.error("ErrorBoundary caught an error:", error, errorInfo);

        // Store error info for display
        this.setState({ errorInfo });

        // Attempt to log via aesop logger if available
        try {
            if (window.aesop?.logger?.error) {
                window.aesop.logger.error("Renderer crash", {
                    error: error.toString(),
                    stack: error.stack,
                    componentStack: errorInfo?.componentStack
                });
            }
        } catch (logErr) {
            // Logger not available, already logged to console
            console.warn("Could not log to aesop logger:", logErr);
        }
    }

    handleReload = () => {
        window.location.reload();
    };

    handleReset = () => {
        this.setState({ hasError: false, error: null, errorInfo: null });
    };

    render() {
        if (this.state.hasError) {
            return (
                <div className="error-boundary">
                    <div className="error-boundary-content">
                        <h1>🚨 Something went wrong</h1>
                        <p className="error-subtitle">
                            AesopIDE encountered an unexpected error. Your work may be recoverable.
                        </p>

                        <div className="error-details">
                            <strong>Error:</strong>
                            <pre className="error-message">
                                {this.state.error?.toString() || "Unknown error"}
                            </pre>

                            {this.state.error?.stack && (
                                <>
                                    <strong>Stack trace:</strong>
                                    <pre className="error-stack">
                                        {this.state.error.stack}
                                    </pre>
                                </>
                            )}
                        </div>

                        <div className="error-actions">
                            <button
                                className="error-btn error-btn-primary"
                                onClick={this.handleReload}
                            >
                                🔄 Reload IDE
                            </button>
                            <button
                                className="error-btn error-btn-secondary"
                                onClick={this.handleReset}
                            >
                                ↩️ Try to Recover
                            </button>
                        </div>

                        <p className="error-hint">
                            If this error persists, check the developer console (Ctrl+Shift+I) for more details.
                        </p>
                    </div>
                </div>
            );
        }

        return this.props.children;
    }
}
