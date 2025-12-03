// src/renderer/lib/codebase/context.js
// Build multi-file context for AI

/**
 * Estimate token count for text (rough approximation)
 * @param {string} text - Text to count
 * @returns {number}
 */
function estimateTokens(text) {
    // Rough estimate: 1 token ≈ 4 characters
    return Math.ceil(text.length / 4);
}

/**
 * Build context from multiple files
 * @param {Array<{path: string, content?: string}>} files - Files to include
 * @param {number} maxTokens - Maximum tokens to include (default 30000)
 * @returns {Promise<string>}
 */
export async function buildContext(files, maxTokens = 30000) {
    const contextParts = [];
    let totalTokens = 0;

    for (const file of files) {
        // Read file content if not provided
        const content = file.content || await window.aesop.fs.readFile(file.path);

        // Format file section
        const fileSection = `
=== File: ${file.path} ===
${content}
=== End of ${file.path} ===
`;

        const tokens = estimateTokens(fileSection);

        // Check if adding this file would exceed token limit
        if (totalTokens + tokens > maxTokens) {
            // Try to include truncated version
            const remainingTokens = maxTokens - totalTokens;
            const truncatedContent = truncateContent(content, remainingTokens * 4);

            if (truncatedContent) {
                contextParts.push(`
=== File: ${file.path} (truncated) ===
${truncatedContent}
... [content truncated]
=== End of ${file.path} ===
`);
            }
            break;
        }

        contextParts.push(fileSection);
        totalTokens += tokens;
    }

    return contextParts.join('\n');
}

/**
 * Truncate content to fit within character limit
 * @param {string} content - Content to truncate
 * @param {number} maxChars - Maximum characters
 * @returns {string}
 */
function truncateContent(content, maxChars) {
    if (content.length <= maxChars) {
        return content;
    }

    // Try to truncate at a line boundary
    const lines = content.split('\n');
    let truncated = '';

    for (const line of lines) {
        if (truncated.length + line.length + 1 > maxChars) {
            break;
        }
        truncated += line + '\n';
    }

    return truncated || content.substring(0, maxChars);
}

/**
 * Build context for a specific file with related files
 * @param {string} filePath - Main file path
 * @param {FileMetadata[]} index - File index
 * @param {Object} options - Options
 * @returns {Promise<string>}
 */
export async function buildFileContext(filePath, index, options = {}) {
    const {
        includeImports = true,
        includeImporters = false,
        maxTokens = 30000,
    } = options;

    const files = [{ path: filePath }];

    // Add imported files
    if (includeImports) {
        try {
            const { findImports } = await import('./search.js');
            const imports = await findImports(filePath);

            // Add local imports (not node_modules)
            for (const imp of imports) {
                if (!imp.startsWith('.') && !imp.startsWith('/')) {
                    continue; // Skip node_modules
                }

                // Resolve relative import to absolute path
                const resolvedPath = resolveImport(filePath, imp, index);
                if (resolvedPath) {
                    files.push({ path: resolvedPath });
                }
            }
        } catch (err) {
            console.error('Error finding imports:', err);
        }
    }

    // Add files that import this file
    if (includeImporters) {
        try {
            const { findImporters } = await import('./search.js');
            const importers = await findImporters(filePath, index);

            for (const importer of importers.slice(0, 3)) { // Limit to 3 importers
                files.push({ path: importer });
            }
        } catch (err) {
            console.error('Error finding importers:', err);
        }
    }

    return buildContext(files, maxTokens);
}

/**
 * Resolve a relative import to an absolute path
 * @param {string} fromFile - File doing the importing
 * @param {string} importPath - Import path (e.g., './utils', '../components/Button')
 * @param {FileMetadata[]} index - File index
 * @returns {string|null}
 */
function resolveImport(fromFile, importPath, index) {
    // Get directory of importing file
    const fromDir = fromFile.split('/').slice(0, -1).join('/');

    // Resolve relative path
    let resolvedPath = importPath;
    if (importPath.startsWith('./')) {
        resolvedPath = `${fromDir}/${importPath.substring(2)}`;
    } else if (importPath.startsWith('../')) {
        const parts = fromDir.split('/');
        const upCount = (importPath.match(/\.\.\//g) || []).length;
        const remainingPath = importPath.replace(/\.\.\//g, '');
        resolvedPath = parts.slice(0, -upCount).join('/') + '/' + remainingPath;
    }

    // Try common extensions
    const extensions = ['', '.js', '.jsx', '.ts', '.tsx', '/index.js', '/index.jsx', '/index.ts', '/index.tsx'];

    for (const ext of extensions) {
        const testPath = resolvedPath + ext;
        const found = index.find(f => f.path === testPath);
        if (found) {
            return testPath;
        }
    }

    return null;
}

/**
 * Get context summary (file list with line counts)
 * @param {Array<{path: string}>} files - Files in context
 * @returns {Promise<string>}
 */
export async function getContextSummary(files) {
    const summary = ['Files in context:'];

    for (const file of files) {
        try {
            const content = file.content || await window.aesop.fs.readFile(file.path);
            const lineCount = content.split('\n').length;
            summary.push(`- ${file.path} (${lineCount} lines)`);
        } catch (err) {
            summary.push(`- ${file.path} (error reading)`);
        }
    }

    return summary.join('\n');
}
