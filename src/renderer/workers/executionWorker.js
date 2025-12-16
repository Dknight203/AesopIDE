// src/renderer/workers/executionWorker.js
// Web Worker for heavy computation without blocking main thread

/**
 * Execution Worker - Offloads heavy computation to background thread
 * 
 * Capabilities:
 * - Execute tool chains without blocking UI
 * - Handle large file parsing/processing
 * - Perform vector similarity calculations
 * - Process large datasets
 */

// Worker state
let isProcessing = false;
let currentTask = null;

// Message handler
self.onmessage = async function (e) {
    const { type, payload, taskId } = e.data;

    try {
        switch (type) {
            case 'EXECUTE_TOOL_CHAIN':
                await executeToolChain(payload, taskId);
                break;

            case 'PARSE_LARGE_FILE':
                await parseLargeFile(payload, taskId);
                break;

            case 'VECTOR_SIMILARITY':
                await calculateVectorSimilarity(payload, taskId);
                break;

            case 'PROCESS_DATASET':
                await processDataset(payload, taskId);
                break;

            case 'CANCEL_TASK':
                cancelCurrentTask(taskId);
                break;

            default:
                self.postMessage({
                    type: 'ERROR',
                    taskId,
                    error: `Unknown task type: ${type}`
                });
        }
    } catch (error) {
        self.postMessage({
            type: 'ERROR',
            taskId,
            error: error.message,
            stack: error.stack
        });
    }
};

/**
 * Execute a chain of tools sequentially
 * @param {Object} payload - Tool chain configuration
 * @param {string} taskId - Task identifier
 */
async function executeToolChain(payload, taskId) {
    const { tools, context } = payload;
    isProcessing = true;
    currentTask = taskId;

    const results = [];

    self.postMessage({
        type: 'PROGRESS',
        taskId,
        step: 0,
        total: tools.length,
        message: 'Starting tool chain execution'
    });

    for (let i = 0; i < tools.length; i++) {
        if (currentTask !== taskId) {
            // Task was cancelled
            self.postMessage({
                type: 'CANCELLED',
                taskId,
                message: 'Tool chain execution cancelled by user'
            });
            return;
        }

        const tool = tools[i];

        self.postMessage({
            type: 'PROGRESS',
            taskId,
            step: i + 1,
            total: tools.length,
            message: `Executing: ${tool.name}`
        });

        try {
            // Simulate tool execution (in real implementation, this would use IPC)
            const result = await executeTool(tool, context);
            results.push({
                tool: tool.name,
                success: true,
                result
            });
        } catch (error) {
            results.push({
                tool: tool.name,
                success: false,
                error: error.message
            });

            // Stop on error unless configured to continue
            if (!payload.continueOnError) {
                break;
            }
        }
    }

    isProcessing = false;
    currentTask = null;

    self.postMessage({
        type: 'COMPLETE',
        taskId,
        results
    });
}

/**
 * Parse large files in chunks to avoid memory issues
 * @param {Object} payload - File parsing configuration
 * @param {string} taskId - Task identifier
 */
async function parseLargeFile(payload, taskId) {
    const { content, chunkSize = 1000000 } = payload; // 1MB chunks
    isProcessing = true;
    currentTask = taskId;

    const totalChunks = Math.ceil(content.length / chunkSize);
    const parsedData = [];

    for (let i = 0; i < totalChunks; i++) {
        if (currentTask !== taskId) {
            self.postMessage({ type: 'CANCELLED', taskId });
            return;
        }

        const start = i * chunkSize;
        const end = Math.min(start + chunkSize, content.length);
        const chunk = content.substring(start, end);

        // Parse chunk (JSON, AST, etc.)
        try {
            const parsed = JSON.parse(chunk);
            parsedData.push(parsed);
        } catch (error) {
            // Handle non-JSON data
            parsedData.push({ raw: chunk });
        }

        self.postMessage({
            type: 'PROGRESS',
            taskId,
            step: i + 1,
            total: totalChunks,
            message: `Parsing chunk ${i + 1}/${totalChunks}`
        });
    }

    isProcessing = false;
    currentTask = null;

    self.postMessage({
        type: 'COMPLETE',
        taskId,
        result: parsedData
    });
}

/**
 * Calculate vector similarity for RAG operations
 * @param {Object} payload - Vector calculation configuration
 * @param {string} taskId - Task identifier
 */
async function calculateVectorSimilarity(payload, taskId) {
    const { queryVector, documentVectors, topK = 5 } = payload;
    isProcessing = true;
    currentTask = taskId;

    const similarities = [];

    for (let i = 0; i < documentVectors.length; i++) {
        if (currentTask !== taskId) {
            self.postMessage({ type: 'CANCELLED', taskId });
            return;
        }

        const docVector = documentVectors[i];
        const similarity = cosineSimilarity(queryVector, docVector.vector);

        similarities.push({
            id: docVector.id,
            similarity,
            metadata: docVector.metadata
        });

        if (i % 100 === 0) {
            self.postMessage({
                type: 'PROGRESS',
                taskId,
                step: i,
                total: documentVectors.length,
                message: `Calculated ${i}/${documentVectors.length} similarities`
            });
        }
    }

    // Sort and get top K
    similarities.sort((a, b) => b.similarity - a.similarity);
    const topResults = similarities.slice(0, topK);

    isProcessing = false;
    currentTask = null;

    self.postMessage({
        type: 'COMPLETE',
        taskId,
        result: topResults
    });
}

/**
 * Process large datasets with transformations
 * @param {Object} payload - Dataset processing configuration
 * @param {string} taskId - Task identifier
 */
async function processDataset(payload, taskId) {
    const { data, operations } = payload;
    isProcessing = true;
    currentTask = taskId;

    let processedData = data;

    for (let i = 0; i < operations.length; i++) {
        if (currentTask !== taskId) {
            self.postMessage({ type: 'CANCELLED', taskId });
            return;
        }

        const operation = operations[i];

        self.postMessage({
            type: 'PROGRESS',
            taskId,
            step: i + 1,
            total: operations.length,
            message: `Applying operation: ${operation.type}`
        });

        processedData = await applyOperation(processedData, operation);
    }

    isProcessing = false;
    currentTask = null;

    self.postMessage({
        type: 'COMPLETE',
        taskId,
        result: processedData
    });
}

/**
 * Cancel the currently running task
 * @param {string} taskId - Task identifier to cancel
 */
function cancelCurrentTask(taskId) {
    if (currentTask === taskId) {
        currentTask = null;
        isProcessing = false;

        self.postMessage({
            type: 'CANCELLED',
            taskId,
            message: 'Task cancelled successfully'
        });
    }
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Execute a single tool (stub - in real implementation, use IPC to main thread)
 * @param {Object} tool - Tool configuration
 * @param {Object} context - Execution context
 */
async function executeTool(tool, context) {
    // Simulate processing time
    await sleep(100);

    return {
        tool: tool.name,
        params: tool.params,
        context,
        timestamp: Date.now()
    };
}

/**
 * Calculate cosine similarity between two vectors
 * @param {number[]} vecA - First vector
 * @param {number[]} vecB - Second vector
 * @returns {number} Similarity score (0-1)
 */
function cosineSimilarity(vecA, vecB) {
    if (vecA.length !== vecB.length) {
        throw new Error('Vectors must have same dimension');
    }

    let dotProduct = 0;
    let normA = 0;
    let normB = 0;

    for (let i = 0; i < vecA.length; i++) {
        dotProduct += vecA[i] * vecB[i];
        normA += vecA[i] * vecA[i];
        normB += vecB[i] * vecB[i];
    }

    normA = Math.sqrt(normA);
    normB = Math.sqrt(normB);

    if (normA === 0 || normB === 0) {
        return 0;
    }

    return dotProduct / (normA * normB);
}

/**
 * Apply a data operation to a dataset
 * @param {any[]} data - Dataset
 * @param {Object} operation - Operation configuration
 * @returns {any[]} Transformed data
 */
async function applyOperation(data, operation) {
    switch (operation.type) {
        case 'FILTER':
            return data.filter(operation.predicate);

        case 'MAP':
            return data.map(operation.transform);

        case 'REDUCE':
            return data.reduce(operation.reducer, operation.initial);

        case 'SORT':
            return [...data].sort(operation.comparator);

        case 'CHUNK':
            const chunkSize = operation.size || 100;
            const chunks = [];
            for (let i = 0; i < data.length; i += chunkSize) {
                chunks.push(data.slice(i, i + chunkSize));
            }
            return chunks;

        default:
            throw new Error(`Unknown operation type: ${operation.type}`);
    }
}

/**
 * Sleep utility
 * @param {number} ms - Milliseconds to sleep
 */
function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

// Worker ready
self.postMessage({
    type: 'READY',
    message: 'Execution Worker initialized and ready'
});
