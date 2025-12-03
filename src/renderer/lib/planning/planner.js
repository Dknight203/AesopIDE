// src/renderer/lib/planning/planner.js

/**
 * Planning Mode System
 * Allows AI to create implementation plans and request user approval
 */

/**
 * Create an implementation plan
 * @param {string} projectPath - Path to project root
 * @param {Object} planData - Plan structure
 * @returns {Promise<string>} Path to created plan file
 */
export async function createPlan(projectPath, planData) {
    const { title, description, changes, verification, risks } = planData;

    let markdown = `# ${title}\n\n`;

    if (description) {
        markdown += `## Overview\n${description}\n\n`;
    }

    // User Review Required section
    if (planData.reviewRequired && planData.reviewRequired.length > 0) {
        markdown += `## User Review Required\n\n`;
        for (const item of planData.reviewRequired) {
            markdown += `> [!${item.level || 'IMPORTANT'}]\n`;
            markdown += `> ${item.message}\n\n`;
        }
    }

    // Proposed Changes
    if (changes && changes.length > 0) {
        markdown += `## Proposed Changes\n\n`;

        for (const component of changes) {
            markdown += `### ${component.name}\n\n`;
            if (component.description) {
                markdown += `${component.description}\n\n`;
            }

            for (const file of component.files || []) {
                const action = file.action || 'MODIFY';
                markdown += `#### [${action}] ${file.path}\n`;
                if (file.description) {
                    markdown += `${file.description}\n`;
                }
                markdown += '\n';
            }

            markdown += '---\n\n';
        }
    }

    // Verification Plan
    if (verification) {
        markdown += `## Verification Plan\n\n`;

        if (verification.automated && verification.automated.length > 0) {
            markdown += `### Automated Tests\n`;
            for (const test of verification.automated) {
                markdown += `- ${test}\n`;
            }
            markdown += '\n';
        }

        if (verification.manual && verification.manual.length > 0) {
            markdown += `### Manual Verification\n`;
            for (const step of verification.manual) {
                markdown += `- ${step}\n`;
            }
            markdown += '\n';
        }
    }

    // Risks
    if (risks && risks.length > 0) {
        markdown += `## Risks & Mitigations\n\n`;
        for (const risk of risks) {
            markdown += `**${risk.title}**\n`;
            markdown += `- Risk: ${risk.description}\n`;
            markdown += `- Mitigation: ${risk.mitigation}\n\n`;
        }
    }

    // Approval status
    markdown += `---\n\n`;
    markdown += `**Status**: Pending Approval\n`;
    markdown += `**Created**: ${new Date().toISOString()}\n`;

    // Write to .aesop/implementation_plan.md
    const planPath = `${projectPath}/.aesop/implementation_plan.md`;

    try {
        await window.aesop.fs.mkdir(`${projectPath}/.aesop`);
    } catch (err) {
        // Directory might already exist
    }

    await window.aesop.fs.writeFile(planPath, markdown);
    return planPath;
}

/**
 * Read existing implementation plan
 * @param {string} projectPath - Path to project root
 * @returns {Promise<Object|null>} Plan data or null if not found
 */
export async function readPlan(projectPath) {
    const planPath = `${projectPath}/.aesop/implementation_plan.md`;
    try {
        const content = await window.aesop.fs.readFile(planPath);

        // Parse status from content
        const statusMatch = content.match(/\*\*Status\*\*:\s*(.+)/);
        const status = statusMatch ? statusMatch[1].trim() : 'Unknown';

        return {
            content,
            status,
            path: planPath
        };
    } catch (err) {
        return null;
    }
}

/**
 * Update plan status
 * @param {string} projectPath - Path to project root
 * @param {string} newStatus - New status (e.g., 'Approved', 'Rejected', 'In Progress')
 * @returns {Promise<boolean>} Success status
 */
export async function updatePlanStatus(projectPath, newStatus) {
    const plan = await readPlan(projectPath);
    if (!plan) return false;

    const updatedContent = plan.content.replace(
        /\*\*Status\*\*:\s*.+/,
        `**Status**: ${newStatus}`
    );

    await window.aesop.fs.writeFile(plan.path, updatedContent);
    return true;
}

/**
 * Approve the current plan
 * @param {string} projectPath - Path to project root
 * @returns {Promise<boolean>} Success status
 */
export async function approvePlan(projectPath) {
    return await updatePlanStatus(projectPath, 'Approved ✅');
}

/**
 * Reject the current plan
 * @param {string} projectPath - Path to project root
 * @param {string} reason - Rejection reason
 * @returns {Promise<boolean>} Success status
 */
export async function rejectPlan(projectPath, reason) {
    const plan = await readPlan(projectPath);
    if (!plan) return false;

    const updatedContent = plan.content.replace(
        /\*\*Status\*\*:\s*.+/,
        `**Status**: Rejected ❌\n**Reason**: ${reason}`
    );

    await window.aesop.fs.writeFile(plan.path, updatedContent);
    return true;
}

/**
 * Check if there's a pending plan
 * @param {string} projectPath - Path to project root
 * @returns {Promise<boolean>} True if plan exists and is pending
 */
export async function hasPendingPlan(projectPath) {
    const plan = await readPlan(projectPath);
    return plan && plan.status.includes('Pending');
}

/**
 * Delete the current plan
 * @param {string} projectPath - Path to project root
 * @returns {Promise<boolean>} Success status
 */
export async function deletePlan(projectPath) {
    const planPath = `${projectPath}/.aesop/implementation_plan.md`;
    try {
        // Note: We don't have a delete file API yet, so we'll just overwrite with empty
        await window.aesop.fs.writeFile(planPath, '');
        return true;
    } catch (err) {
        return false;
    }
}
