// src/renderer/lib/ai/selfCorrection.js
// AI self-debugging loop that analyzes errors and attempts fixes using RAG

import { formatErrorsForAI } from '../tools/terminalBridge.js';

/**
 * Analyze parsed errors to extract error types, files, and line numbers
 * @param {Array} errors - Array of parsed error objects
 * @returns {Object} Analysis summary
 */
export function analyzeParsedErrors(errors) {
    if (!errors || errors.length === 0) {
        return {
            errorCount: 0,
            errorTypes: [],
            affectedFiles: [],
            summary: "No errors found"
        };
    }

    const errorTypes = new Set();
    const affectedFiles = new Set();
    const details = [];

    for (const error of errors) {
        // Extract error type (TypeScript, ESLint, etc.)
        const raw = error.raw || '';

        if (raw.includes('TS')) {
            errorTypes.add('TypeScript');
        } else if (raw.includes('error')) {
            errorTypes.add('ESLint');
        } else if (raw.includes('●')) {
            errorTypes.add('Jest');
        } else if (raw.includes('FAIL')) {
            errorTypes.add('Vitest');
        } else {
            errorTypes.add('Unknown');
        }

        // Try to extract file path from error groups
        if (error.groups && error.groups.length > 0) {
            const firstGroup = error.groups[0];
            if (typeof firstGroup === 'string' && firstGroup.includes('/')) {
                affectedFiles.add(firstGroup);
            }
        }

        details.push({
            type: Array.from(errorTypes)[errorTypes.size - 1],
            message: raw,
            groups: error.groups
        });
    }

    return {
        errorCount: errors.length,
        errorTypes: Array.from(errorTypes),
        affectedFiles: Array.from(affectedFiles),
        details,
        summary: `Found ${errors.length} error(s) of type(s): ${Array.from(errorTypes).join(', ')}`
    };
}

/**
 * Query RAG for debugging strategies based on error type
 * @param {string} errorType - Type of error (TypeScript, ESLint, Jest, etc.)
 * @param {string} errorMessage - Error message detail
 * @returns {Promise<string>} RAG context for debugging
 */
export async function queryRAGForDebugging(errorType, errorMessage) {
    try {
        console.log(`[SelfCorrection] Querying RAG for ${errorType} error debugging`);

        // Build query based on error type
        const query = `${errorType} error debugging: ${errorMessage}`;

        // Query RAG (developer library)
        const result = await window.aesop.rag.query(query, {
            topK: 3,
            category: 'debugging'
        });

        if (result && result.results && result.results.length > 0) {
            const context = result.results.map(r => r.content).join('\n\n');
            console.log(`[SelfCorrection] Found ${result.results.length} RAG results`);
            return context;
        } else {
            console.log(`[SelfCorrection] No RAG results found for error type: ${errorType}`);
            return '';
        }
    } catch (error) {
        console.error(`[SelfCorrection] RAG query failed:`, error);
        return '';
    }
}

/**
 * Generate fix attempt based on error analysis and RAG context
 * @param {Object} errorAnalysis - Error analysis from analyzeParsedErrors
 * @param {string} ragContext - RAG debugging context
 * @returns {Object} Fix attempt with suggested actions
 */
export function generateFixAttempt(errorAnalysis, ragContext) {
    const fix = {
        strategy: '',
        actions: [],
        reasoning: ''
    };

    // Determine fix strategy based on error type
    if (errorAnalysis.errorTypes.includes('TypeScript')) {
        fix.strategy = 'TypeScript Type Fix';
        fix.reasoning = 'TypeScript compilation errors detected. Will attempt to fix type issues.';
        fix.actions.push({
            type: 'prompt',
            message: `Fix the following TypeScript errors using the debugging context:\n\nErrors:\n${formatErrorsForAI(errorAnalysis.details)}\n\nDebugging Context from RAG:\n${ragContext}\n\nPlease fix the errors in the affected files.`
        });
    } else if (errorAnalysis.errorTypes.includes('ESLint')) {
        fix.strategy = 'ESLint Fix';
        fix.reasoning = 'ESLint errors detected. Will attempt to fix linting issues.';
        fix.actions.push({
            type: 'command',
            command: 'npx eslint --fix .',
            message: 'Running ESLint auto-fix'
        });
    } else if (errorAnalysis.errorTypes.includes('Jest') || errorAnalysis.errorTypes.includes('Vitest')) {
        fix.strategy = 'Test Fix';
        fix.reasoning = 'Test failures detected. Will analyze and fix failing tests.';
        fix.actions.push({
            type: 'prompt',
            message: `Fix the following test failures:\n\nErrors:\n${formatErrorsForAI(errorAnalysis.details)}\n\nDebugging Context:\n${ragContext}`
        });
    } else {
        fix.strategy = 'Generic Error Fix';
        fix.reasoning = 'Unknown error type. Will attempt general debugging.';
        fix.actions.push({
            type: 'prompt',
            message: `Debug and fix the following errors:\n\nErrors:\n${formatErrorsForAI(errorAnalysis.details)}\n\nContext:\n${ragContext}`
        });
    }

    return fix;
}

/**
 * Attempt self-correction loop for failed task
 * @param {Object} taskResult - Result from task execution with errors
 * @param {number} maxRetries - Maximum correction attempts (default: 3)
 * @param {Function} retryCallback - Function to call for retrying the task
 * @returns {Promise<Object>} Final result after correction attempts
 */
export async function attemptSelfCorrection(taskResult, maxRetries = 3, retryCallback = null) {
    console.log(`[SelfCorrection] Starting self-correction loop (max retries: ${maxRetries})`);

    if (!taskResult.parsedErrors || taskResult.parsedErrors.length === 0) {
        console.log(`[SelfCorrection] No parsed errors found, skipping self-correction`);
        return taskResult;
    }

    let currentResult = taskResult;
    let attempt = 0;

    while (attempt < maxRetries && currentResult.parsedErrors && currentResult.parsedErrors.length > 0) {
        attempt++;
        console.log(`[SelfCorrection] Attempt ${attempt}/${maxRetries}`);

        // Step 1: Analyze errors
        const analysis = analyzeParsedErrors(currentResult.parsedErrors);
        console.log(`[SelfCorrection] Error analysis:`, analysis.summary);

        // Step 2: Query RAG for each error type
        let ragContext = '';
        for (const errorType of analysis.errorTypes) {
            const firstError = analysis.details.find(d => d.type === errorType);
            if (firstError) {
                const context = await queryRAGForDebugging(errorType, firstError.message);
                ragContext += context + '\n\n';
            }
        }

        // Step 3: Generate fix attempt
        const fix = generateFixAttempt(analysis, ragContext);
        console.log(`[SelfCorrection] Fix strategy: ${fix.strategy}`);
        console.log(`[SelfCorrection] Reasoning: ${fix.reasoning}`);

        // Step 4: Execute fix actions
        for (const action of fix.actions) {
            if (action.type === 'prompt') {
                console.log(`[SelfCorrection] Would prompt AI with: ${action.message.substring(0, 100)}...`);
                // In real implementation, this would send the message to the AI
                // For now, we'll just log it and return for user review
            } else if (action.type === 'command') {
                console.log(`[SelfCorrection] Would execute command: ${action.command}`);
                // In real implementation, this would execute the command
            }
        }

        // Step 5: Retry if callback provided
        if (retryCallback) {
            console.log(`[SelfCorrection] Retrying task after fix attempt...`);
            currentResult = await retryCallback();

            if (currentResult.success) {
                console.log(`[SelfCorrection] Task succeeded after ${attempt} attempt(s)!`);
                return currentResult;
            }
        } else {
            // No retry callback, return fix suggestions
            console.log(`[SelfCorrection] No retry callback provided, returning fix suggestions`);
            return {
                ...currentResult,
                selfCorrectionAttempted: true,
                attempts: attempt,
                fixSuggestions: fix,
                errorAnalysis: analysis
            };
        }
    }

    // Max retries exceeded
    console.error(`[SelfCorrection] Max retries (${maxRetries}) exceeded, escalating to user`);
    return {
        ...currentResult,
        selfCorrectionFailed: true,
        attempts: attempt,
        errorAnalysis: analyzeParsedErrors(currentResult.parsedErrors),
        escalateToUser: true,
        escalationMessage: `Failed to auto-fix errors after ${attempt} attempts. User intervention required.`
    };
}

/**
 * Simple helper to create a self-correcting task wrapper
 * @param {Function} taskFunction - Async function that returns task result
 * @param {number} maxRetries - Maximum correction attempts
 * @returns {Promise<Object>} Final result
 */
export async function withSelfCorrection(taskFunction, maxRetries = 3) {
    const initialResult = await taskFunction();

    if (initialResult.success) {
        return initialResult;
    }

    return await attemptSelfCorrection(initialResult, maxRetries, taskFunction);
}
