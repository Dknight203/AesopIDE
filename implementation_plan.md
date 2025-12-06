# AesopIDE Comprehensive Implementation Plan

**Goal:** Build a fully autonomous AI coding agent (inspired by Cline) capable of completing DualPilot development, leveraging byLLM/RAG infrastructure for intelligent context retrieval.

---

## Current Status

**Completed Phases:**
- ✅ Phase 2: Core File Tools
- ✅ Phase 3.1-3.4: Task/Plan Management, Multi-Step Execution
- ✅ Phase 4.2: Project & Global Memory
- ✅ Phase 5.1-5.3: Git Diff/Patch, Testing, Linting
- ✅ Phase 6.1-6.2: **RAG Infrastructure** (Document Ingestion & Developer Library Query)
- ✅ Phase 6.4: Agent Orchestration UI (`AgentManager.jsx` with task queue)
- ✅ Phase 6.5: Rich Artifacts (`Mermaid.jsx`, markdown rendering)
- ✅ Phase 7: Asynchronous Task Management (`TaskQueue` with priorities, dependencies)

**Pending Phases (Planned Enhancements):**
- � Phase 7.5: Electron Best Practices (ErrorBoundary, IPC Schema, Workspace State)
- 📋 Phase 8: Monaco Editor + VSCode Task Runner + Terminal Bridge
- 📋 Phase 9: Automated Plan Execution
- 📋 Phase 10: Supabase/Cloud Context Ingestion
- 📋 Phase 11: Architectural Guardrails
- 📋 Phase 12: Visual QA/UX Testing
- 📋 Phase 13: Artifact Generation & Display
- 📋 Phase 14: Autonomous Test Integration
- 📋 Phase 16: Live Web Search & Auto-Ingestion
- 📋 Phase 17: Extension System + MCP + Checkpoints

---

## Phase 7.5: Electron Best Practices (Pending)
**Status:** 📋 Planned - Not yet implemented

### Overview
Apply production-ready patterns from electron-react-boilerplate for stability and maintainability.

### Proposed Changes

#### [NEW] [src/renderer/components/ErrorBoundary.jsx](file:///c:/DevApps/AesopIDE/src/renderer/components/ErrorBoundary.jsx)
React error boundary for crash protection:
- Catch and display React errors gracefully
- Log errors to console and file
- Provide reload button for recovery
- Prevent full IDE crashes from component errors

```javascript
export default class ErrorBoundary extends React.Component {
    state = { hasError: false, error: null };
    
    static getDerivedStateFromError(error) {
        return { hasError: true, error };
    }
    
    componentDidCatch(error, errorInfo) {
        console.error('React Error:', error, errorInfo);
        window.aesop.logger?.error('Renderer crash', { error, errorInfo });
    }
    
    render() {
        if (this.state.hasError) {
            return (
                <div className="error-boundary">
                    <h1>🚨 Something went wrong</h1>
                    <pre>{this.state.error?.toString()}</pre>
                    <button onClick={() => window.location.reload()}>
                        Reload IDE
                    </button>
                </div>
            );
        }
        return this.props.children;
    }
}
```

#### [MODIFY] [src/renderer/index.jsx](file:///c:/DevApps/AesopIDE/src/renderer/index.jsx)
Wrap App with ErrorBoundary:
```javascript
import ErrorBoundary from './components/ErrorBoundary';

root.render(
  <ErrorBoundary>
    <App />
  </ErrorBoundary>
);
```

#### [NEW] [preload/ipcSchema.js](file:///c:/DevApps/AesopIDE/preload/ipcSchema.js)
IPC channel validation schema:
- Define all IPC channels in one place
- Prevent typos in channel names
- Document IPC API surface
- Enable type-safe IPC calls

```javascript
export const IPC_CHANNELS = {
  FS_READ: 'fs:read',
  FS_WRITE: 'fs:write',
  PROMPT_SEND: 'prompt:send',
  RAG_QUERY: 'rag:query',
  TERMINAL_EXEC: 'terminal:exec',
  GIT_STATUS: 'git:status'
};

export function validateChannel(channel) {
  if (!Object.values(IPC_CHANNELS).includes(channel)) {
    throw new Error(`Invalid IPC channel: ${channel}`);
  }
}
```

#### [NEW] [src/renderer/lib/workspace/state.js](file:///c:/DevApps/AesopIDE/src/renderer/lib/workspace/state.js)
Workspace state persistence (inspired by VSCode memento):
- Save/restore open tabs across sessions
- Persist panel sizes and layout
- Remember scroll positions
- Store expanded folder states

```javascript
export class WorkspaceState {
    constructor(projectPath) {
        this.stateFile = `${projectPath}/.aesop/workspace.json`;
    }

    async save(state) {
        await window.aesop.fs.writeFile(
            this.stateFile,
            JSON.stringify(state, null, 2)
        );
    }

    async load() {
        try {
            const content = await window.aesop.fs.readFile(this.stateFile);
            return JSON.parse(content);
        } catch {
            return {
                openTabs: [],
                activeTab: null,
                sidebarWidth: 250,
                terminalHeight: 200
            };
        }
    }
}
```

#### [MODIFY] [src/renderer/App.jsx](file:///c:/DevApps/AesopIDE/src/renderer/App.jsx)
Integrate workspace state persistence:
- Load workspace state on mount
- Auto-save state every 5 seconds
- Restore tabs, layout, and scroll positions

### Verification Plan

#### Manual Verification
1. **Error Boundary**: Throw test error in component, verify boundary catches it
2. **Workspace State**: Open files, resize panels, close IDE, reopen - verify state restored
3. **IPC Schema**: Check console for validation errors on startup

---

## Phase 7: Asynchronous Task Management
**byLLM Integration:** ✅ Uses RAG to query task orchestration best practices

### Overview
Enable parallel agent workflows without UI blocking, inspired by Cline's task execution architecture.

### User Review Required

> [!IMPORTANT]
> This implements concurrent task execution which may increase API costs significantly. Multiple agents running simultaneously will make parallel API calls.

> [!WARNING]
> Web Workers will run in separate threads - debugging may be more complex. Ensure proper error handling and logging.

### Proposed Changes

#### [NEW] [src/renderer/lib/tasks/taskQueue.js](file:///c:/DevApps/AesopIDE/src/renderer/lib/tasks/taskQueue.js)
Implement task queue with priority management:
- Task states: pending, running, paused, complete, failed
- Priority levels (high, normal, low)
- Dependency resolution (task B waits for task A)
- Max concurrent tasks limit (default: 3)

#### [NEW] [src/renderer/workers/executionWorker.js](file:///c:/DevApps/AesopIDE/src/renderer/workers/executionWorker.js)
Web Worker for heavy computation:
- Execute tool chains without blocking main thread
- Handle large file parsing/processing
- Perform vector similarity calculations

#### [MODIFY] [src/renderer/lib/tasks/manager.js](file:///c:/DevApps/AesopIDE/src/renderer/lib/tasks/manager.js)
Enhance `executeChain()` to support concurrency:
- Check if steps can run in parallel (no dependencies)
- Use `Promise.allSettled()` for concurrent execution
- Track individual step failures without halting entire chain
- Add task persistence for long-running sessions

#### [MODIFY] [src/renderer/components/AgentManager.jsx](file:///c:/DevApps/AesopIDE/src/renderer/components/AgentManager.jsx)
Update UI to show multiple concurrent tasks:
- Display task queue with status indicators
- Show progress bars for each active task
- Add per-task cancel/pause buttons
- Implement task priority drag-and-drop reordering

### Verification Plan

#### Automated Tests
- Create test file: `src/renderer/lib/tasks/__tests__/taskQueue.test.js`
- Test cases:
  - Add multiple tasks to queue
  - Verify priority ordering
  - Test dependency resolution
  - Validate concurrent execution limit
- Run: `npm test -- taskQueue.test.js`

#### Manual Verification
1. Start AesopIDE and open AgentManager
2. Request AI to perform 3 file operations simultaneously
3. Verify all 3 tasks appear in queue and execute concurrently
4. Test pause functionality - verify other tasks continue running
5. Check UI updates in real-time for all tasks

---

## Phase 8: Intelligent Tool Execution Layer (Pending)
**Status:** 📋 Planned - Not yet implemented
**byLLM Integration:** ✅ Retrieves error resolution strategies from developer library

### Overview
Upgrade editor to Monaco (VSCode's editor), implement VSCode-style task runner for terminal commands, and enable AI self-correction loops.

### User Review Required

> [!IMPORTANT]
> Monaco Editor replaces the current textarea. This is a **non-breaking change** - same props interface, but adds professional IDE features (syntax highlighting, IntelliSense, diff viewer).

### Proposed Changes

#### [MODIFY] [package.json](file:///c:/DevApps/AesopIDE/package.json)
Add Monaco Editor dependency:
```json
{
  "dependencies": {
    "@monaco-editor/react": "^4.6.0"
  }
}
```

#### [MODIFY] [src/renderer/components/Editor.jsx](file:///c:/DevApps/AesopIDE/src/renderer/components/Editor.jsx)
Replace textarea with Monaco Editor:
- Import `@monaco-editor/react`
- Detect language from file extension (js, ts, py, json, etc.)
- Enable syntax highlighting and IntelliSense
- Add custom keybindings (Ctrl+S for save)
- Support `automaticLayout: true` for panel resizing
- Preserve existing copy/paste functionality (enhanced by Monaco)

**Key Features:**
- Multi-cursor editing
- Built-in diff viewer (for Phase 5 git integration)
- Inline error markers (for terminal feedback)
- Minimap navigation
- Find/replace with regex

**Implementation:**
```javascript
import MonacoEditor from "@monaco-editor/react";

export default function Editor({ activeTab, onChangeContent, onSave }) {
    const editorRef = useRef(null);

    function handleEditorDidMount(editor, monaco) {
        editorRef.current = editor;
        
        // Preserve Ctrl+S save
        editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyS, () => {
            onSave();
        });

        // Add AI context query action
        editor.addAction({
            id: 'aesop-ai-assist',
            label: 'Ask AI About Selection',
            keybindings: [monaco.KeyMod.CtrlCmd | monaco.KeyMod.Shift | monaco.KeyCode.KeyA],
            run: (ed) => {
                const selection = ed.getModel().getValueInRange(ed.getSelection());
                window.aesop.events.emit('ai:contextQuery', { code: selection });
            }
        });
    }

    const getLanguage = (path) => {
        const ext = path.split('.').pop();
        const map = { 
            js: 'javascript', jsx: 'javascript',
            ts: 'typescript', tsx: 'typescript',
            py: 'python', json: 'json', md: 'markdown',
            css: 'css', html: 'html', sql: 'sql'
        };
        return map[ext] || 'plaintext';
    };

    return (
        <MonacoEditor
            height="100%"
            language={getLanguage(activeTab.path)}
            value={activeTab.content || ""}
            onChange={onChangeContent}
            theme="vs-dark"
            options={{
                minimap: { enabled: true },
                fontSize: 14,
                automaticLayout: true,  // Responds to panel resize!
                tabSize: 2
            }}
            onMount={handleEditorDidMount}
        />
    );
}
```

#### [NEW] [src/renderer/lib/terminal/taskRunner.js](file:///c:/DevApps/AesopIDE/src/renderer/lib/terminal/taskRunner.js)
VSCode-style task runner for structured command execution:
- Auto-discover npm scripts from package.json
- Define problem matchers for TypeScript, ESLint, Jest errors
- Execute tasks with structured error parsing
- Return parsed errors to AI for self-correction

**Implementation:**
```javascript
export class TaskRunner {
    constructor() {
        this.tasks = new Map();
    }

    registerTask(name, config) {
        this.tasks.set(name, {
            command: config.command,
            cwd: config.cwd,
            problemMatcher: config.problemMatcher // Regex for error parsing
        });
    }

    async discoverScripts(projectPath) {
        const pkg = JSON.parse(await window.aesop.fs.readFile(`${projectPath}/package.json`));
        
        for (const [name, script] of Object.entries(pkg.scripts || {})) {
            this.registerTask(`npm:${name}`, {
                command: `npm run ${name}`,
                cwd: projectPath,
                problemMatcher: this.detectProblemMatcher(script)
            });
        }
    }

    detectProblemMatcher(script) {
        if (script.includes('tsc')) return /error TS(\d+): (.+)/;
        if (script.includes('eslint')) return /(\d+):(\d+)\s+error\s+(.+)/;
        if (script.includes('jest')) return /● (.+)/;
        return null;
    }

    async executeTask(name) {
        const task = this.tasks.get(name);
        const result = await window.aesop.terminal.exec(task.command, { cwd: task.cwd });
        
        // Parse errors using problem matcher
        if (task.problemMatcher && result.stderr) {
            const matches = result.stderr.match(task.problemMatcher);
            if (matches) {
                return { ...result, parsedErrors: matches };
            }
        }
        
        return result;
    }
}
```

#### [NEW] [src/renderer/lib/tools/terminalBridge.js](file:///c:/DevApps/AesopIDE/src/renderer/lib/tools/terminalBridge.js)
Command result parser and feedback loop:
- Use TaskRunner for structured execution
- Parse compilation errors (TypeScript, ESLint)
- Identify test failures (Jest/Vitest)
- Return structured error objects to AI

#### [MODIFY] [src/renderer/lib/ai/toolParser.js](file:///c:/DevApps/AesopIDE/src/renderer/lib/ai/toolParser.js)
Extend to handle terminal commands:
- Add `executeTerminalCommand` tool
- Use TaskRunner for execution
- Implement command validation
- Add retry logic with exponential backoff

#### [NEW] [src/renderer/lib/ai/selfCorrection.js](file:///c:/DevApps/AesopIDE/src/renderer/lib/ai/selfCorrection.js)
Self-correction loop implementation:
- Analyze parsed errors from TaskRunner
- **Query RAG**: Retrieve debugging strategies
- Generate fix attempts
- Re-execute via TaskRunner
- Escalate to user after max retries

### Verification Plan

#### Manual Verification (Monaco Editor)
1. Run `npm install @monaco-editor/react`
2. Run `npm run dev`
3. Open a TypeScript file - verify syntax highlighting works
4. Test Ctrl+C/V/X - verify copy/paste works
5. Resize panels - verify editor auto-adjusts (no breaking)
6. Test Ctrl+S - verify save still works

#### Manual Verification (Task Runner)
1. Ask AI: "What npm scripts are available?"
2. Verify AI lists discovered tasks
3. Introduce TypeScript error in a file
4. Ask AI: "Run npm run build and fix errors"
5. Verify AI:
   - Executes build task
   - Parses TypeScript error
   - Suggests or applies fix
   - Re-runs build to confirm

---

## Phase 9: Automated Plan Execution (Pending)
**Status:** 📋 Planned - Not yet implemented
**byLLM Integration:** ✅ Queries git workflow best practices and commit conventions

### Overview
Transform approved implementation plans into executed code with automatic git commits (building on existing planner.js foundation).

### Proposed Changes

#### [NEW] [src/renderer/lib/planning/planExecutor.js](file:///c:/DevApps/AesopIDE/src/renderer/lib/planning/planExecutor.js)
Execution engine for implementation plans:
- Parse `implementation_plan.md` into actionable steps
- Map plan sections to tool calls (readFile, writeFile, runCommand, etc.)
- Execute steps sequentially with checkpoints
- Handle execution failures with rollback support

#### [MODIFY] [src/renderer/lib/git.js](file:///c:/DevApps/AesopIDE/src/renderer/lib/git.js)
Add workflow automation functions:
- `createFeatureBranch(planTitle)`: Auto-create branch from plan name
- `commitStep(stepDescription)`: Commit after each completed step
- `generateCommitMessage(fileChanges)`: Use AI + **RAG best practices** for commit messages
- `rollbackToCheckpoint(checkpointId)`: Revert to previous state on failure

#### [MODIFY] [src/renderer/lib/tasks/manager.js](file:///c:/DevApps/AesopIDE/src/renderer/lib/tasks/manager.js)
Integrate planner with execution chain:
- Add `executePlan(projectPath)` function
- Read current plan status from `planner.js`
- Execute only approved plans
- Track progress and update task.md status markers

#### [MODIFY] [src/renderer/components/PlanReview.jsx](file:///c:/DevApps/AesopIDE/src/renderer/components/PlanReview.jsx)
Add execution controls:
- "Execute Plan" button (only enabled when plan approved)
- Real-time execution progress display
- Show current step being executed
- Display git commit history during execution

### Verification Plan

#### Automated Tests
- Create: `src/renderer/lib/planning/__tests__/planExecutor.test.js`
- Test plan parsing into steps
- Verify tool call mapping accuracy
- Test checkpoint/rollback functionality
- Run: `npm test -- planExecutor.test.js`

#### Manual Verification
1. Create a simple implementation plan (e.g., "Add console.log to App.jsx")
2. Approve the plan in PlanReview UI
3. Click "Execute Plan" button
4. Verify:
   - Feature branch created automatically
   - File is modified as planned
   - Git commit created with descriptive message
5. Check `.aesop/task.md` updated with step completion status
6. Run `git log` to verify commit message quality

---

## Phase 10: Supabase/Cloud Context Ingestion (Pending)
**Status:** 📋 Planned - Not yet implemented
**byLLM Integration:** ✅✅ CORE FEATURE - Uses RAG infrastructure to ingest schemas

### Overview
Understand external architectures by ingesting Supabase schemas and Edge Functions from DualPilot project.

### User Review Required

> [!IMPORTANT]
> This feature will scan and ingest external schema files (e.g., Supabase migrations, Edge Functions) from subdirectories of your currently loaded project. Ensure the project directory is correctly set via "Open Folder" before using schema ingestion.

### Proposed Changes

#### [MODIFY] [src/renderer/lib/codebase/context.js](file:///c:/DevApps/AesopIDE/src/renderer/lib/codebase/context.js)
Augment context builder with external schema loading:
- Add `loadExternalSchemas(projectPath)` function
- Scan `${projectPath}/supabase/migrations/*.sql`
- Parse SQL to extract table structures, columns, RLS policies
- Return schema as structured JSON

#### [NEW] [src/renderer/lib/ingestion/schemaIngestion.js](file:///c:/DevApps/AesopIDE/src/renderer/lib/ingestion/schemaIngestion.js)
Schema parser and ingestion:
- SQL parser for Supabase migration files
- Extract table relationships (foreign keys)
- Identify RLS policies and permissions
- **Use existing RAG infrastructure**: Call `window.aesop.ingestion.document()` to chunk and embed schemas
- TypeScript/JavaScript parser for Edge Functions
- Extract function signatures, parameters, return types

#### [NEW] [ipcHandlers.js → ingestion:scanExternalSchemas](file:///c:/DevApps/AesopIDE/ipcHandlers.js)
IPC handler for scanning external schema directories:
- Use current project root (from `currentRoot` variable)
- Scan for common schema directories: `${projectRoot}/supabase/migrations/`, `${projectRoot}/prisma/`, `${projectRoot}/db/`
- Scan for serverless function directories: `${projectRoot}/supabase/functions/`, `${projectRoot}/netlify/functions/`, `${projectRoot}/api/`
- Return file contents to renderer for processing

#### [MODIFY] [src/renderer/lib/ai/systemPrompt.js](file:///c:/DevApps/AesopIDE/src/renderer/lib/ai/systemPrompt.js)
Add schema context injection:
- Document new context types (database schema, Edge Functions)
- Add instructions for using schema context when working with backend
- Update example prompts to show schema-aware responses

#### [NEW] [src/renderer/components/SchemaViewer.jsx](file:///c:/DevApps/AesopIDE/src/renderer/components/SchemaViewer.jsx)
UI for browsing ingested schemas:
- Display table list with column details
- Show relationships diagram (foreign keys)
- List Edge Functions with signatures
- Allow manual re-ingestion

### Verification Plan

#### Automated Tests
- Create: `src/renderer/lib/ingestion/__tests__/schemaIngestion.test.js`
- Test SQL parsing with sample migration file
- Verify TypeScript function signature extraction
- Validate schema JSON structure
- Run: `npm test -- schemaIngestion.test.js`

#### Manual Verification
1. Open AesopIDE and load a project with database schemas (e.g., a project using Supabase, Prisma, or traditional SQL migrations)
2. Run command to ingest schemas (add UI button or command palette entry: "Ingest Project Schemas")
3. Verify in console that migration/schema files are discovered and read successfully
4. Check Supabase database that schema chunks are stored in `aesopide_developer_library` table
5. Ask AI: "What tables exist in this project's database?"
6. Verify AI response includes tables from ingested schemas
7. If project has serverless functions, ask: "What does the [function-name] function do?"
8. Verify AI can describe the function based on ingested code

---

## Phase 11: Architectural Guardrails (Pending)
**Status:** 📋 Planned - Not yet implemented
**byLLM Integration:** ✅ Stores common architectural patterns in RAG

### Overview
Dynamically enforce project-specific coding standards through `.clinerules` and custom configuration files (inspired by Cline's extensibility).

### Proposed Changes

#### [MODIFY] [src/renderer/lib/ai/systemPrompt.js](file:///c:/DevApps/AesopIDE/src/renderer/lib/ai/systemPrompt.js)
Dynamic prompt injection system:
- Convert from static string to function: `buildSystemPrompt(projectPath)`
- Read `.clinerules` or `AGENTS.md` from project root
- Parse rule definitions (format TBD: YAML, JSON, or markdown)
- Inject rules into prompt before each AI request
- Support rule priorities and overrides

#### [NEW] [src/renderer/lib/rules/ruleEngine.js](file:///c:/DevApps/AesopIDE/src/renderer/lib/rules/ruleEngine.js)
Configuration file parser:
- Support `.clinerules` format (YAML with rule sections)
- Parse rule categories: naming conventions, file structure, code patterns
- Conditional rules based on file type (e.g., "*.tsx must use functional components")
- Validation rules (e.g., "all functions must have JSDoc comments")

#### [NEW] [.clinerules](file:///c:/DevApps/AesopIDE/.clinerules)
Example AesopIDE project rules file:
```yaml
version: 1.0
rules:
  naming:
    - components: PascalCase (e.g., AgentManager.jsx)
    - utilities: camelCase (e.g., toolParser.js)
    - constants: UPPER_SNAKE_CASE
  
  structure:
    - new_components: src/renderer/components/
    - new_utilities: src/renderer/lib/
    - tests: __tests__ subdirectories
  
  patterns:
    - ipc_handlers: Always return { ok: boolean, ... }
    - react_components: Use functional components with hooks
    - error_handling: Always wrap IPC calls in try-catch

  documentation:
    - exported_functions: Require JSDoc with @param and @returns
```

#### [MODIFY] [src/renderer/lib/tools/framework.js](file:///c:/DevApps/AesopIDE/src/renderer/lib/tools/framework.js)
Add rule validation before tool execution:
- Check rules before writeFile (enforce naming, patterns)
- Validate structure before newFile/newFolder
- Auto-suggest fixes for rule violations
- **Query RAG**: Find similar project patterns when rules are ambiguous

### Verification Plan

#### Automated Tests
- Create: `src/renderer/lib/rules/__tests__/ruleEngine.test.js`
- Test parsing of sample `.clinerules` file
- Verify rule priority resolution
- Test conditional rule application
- Run: `npm test -- ruleEngine.test.js`

#### Manual Verification
1. Create `.clinerules` in AesopIDE root with test rule: "All new components must start with 'Test'"
2. Ask AI to create a new component called "MyComponent.jsx"
3. Verify AI either:
   - Names it "TestMyComponent.jsx" (following rule), OR
   - Warns about rule violation and asks for permission to override
4. Remove the rule and verify AI reverts to normal behavior

---

## Phase 12: Visual QA/UX Testing (Pending)
**Status:** 📋 Planned - Not yet implemented
**byLLM Integration:** ✅ Queries testing best practices and common UI patterns

### Overview
Implement browser automation for visual regression testing and interactive debugging (inspired by Cline's Computer Use capability).

### User Review Required

> [!CAUTION]
> Puppeteer/Playwright will launch real browser instances with automation. This may trigger anti-bot detection on some sites. Use responsibly and test only on localhost or owned domains.

### Proposed Changes

#### [NEW] [ipcHandlers.js → browser:launch](file:///c:/DevApps/AesopIDE/ipcHandlers.js)
Browser automation IPC handlers:
- Install Puppeteer in main process dependencies
- `browser:launch(url, options)`: Launch browser instance (headless/headed mode)
- `browser:screenshot(viewport)`: Capture full page or element screenshot
- `browser:click(selector)`: Click element by CSS selector
- `browser:type(selector, text)`: Type text into input field
- `browser:evaluate(script)`: Execute JavaScript in browser context
- `browser:close()`: Clean up browser instance

#### [NEW] [src/renderer/lib/testing/browserController.js](file:///c:/DevApps/AesopIDE/src/renderer/lib/testing/browserController.js)
Renderer-side browser control wrapper:
- Abstract Puppeteer API for AI agent use
- Record browser interaction sessions as video (mp4 format)
- Capture console logs and network requests
- Implement visual regression testing (compare screenshots)

#### [MODIFY] [src/renderer/lib/tools/framework.js](file:///c:/DevApps/AesopIDE/src/renderer/lib/tools/framework.js)
Add browser testing tools:
- `launchBrowser(url)`: Start automated browser session
- `testElement(selector, expected)`: Verify element state
- `captureScreenshot(name)`: Save screenshot to artifacts
- `runVisualTest(baseline)`: Compare current vs baseline screenshot

#### [NEW] [src/renderer/lib/testing/visualRegression.js](file:///c:/DevApps/AesopIDE/src/renderer/lib/testing/visualRegression.js)
Visual regression testing logic:
- Pixel-by-pixel image comparison
- Generate diff images highlighting changes
- Manage baseline screenshot library
- Report visual regression results

### Verification Plan

#### Automated Tests
- Create: `src/renderer/lib/testing/__tests__/browserController.test.js`
- Mock Puppeteer API
- Test screenshot capture workflow
- Verify cleanup on errors
- Run: `npm test -- browserController.test.js`

#### Manual Verification
1. Run DualPilot locally: `cd c:\DevApps\dualpilot && npm run dev`
2. In AesopIDE, ask AI: "Test the DualPilot homepage at http://localhost:3000"
3. Verify AI:
   - Launches browser automatically
   - Navigates to URL
   - Captures screenshot
   - Reports page load success
4. Check artifacts directory for saved screenshot
5. Ask AI: "Click the login button and verify the modal appears"
6. Verify AI can interact with page elements

---

## Phase 13: Artifact Generation & Display (Pending)
**Status:** 📋 Planned - Not yet implemented
**byLLM Integration:** ❌ No direct integration (infrastructure feature)

### Overview
Communicate progress through visual artifacts like screenshots, videos, and structured diffs (matching Antigravity/Cline's approach).

### Proposed Changes

#### [MODIFY] [src/renderer/components/AgentManager.jsx](file:///c:/DevApps/AesopIDE/src/renderer/components/AgentManager.jsx)
Add artifact display section:
- Screenshot gallery with lightbox view
- Video player for session recordings (WebP/MP4 format)
- Embedded diff viewer for code changes
- Download/export buttons for artifacts

#### [NEW] [src/renderer/lib/artifacts/generator.js](file:///c:/DevApps/AesopIDE/src/renderer/lib/artifacts/generator.js)
Artifact creation utilities:
- `createWalkthrough(steps, screenshots)`: Generate walkthrough.md
- `generateComparisonView(before, after)`: Create before/after artifact
- `recordSession(taskId)`: Start/stop session recording
- `exportArtifacts(taskId, format)`: Package artifacts for sharing

#### [MODIFY] [src/renderer/components/PlanReview.jsx](file:///c:/DevApps/AesopIDE/src/renderer/components/PlanReview.jsx)
Display artifacts alongside plans:
- Show execution screenshots inline
- Embed code change diffs with syntax highlighting
- Link to verification videos
- Timeline view of artifacts created during execution

#### [NEW] [src/renderer/styles/artifacts.css](file:///c:/DevApps/AesopIDE/src/renderer/styles/artifacts.css)
Styling for artifact displays:
- Carousel view for multiple screenshots
- Video player controls
- Diff viewer color scheme (green for additions, red for deletions)
- Responsive layout for artifact gallery

### Verification Plan

#### Manual Verification (User-Assisted)
1. Complete a task that generates artifacts (e.g., Phase 12 browser testing)
2. Open AgentManager and navigate to completed task
3. Verify artifacts section shows:
   - Thumbnails of captured screenshots
   - Playable video of test session (if recorded)
   - Diff view of code changes made
4. Click screenshot thumbnail to open lightbox view
5. Click download button and verify artifact saves to disk
6. Review generated `walkthrough.md` for completeness

---

## Phase 14: Autonomous Test Integration (Pending)
**Status:** 📋 Planned - Not yet implemented
**byLLM Integration:** ✅✅ Retrieves debugging patterns and test strategies from RAG

### Overview
Full TDD workflow with self-debugging loop (test → fail → fix → repeat).

### Proposed Changes

#### [MODIFY] [src/renderer/lib/tasks/manager.js](file:///c:/DevApps/AesopIDE/src/renderer/lib/tasks/manager.js)
Integrate `runTests()` into execution chain:
- Add `verificationMode` flag to `executeChain()`
- Automatically run tests after code changes
- Parse test results for pass/fail status
- Trigger self-correction on failures

#### [NEW] [src/renderer/lib/testing/testAnalyzer.js](file:///c:/DevApps/AesopIDE/src/renderer/lib/testing/testAnalyzer.js)
Test result parser and failure analyzer:
- Parse Jest/Vitest output (JSON format preferred)
- Extract failed test names, error messages, stack traces
- **Query RAG**: Retrieve debugging patterns for specific error types
- Generate fix suggestions based on failure analysis
- Track failure patterns for learning

#### [NEW] [src/renderer/lib/testing/tddMode.js](file:///c:/DevApps/AesopIDE/src/renderer/lib/testing/tddMode.js)
Test-driven development workflow:
- "Write tests first" mode toggle in UI
- Generate test skeletons from requirements
- Implement code to make tests pass
- Refactor with continuous test validation
- Red-Green-Refactor cycle automation

#### [MODIFY] [src/renderer/lib/ai/selfCorrection.js](file:///c:/DevApps/AesopIDE/src/renderer/lib/ai/selfCorrection.js)
Add test-specific self-correction:
- Analyze test failure root causes
- Attempt fixes (limited to 5 iterations)
- Re-run tests after each fix attempt
- Escalate to user if max iterations exceeded
- Log all fix attempts for user review

### Verification Plan

#### Automated Tests (Self-Testing!)
- Create: `src/renderer/lib/testing/__tests__/testAnalyzer.test.js`
- Provide sample Jest failure output
- Verify parsing extracts correct error info
- Test fix suggestion generation
- Run: `npm test -- testAnalyzer.test.js`

#### Manual Verification (TDD Workflow)
1. Enable TDD mode in AesopIDE settings
2. Ask AI: "Create a function `add(a, b)` that adds two numbers"
3. Verify AI:
   - First writes test: `expect(add(1, 2)).toBe(3)`
   - Then implements function
   - Runs test to verify
4. Introduce deliberate bug: "Make add function multiply instead"
5. Verify AI:
   - Runs tests automatically
   - Detects failure
   - Analyzes error message
   - Fixes the function
   - Re-runs tests until they pass

---

## Phase 16: Live Web Search & Auto-Ingestion (Pending)
**Status:** 📋 Planned - Not yet implemented
**byLLM Integration:** ✅✅ CORE FEATURE - Ingests search results into RAG

### Overview
Enable real-time documentation retrieval using Gemini's Google Search Grounding, with automatic ingestion of findings into the developer library.

### Proposed Changes

#### [MODIFY] [ipcHandlers.js → prompt:send](file:///c:/DevApps/AesopIDE/ipcHandlers.js)
Enable Google Search Grounding in Gemini API calls:
- Add `tools` configuration with `googleSearchRetrieval`
- Enable grounding for specific query types (documentation, API references)
- Extract grounded content from response metadata
- Auto-ingest grounded sources into RAG

```javascript
// In prompt:send handler, add:
const generationConfig = {
  temperature: 0.7,
  // ... other config
};

const tools = [];
if (options.enableSearch) {
  tools.push({
    googleSearchRetrieval: {
      dynamicRetrievalConfig: {
        mode: "MODE_DYNAMIC",
        dynamicThreshold: 0.3 // Only ground when confidence is low
      }
    }
  });
}

const result = await model.generateContent({
  contents,
  generationConfig,
  tools
});

// Extract and ingest grounded content
if (result.groundingMetadata?.webSearchQueries) {
  for (const query of result.groundingMetadata.webSearchQueries) {
    // Auto-ingest search results
    await ingestSearchResult(query);
  }
}
```

#### [NEW] [src/renderer/lib/search/liveSearch.js](file:///c:/DevApps/AesopIDE/src/renderer/lib/search/liveSearch.js)
Live search utilities:
- `enableSearchForQuery(query)`: Determine if search should be enabled
- `extractGroundingData(response)`: Parse grounding metadata
- `ingestSearchResults(groundingData)`: Store findings in RAG
- **Smart caching**: Check if topic already in RAG before enabling search

#### [MODIFY] [src/renderer/lib/ai/systemPrompt.js](file:///c:/DevApps/AesopIDE/src/renderer/lib/ai/systemPrompt.js)
Add search capabilities to system prompt:
- Document when AI can trigger live search
- Explain grounding citations in responses
- Instruct AI to summarize and save important findings

```markdown
### Live Search (When Enabled)
When you need current information not in your context or developer library:
- Technical documentation (e.g., "React 19 features")
- Library API references (e.g., "Supabase Edge Function syntax")
- Breaking changes or deprecations
- Latest best practices

After receiving grounded results:
1. Summarize key findings
2. Important documentation will be automatically saved to developer library
3. Future queries on same topic will use cached knowledge
```

#### [MODIFY] [src/renderer/components/PromptPanel.jsx](file:///c:/DevApps/AesopIDE/src/renderer/components/PromptPanel.jsx)
Add search toggle and grounding indicator:
- Checkbox: "Enable live web search" (default: auto)
- Display grounding citations when search is used
- Show "Saved to library" indicator when content is ingested

### Verification Plan

#### Automated Tests
- Create: `src/renderer/lib/search/__tests__/liveSearch.test.js`
- Mock Gemini response with grounding metadata
- Test search result parsing
- Verify RAG ingestion triggered correctly
- Run: `npm test -- liveSearch.test.js`

#### Manual Verification
1. Ask AI: "What are the new features in React 19?"
2. Verify response includes grounded information with citations
3. Check console logs show grounding metadata was received
4. Verify Supabase `aesopide_developer_library` table has new entries for React 19 docs
5. Ask follow-up: "Tell me more about React 19 Server Actions"
6. Verify AI uses cached RAG knowledge (faster response, no new grounding)
7. Toggle off "Enable live web search"
8. Ask same question - verify AI uses only RAG, mentions if info might be outdated

### Cost Considerations

> [!IMPORTANT]
> Google Search Grounding is **FREE** for Gemini 2.0 Flash but has **input token cost** for grounding data:
> - Grounded content adds ~2-5K tokens per search
> - At scale: ~$0.01-0.02 per grounded query
> - Recommendation: Enable auto mode (only searches when RAG has low confidence)

---

## Phase 17: Cline Architecture Integration (Pending)
**Status:** 📋 Planned - Not yet implemented
**byLLM Integration:** ✅ Extensions can contribute RAG sources

### Overview
 Adopt proven patterns from Cline and Theia for MCP support, task checkpoints, and enhanced context management using a clean extension architecture.

### Proposed Changes

#### [NEW] [src/renderer/lib/extensions/extensionHost.js](file:///c:/DevApps/AesopIDE/src/renderer/lib/extensions/extensionHost.js)
Theia-inspired extension system for MCP servers and custom tools:
- Register extensions with manifest-based configuration
- Provide isolated extension contexts
- Auto-activate based on events (e.g., project type detected)
- Allow extensions to contribute tools, commands, and RAG sources

#### [NEW] [extensions/dualpilot-tools/manifest.json](file:///c:/DevApps/AesopIDE/extensions/dualpilot-tools/manifest.json)
Example extension manifest:
```json
{
  "id": "dualpilot-tools",
  "name": "DualPilot Integration",
  "version": "1.0.0",
  "activationEvents": ["onProject:dualpilot"],
  "contributes": {
    "tools": [
      {
        "name": "fetchDualPilotSites",
        "description": "Fetch all sites from DualPilot Supabase"
      }
    ]
  }
}
```

#### [NEW] [src/renderer/lib/mcp/mcpClient.js](file:///c:/DevApps/AesopIDE/src/renderer/lib/mcp/mcpClient.js)
Model Context Protocol client implementation:
- Connect to MCP servers
- Discover available tools from servers
- Execute server-provided tools
- Handle streaming responses
- **Integrate with Extension System**: MCP servers register as extensions

#### [MODIFY] [src/renderer/lib/tasks/manager.js](file:///c:/DevApps/AesopIDE/src/renderer/lib/tasks/manager.js)
Add checkpoint system (inspired by Cline):
- Save workspace state before each major step
- Enable "Restore to Checkpoint" functionality
- Support "Compare with Checkpoint" diff view
- Implement "Restore Task and Workspace" vs "Restore Workspace Only"

#### [MODIFY] [src/renderer/components/PromptPanel.jsx](file:///c:/DevApps/AesopIDE/src/renderer/components/PromptPanel.jsx)
Add context shortcuts (Cline-style):
- `@url <url>`: Fetch and ingest URL content
- `@file <path>`: Add file to context without AI approval
- `@folder <path>`: Add entire folder to context
- `@problems`: Inject workspace errors from linter

### Verification Plan

#### Manual Verification (Extension System)
1. Create custom extension: "Create a tool that lists all DualPilot sites"
2. Verify AI creates extension in `extensions/dualpilot-tools/`
3. Test extension registration in AesopIDE
4. Use the tool in a prompt: "List all sites in DualPilot"

#### Manual Verification (Checkpoints)
1. Make code changes to a file
2. Create checkpoint via AgentManager
3. Make more changes
4. Click "Compare with Checkpoint" - verify diff shows correctly
5. Click "Restore Checkpoint" - verify files revert

#### Manual Verification (Context Shortcuts)
1. Type `@file src/renderer/App.jsx` in prompt
2. Verify file content added to context automatically
3. Type `@url https://docs.example.com/api`
4. Verify URL content fetched and added to context

---

## Real-World Project Verification

These milestones demonstrate AesopIDE's capabilities on actual projects (including DualPilot or any other project you're working on).

### Milestone 1: Simple Feature Implementation
**Test Case Example:** Complete a single-file feature (e.g., "Add GA4 integration to data layer")

Steps:
1. Open your project in AesopIDE
2. Give AI a specific implementation task (e.g., "Implement [feature] in `path/to/file.ts`")
3. Verify AI:
   - Creates implementation plan
   - Requests approval
   - Executes plan (modifies/creates files as needed)
   - Runs tests
   - Creates git commit
4. Manual review: Check if the feature works as expected

### Milestone 2: Multi-File Refactoring
**Test Case Example:** Refactor a system that touches multiple files (e.g., "Update authentication across all components")

Steps:
1. Tell AI: "Refactor [system/component] to use [new approach/library/pattern]"
2. Verify AI:
   - Identifies all affected files (potentially 20+)
   - Creates comprehensive plan
   - Executes changes with incremental commits
   - Runs full test suite
   - Generates walkthrough with before/after screenshots

### Milestone 3: Full Autonomy Test
**Test Case:** High-level requirement → working feature

Steps:
1. Give AI a high-level feature request (e.g., "Build a [component/feature] that [does something]")
2. Provide no further guidance beyond the initial requirement
3. Verify AI autonomously:
   - Researches your codebase (uses schema context if available)
   - Designs component/module architecture
   - Implements the feature (creates files, writes code, adds tests)
   - **Queries RAG** for best practices and library recommendations
   - Tests the feature (using Phase 12 browser tools for UI, Phase 14 for unit tests)
   - Generates visual artifact showing working feature
   - Creates PR-ready branch with clean, logical commits

**Success Criteria:** Feature works without manual intervention, code follows your project's established patterns and architectural guidelines

---

## Summary

**Total Phases:** 18 (7 completed, 11 planned)

**Recently Added Enhancements (from repository analysis):**
- ✅ Phase 7.5: Electron Best Practices (ErrorBoundary, IPC Schema, Workspace State)
- ✅ Phase 8: Monaco Editor integration + VSCode Task Runner pattern
- ✅ Phase 17: Theia Extension System for clean MCP integration

**byLLM/RAG Integration Points:**
- ✅✅ Phase 10 (Cloud Context): CORE - Ingests schemas into RAG
- ✅✅ Phase 14 (Test Integration): CORE - Retrieves debugging patterns
- ✅✅ Phase 16 (Live Search): CORE - Auto-ingests web search results into RAG
- ✅ Phase 8: Monaco + RAG for enhanced code context
- ✅ Phase 17: Extensions can contribute RAG sources
- ✅ Phases 7, 9, 11, 12: Query RAG for best practices
- ❌ Phase 13: No direct RAG integration (infrastructure)

**Cline-Inspired Features:**
- Phase 8: Terminal self-correction loop + Monaco Editor
- Phase 12: Browser automation (Computer Use)
- Phase 17: MCP support via Extension System, checkpoints, @url/@file context shortcuts

**Theia-Inspired Features:**
- Phase 17: Extension Host with manifest-based configuration
- Phase 17: Isolated extension contexts with service injection

**VSCode-Inspired Features:**
- Phase 8: Task Runner with problem matchers
- Phase 7.5: Workspace state persistence (memento pattern)

**Electron React Boilerplate Patterns:**
- Phase 7.5: Error Boundary for crash protection
- Phase 7.5: IPC channel validation schema
- Phase 7.5: Workspace state persistence

**Live Knowledge Features:**
- Phase 16: Google Search Grounding with automatic RAG ingestion

**Next Steps:**
1. Implement Phase 7.5 (Electron Best Practices) - Quick wins for stability
2. Implement Phase 8 (Monaco Editor + Task Runner) - Major UX improvement
3. Begin Phase 10 (Supabase Context) - High priority for project-specific work
4. Implement Phase 16 (Live Search + Auto-Ingest) - Enables fresh knowledge
5. Full stack validation with Real-World Project Milestone 1