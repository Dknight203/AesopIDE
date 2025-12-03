# CONTRIBUTING.md

## AesopIDE Contribution & Tooling Guidelines

This project is built around an AI-first IDE experience. The following rules and expectations govern how the IDE should behave and how contributors should implement features and tools.

### Core Principles

- AI-first: The IDE should enable the assistant to perform file operations, code search, and run commands on behalf of the user. Users must not be required to run CLI commands manually to get core IDE functionality.
- Safety-first: Any destructive operation (write, delete, git push, force operations) must require explicit user confirmation before execution.
- Discoverability: Tool capabilities must be documented and accessible in the UI and in this contributing guide.
- Predictability: Tool calls from the assistant are validated and executed through a registry. Unexpected or unknown tool calls must be rejected and surfaced to the user.

### Tool Usage & Policies

- Tools are invoked using structured tool calls embedded in assistant responses. Preferred format is a JSON object inside a fenced code block, for example:

```json
{ "tool": "writeFile", "params": { "path": "src/foo.js", "content": "// full file content" } }
```

- Inline directives can be used for simple non-ambiguous calls:

```
AesopTool: runCommand {"cmd":"git status"}
```

- The IDE provides the following core tools (examples): `readFile`, `writeFile`, `listDirectory`, `searchCode`, `findFiles`, `getFileTree`, `runCommand`, `getCommandOutput`.

- Destructive commands (example: `git push`, `writeFile` that overwrites) must trigger a user confirmation modal before execution. The UI should present a clear description of what will change and an option to cancel.

### Developer Guidelines

- Tool implementations must live under `src/renderer/lib/tools` and be registered through a central framework. Each tool must declare a JSON schema-like `params` object describing required parameters and types.
- The Prompt UI must parse assistant responses for tool calls, validate parameters through the tool registry, execute them via the secure preload IPC bridge, present results to the user, and send those results back to the assistant for further planning.
- Avoid requiring manual CLI usage for common operations. Wrap git actions via the backend IPC and present human-friendly feedback.

### Safety & Reviews

- All changes that enable automatic tool execution must be reviewed for security implications. The preload must not expose arbitrary Node APIs to the renderer; only explicit IPC handlers are allowed.
- Keep the command execution surface minimal and controlled. Long-running or interactive commands should be handled via explicit user flows, not automatic background execution.

### Testing

- Unit tests should cover the tool parser and tool registry validation logic.
- Manual tests should verify that tool calls from the assistant are executed, results are shown, and the assistant receives the returned output to continue planning.

---

If you want this policy changed (for example to allow more permissive auto-execution), propose the change in a PR with clear security rationale.