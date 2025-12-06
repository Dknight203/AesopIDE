// src/renderer/lib/search/liveSearch.js

/**
 * Phase 16: Live Web Search Utilities
 * Helper functions for Google Search Grounding integration
 */

/**
 * Determines if live search should be enabled based on the query characteristics
 * @param {string} query - The user's prompt/question
 * @param {Array} ragResults - Results from developer library query (if already searched)
 * @returns {boolean} - Whether to enable Google Search Grounding
 */
export function shouldEnableSearch(query, ragResults = []) {
    if (!query) return false;

    // Skip search if RAG already has high-confidence results
    if (ragResults && ragResults.length >= 3) {
        return false;
    }

    // Enable search for documentation queries
    const docPatterns = [
        /\b(how to|how do|what is|what are|explain|documentation|docs|api|reference)\b/i,
        /\b(latest|new|current|recent|update)\b.*\b(version|feature|release)\b/i,
        /\b(react|vue|angular|typescript|javascript|python|node)\b.*\d+/i, // Version queries
        /\b(best practice|pattern|approach|tutorial|guide)\b/i
    ];

    return docPatterns.some(pattern => pattern.test(query));
}

/**
 * Extracts grounding metadata from Gemini response
 * @param {Object} response - Gemini API response object
 * @returns {Object|null} - Grounding metadata or null if not present
 */
export function extractGroundingData(response) {
    if (!response || !response.groundingMetadata) {
        return null;
    }

    return {
        queries: response.groundingMetadata.webSearchQueries || [],
        searchEntryPoint: response.groundingMetadata.searchEntryPoint || null,
        groundingChunks: response.groundingMetadata.groundingChunks || []
    };
}

/**
 * Formats grounding citations for display to user
 * @param {Object} groundingMetadata - Grounding metadata from response
 * @returns {string} - Formatted citation text
 */
export function formatGroundingCitations(groundingMetadata) {
    if (!groundingMetadata || !groundingMetadata.queries || groundingMetadata.queries.length === 0) {
        return '';
    }

    const queries = groundingMetadata.queries;
    const citationText = queries.length === 1
        ? `🔍 Searched: "${queries[0]}"`
        : `🔍 Searched ${queries.length} queries`;

    return citationText;
}

/**
 * Checks if a topic already exists in RAG to avoid duplicate searches
 * @param {string} topic - The topic/query to check
 * @param {Function} queryRagFn - Function to query RAG (returns promise)
 * @returns {Promise<boolean>} - True if topic exists in RAG with good coverage
 */
export async function topicExistsInRag(topic, queryRagFn) {
    try {
        const results = await queryRagFn(topic);
        // Consider topic covered if we have 3+ relevant chunks
        return results && results.length >= 3;
    } catch (err) {
        console.warn('[liveSearch] Failed to check RAG for topic:', err);
        return false; // On error, default to enabling search
    }
}

/**
 * Auto-mode: Intelligently decides whether to enable search
 * Combines topic checking, query analysis, and RAG confidence
 * @param {string} query - User's question
 * @param {Function} queryRagFn - Function to query RAG
 * @returns {Promise<boolean>} - Whether to enable search
 */
export async function autoEnableSearch(query, queryRagFn) {
    // First, check if query warrants documentation search
    if (!shouldEnableSearch(query)) {
        return false;
    }

    // Then check if we already have this knowledge in RAG
    const topicExists = await topicExistsInRag(query, queryRagFn);

    // Enable search if topic is not well-covered in RAG
    return !topicExists;
}
