import React, { useEffect, useRef, useState } from 'react';
import mermaid from 'mermaid';
import { nanoid } from 'nanoid';

// Initialize mermaid via configuration
mermaid.initialize({
    startOnLoad: true,
    theme: 'dark',
    securityLevel: 'loose',
});

export default function Mermaid({ chart }) {
    const containerRef = useRef(null);
    const [svg, setSvg] = useState('');

    useEffect(() => {
        async function renderDiagram() {
            if (chart && containerRef.current) {
                try {
                    // Generate a unique ID for this diagram
                    const id = `mermaid-${nanoid(6)}`;

                    // Use mermaid's render function
                    // render(id, text) returns object { svg } in newer versions
                    const { svg: svgContent } = await mermaid.render(id, chart);
                    setSvg(svgContent);
                } catch (err) {
                    console.error('Mermaid render error:', err);
                    setSvg(`<div class="mermaid-error">Failed to render diagram: ${err.message}</div>`);
                }
            }
        }

        renderDiagram();
    }, [chart]);

    return (
        <div
            className="mermaid-container"
            dangerouslySetInnerHTML={{ __html: svg }}
            ref={containerRef}
        />
    );
}
