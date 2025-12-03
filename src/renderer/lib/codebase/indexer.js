// src/renderer/lib/codebase/indexer.js
// Scans and indexes the project codebase for AI context

/**
 * File metadata structure
 * @typedef {Object} FileMetadata
 * @property {string} path - Relative path from project root
 * @property {string} name - File name
 * @property {string} extension - File extension
 * @property {number} size - File size in bytes
 * @property {boolean} isDirectory - Whether this is a directory
 * @property {number} depth - Depth in file tree (0 = root)
 */

// Patterns to ignore when indexing
const IGNORE_PATTERNS = [
    /^\.git$/,
    /^node_modules$/,
    /^\.next$/,
    /^dist$/,
    /^build$/,
    /^coverage$/,
    /^\.cache$/,
    /^\.vscode$/,
    /^\.idea$/,
    /\.log$/,
    /^package-lock\.json$/,
    /^yarn\.lock$/,
];

/**
 * Check if a file/directory should be ignored
 * @param {string} name - File or directory name
 * @returns {boolean}
 */
function shouldIgnore(name) {
    return IGNORE_PATTERNS.some(pattern => pattern.test(name));
}

/**
 * Scan a directory and build file index
 * @param {string} rootPath - Absolute path to project root
 * @returns {Promise<FileMetadata[]>}
 */
export async function scanProject(rootPath) {
    const index = [];

    async function scanDirectory(relativePath = ".", depth = 0) {
        try {
            // Use the IPC handler to read directory
            const entries = await window.aesop.fs.readDir(relativePath);

            for (const entry of entries) {
                // Skip ignored files/directories
                if (shouldIgnore(entry.name)) {
                    continue;
                }

                const metadata = {
                    path: entry.path,
                    name: entry.name,
                    extension: entry.name.includes('.')
                        ? entry.name.split('.').pop()
                        : '',
                    isDirectory: entry.isDirectory,
                    depth,
                };

                index.push(metadata);

                // Recursively scan subdirectories (max depth 10)
                if (entry.isDirectory && depth < 10) {
                    await scanDirectory(entry.path, depth + 1);
                }
            }
        } catch (err) {
            console.error(`Error scanning directory ${relativePath}:`, err);
        }
    }

    await scanDirectory();
    return index;
}

/**
 * Filter index by file extension
 * @param {FileMetadata[]} index - File index
 * @param {string[]} extensions - Extensions to include (e.g., ['js', 'jsx', 'ts', 'tsx'])
 * @returns {FileMetadata[]}
 */
export function filterByExtension(index, extensions) {
    const extSet = new Set(extensions.map(ext => ext.toLowerCase()));
    return index.filter(file =>
        !file.isDirectory && extSet.has(file.extension.toLowerCase())
    );
}

/**
 * Find files matching a pattern
 * @param {FileMetadata[]} index - File index
 * @param {string} pattern - Search pattern (supports wildcards)
 * @returns {FileMetadata[]}
 */
export function findFiles(index, pattern) {
    const regex = new RegExp(
        pattern
            .replace(/\./g, '\\.')
            .replace(/\*/g, '.*')
            .replace(/\?/g, '.'),
        'i'
    );

    return index.filter(file => regex.test(file.path) || regex.test(file.name));
}

/**
 * Get statistics about the codebase
 * @param {FileMetadata[]} index - File index
 * @returns {Object}
 */
export function getStats(index) {
    const files = index.filter(f => !f.isDirectory);
    const directories = index.filter(f => f.isDirectory);

    const byExtension = {};
    files.forEach(file => {
        const ext = file.extension || 'no-extension';
        byExtension[ext] = (byExtension[ext] || 0) + 1;
    });

    return {
        totalFiles: files.length,
        totalDirectories: directories.length,
        byExtension,
        maxDepth: Math.max(...index.map(f => f.depth), 0),
    };
}
