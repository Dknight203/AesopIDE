export function logToTerminal(setOutput, text) {
    setOutput((prev) => [...prev, text]);
}
