// src/renderer/lib/codebase/search.js
// Code search functionality for AI context

/**
 * Search for text across all files in the index
 * @param {string} query - Search query
 * @param {FileMetadata[]} index - File index from indexer
 * @param {Object} options - Search options
 * @returns {Promise<SearchResult[]>}
 */
export async function searchCode(query, index, options = {}) {
    const {
        caseSensitive = false,
        fileExtensions = null, // null = all files, or array like ['js', 'jsx', 'ts', 'tsx']
        maxResults = 100,
    } = options;

    const results = [];

    // Filter files by extension if specified
    let filesToSearch = index.filter(f => !f.isDirectory);
    if (fileExtensions) {
        const extSet = new Set(fileExtensions.map(e => e.toLowerCase()));
        filesToSearch = filesToSearch.filter(f =>
            extSet.has(f.extension.toLowerCase())
        );
    }

    // Search each file
    for (const file of filesToSearch) {
        if (results.length >= maxResults) break;

        try {
            const content = await window.aesop.fs.readFile(file.path);
            const lines = content.split('\n');

            // Search each line
            for (let i = 0; i < lines.length; i++) {
                const line = lines[i];
                const searchLine = caseSensitive ? line : line.toLowerCase();
                const searchQuery = caseSensitive ? query : query.toLowerCase();

                if (searchLine.includes(searchQuery)) {
                    results.push({
                        file: file.path,
                        line: i + 1,
                        content: line.trim(),
                        context: getLineContext(lines, i, 2),
                    });

                    if (results.length >= maxResults) break;
                }
            }
        } catch (err) {
            // Skip files that can't be read (binary files, etc.)
            console.debug(`Skipping file ${file.path}:`, err.message);
        }
    }

    return results;
}

/**
 * Get context lines around a match
 * @param {string[]} lines - All lines in file
 * @param {number} lineIndex - Index of matching line
 * @param {number} contextSize - Number of lines before/after to include
 * @returns {Object}
 */
function getLineContext(lines, lineIndex, contextSize) {
    const start = Math.max(0, lineIndex - contextSize);
    const end = Math.min(lines.length, lineIndex + contextSize + 1);

    return {
        before: lines.slice(start, lineIndex).map(l => l.trim()),
        after: lines.slice(lineIndex + 1, end).map(l => l.trim()),
    };
}

/**
 * Search for files by name pattern
 * @param {string} pattern - File name pattern (supports wildcards)
 * @param {FileMetadata[]} index - File index
 * @returns {FileMetadata[]}
 */
export function findFilesByName(pattern, index) {
    const regex = new RegExp(
        pattern
            .replace(/\./g, '\\.')
            .replace(/\*/g, '.*')
            .replace(/\?/g, '.'),
        'i'
    );

    return index
        .filter(file => !file.isDirectory)
        .filter(file => regex.test(file.name) || regex.test(file.path))
        .slice(0, 50); // Limit results
}

/**
 * Find files that import/require a specific file
 * @param {string} targetFile - File to find references to
 * @param {FileMetadata[]} index - File index
 * @returns {Promise<string[]>}
 */
export async function findImporters(targetFile, index) {
    const importers = [];
    const targetName = targetFile.split('/').pop().replace(/\.(js|jsx|ts|tsx)$/, '');

    // Only search code files
    const codeFiles = index.filter(f =>
        !f.isDirectory &&
        /\.(js|jsx|ts|tsx)$/.test(f.extension)
    );

    for (const file of codeFiles) {
        try {
            const content = await window.aesop.fs.readFile(file.path);

            // Check for import/require statements
            const importRegex = new RegExp(
                `(import|require).*['"\`].*${targetName}.*['"\`]`,
                'i'
            );

            if (importRegex.test(content)) {
                importers.push(file.path);
            }
        } catch (err) {
            // Skip files that can't be read
        }
    }

    return importers;
}

/**
 * Find files imported by a specific file
 * @param {string} sourceFile - File to analyze
 * @returns {Promise<string[]>}
 */
export async function findImports(sourceFile) {
    try {
        const content = await window.aesop.fs.readFile(sourceFile);
        const imports = [];

        // Match ES6 imports
        const es6ImportRegex = /import\s+.*\s+from\s+['"`]([^'"`]+)['"`]/g;
        let match;
        while ((match = es6ImportRegex.exec(content)) !== null) {
            imports.push(match[1]);
        }

        // Match require statements
        const requireRegex = /require\s*\(\s*['"`]([^'"`]+)['"`]\s*\)/g;
        while ((match = requireRegex.exec(content)) !== null) {
            imports.push(match[1]);
        }

        return imports;
    } catch (err) {
        console.error(`Error reading file ${sourceFile}:`, err);
        return [];
    }
}
