// Quick test to verify toolParser.js is working
import parseToolCalls from './src/renderer/lib/ai/toolParser.js';

const testInput = `\`\`\`json
[ {"tool": "writeFile", "path": "test.txt", "content": "hello"} ]
\`\`\``;

console.log('Testing tool parser...');
console.log('Input:', testInput);

const result = parseToolCalls(testInput);
console.log('Parsed calls:', JSON.stringify(result, null, 2));

if (result.length > 0) {
    console.log('✅ Tool detected:', result[0].tool);
    console.log('✅ Parameters:', result[0].params);

    if (result[0].params.path && result[0].params.content) {
        console.log('✅ SUCCESS: Parameters extracted correctly!');
    } else {
        console.log('❌ FAIL: Parameters missing!');
        console.log('   Expected: {path: "test.txt", content: "hello"}');
        console.log('   Got:', result[0].params);
    }
} else {
    console.log('❌ FAIL: No tools detected');
}
