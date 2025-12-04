// src/renderer/components/IngestModal.jsx
import React, { useState } from 'react';
import '../styles/ingestmodal.css';

export default function IngestModal({ onClose, onIngest }) {
    const [inputType, setInputType] = useState('url'); // 'url' or 'file'
    const [urlInput, setUrlInput] = useState('');
    const [fileContent, setFileContent] = useState('');
    const [fileName, setFileName] = useState('');
    const [isProcessing, setIsProcessing] = useState(false);
    const [statusMessage, setStatusMessage] = useState('');

    async function handleUrlFetch() {
        if (!urlInput.trim()) {
            setStatusMessage('Please enter a URL');
            return;
        }

        setIsProcessing(true);
        setStatusMessage('Fetching content...');

        try {
            // Fetch the URL content via Backend (Bypasses CORS)
            const result = await window.aesop.ingestion.fetchUrl(urlInput);
            
            if (!result.ok) {
                throw new Error(result.error || 'Failed to fetch URL');
            }
            const { content: rawContent, contentType } = result;
            let content;
            
            if (contentType?.includes('application/json')) {
                // Since the backend handler returns raw text content, we must parse the JSON string here.
                try {
                    const json = JSON.parse(rawContent);
                    content = JSON.stringify(json, null, 2);
                } catch (e) {
                    // If parsing fails, use the raw content
                    content = rawContent;
                }
            } else {
                // rawContent is already the text/html string

                // If it's HTML, extract text content only (strip tags)
                if (contentType?.includes('text/html') || rawContent.trim().startsWith('<!DOCTYPE') || rawContent.trim().startsWith('<html')) {
                    setStatusMessage('Extracting text from HTML...');

                    // Use DOMParser to extract text from HTML
                    const parser = new DOMParser();
                    const doc = parser.parseFromString(rawContent, 'text/html');

                    // Remove script and style elements
                    doc.querySelectorAll('script, style, noscript').forEach(el => el.remove());

                    // Get text content
                    content = doc.body.textContent || doc.body.innerText || '';

                    // Clean up whitespace
                    // 1. Replace multiple spaces/tabs with a single space (but keep newlines)
                    content = content.replace(/[ \t]+/g, ' ');

                    // 2. Replace multiple newlines with a double newline (paragraph break)
                    content = content.replace(/\n\s*\n/g, '\n\n');

                    // 3. Trim
                    content = content.trim();

                    if (!content) {
                        throw new Error('No text content found in HTML');
                    }
                } else {
                    content = rawContent;
                }
            }

            // Call the ingestion handler
            const ingestResult = await window.aesop.ingestion.document(content, urlInput);

            if (ingestResult.ok) {
                setStatusMessage(ingestResult.message || 'Document ingested successfully!');
                setTimeout(() => {
                    onIngest && onIngest(ingestResult);
                    onClose();
                }, 1500);
            } else {
                setStatusMessage(`Error: ${ingestResult.error}`);
            }
        } catch (err) {
            console.error('URL fetch error:', err);
            setStatusMessage(`Failed to fetch URL: ${err.message}`);
        } finally {
            setIsProcessing(false);
        }
    }

    function handleFileChange(e) {
        const file = e.target.files?.[0];
        if (!file) return;

        setFileName(file.name);
        setStatusMessage('Reading file...');

        const reader = new FileReader();
        reader.onload = (event) => {
            setFileContent(event.target.result);
            setStatusMessage(`File loaded: ${file.name}`);
        };
        reader.onerror = () => {
            setStatusMessage('Error reading file');
        };
        reader.readAsText(file);
    }

    async function handleFileIngest() {
        if (!fileContent) {
            setStatusMessage('Please select a file first');
            return;
        }

        setIsProcessing(true);
        setStatusMessage('Ingesting document...');

        try {
            const result = await window.aesop.ingestion.document(fileContent, fileName);

            if (result.ok) {
                setStatusMessage(result.message || 'Document ingested successfully!');
                setTimeout(() => {
                    onIngest && onIngest(result);
                    onClose();
                }, 1500);
            } else {
                setStatusMessage(`Error: ${result.error}`);
            }
        } catch (err) {
            console.error('File ingestion error:', err);
            setStatusMessage(`Failed to ingest: ${err.message}`);
        } finally {
            setIsProcessing(false);
        }
    }

    return (
        <div className="modal-overlay" onClick={onClose}>
            <div className="ingest-modal" onClick={(e) => e.stopPropagation()}>
                <div className="ingest-modal-header">
                    <h2>📚 Ingest Document</h2>
                    <button className="close-btn" onClick={onClose} title="Close">✕</button>
                </div>

                <div className="ingest-modal-body">
                    {/* Tab Selection */}
                    <div className="input-type-tabs">
                        <button
                            className={`tab ${inputType === 'url' ? 'active' : ''}`}
                            onClick={() => setInputType('url')}
                        >
                            🔗 URL
                        </button>
                        <button
                            className={`tab ${inputType === 'file' ? 'active' : ''}`}
                            onClick={() => setInputType('file')}
                        >
                            📄 File
                        </button>
                    </div>

                    {/* URL Input */}
                    {inputType === 'url' && (
                        <div className="input-section">
                            <label>Enter URL to documentation or article:</label>
                            <input
                                type="text"
                                placeholder="https://docs.example.com/api-guide"
                                value={urlInput}
                                onChange={(e) => setUrlInput(e.target.value)}
                                onKeyDown={(e) => e.key === 'Enter' && handleUrlFetch()}
                                disabled={isProcessing}
                            />
                            <button
                                className="ingest-btn"
                                onClick={handleUrlFetch}
                                disabled={isProcessing || !urlInput.trim()}
                            >
                                {isProcessing ? '⏳ Fetching...' : 'Fetch & Ingest'}
                            </button>
                        </div>
                    )}

                    {/* File Upload */}
                    {inputType === 'file' && (
                        <div className="input-section">
                            <label>Upload a file (.txt, .md, .json):</label>
                            <input
                                type="file"
                                accept=".txt,.md,.json,.markdown"
                                onChange={handleFileChange}
                                disabled={isProcessing}
                            />
                            {fileName && (
                                <div className="file-info">
                                    Selected: <strong>{fileName}</strong>
                                </div>
                            )}
                            <button
                                className="ingest-btn"
                                onClick={handleFileIngest}
                                disabled={isProcessing || !fileContent}
                            >
                                {isProcessing ? '⏳ Ingesting...' : 'Ingest File'}
                            </button>
                        </div>
                    )}

                    {/* Status Message */}
                    {statusMessage && (
                        <div className={`status-message ${statusMessage.startsWith('Error') ? 'error' : ''}`}>
                            {statusMessage}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}