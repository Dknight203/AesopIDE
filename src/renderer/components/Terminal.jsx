import React from "react";

export default function Terminal({ output }) {
    return (
        <div className="terminal">
            <div className="terminal-title">Terminal</div>

            <div className="terminal-output">
                {output.map((line, index) => (
                    <div key={index} className="terminal-line">
                        {line}
                    </div>
                ))}
            </div>
        </div>
    );
}
