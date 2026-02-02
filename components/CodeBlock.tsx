
import React, { useState, useEffect, useRef } from 'react';
import { CopyIcon, CheckIcon } from './icons';

interface CodeBlockProps {
    language: string;
    value: string;
}

const CopyButton: React.FC<{ onCopy: () => void; isCopied: boolean }> = ({ onCopy, isCopied }) => (
    <button
        onClick={onCopy}
        className="flex items-center gap-1.5 text-xs text-gray-400 hover:text-white transition-colors"
    >
        {isCopied ? (
            <>
                <CheckIcon className="w-4 h-4 text-green-400" />
                Copied!
            </>
        ) : (
            <>
                <CopyIcon className="w-4 h-4" />
                Copy
            </>
        )}
    </button>
);


export const CodeBlock: React.FC<CodeBlockProps> = ({ language, value }) => {
    const [isCopied, setIsCopied] = useState(false);
    const codeRef = useRef<HTMLElement>(null);

    useEffect(() => {
        if (codeRef.current) {
            // @ts-ignore
            window.hljs.highlightElement(codeRef.current);
        }
    }, [value]);
    
    const handleCopy = () => {
        navigator.clipboard.writeText(value).then(() => {
            setIsCopied(true);
            setTimeout(() => setIsCopied(false), 2000);
        });
    };

    return (
        <div className="bg-gray-900/70 rounded-lg my-4 overflow-hidden border border-gray-700">
            <div className="flex justify-between items-center px-4 py-2 bg-gray-800/50">
                <span className="text-xs font-sans text-gray-400 capitalize">{language}</span>
                <CopyButton onCopy={handleCopy} isCopied={isCopied} />
            </div>
            <pre className="p-4 overflow-x-auto">
                <code ref={codeRef} className={`language-${language}`}>
                    {value}
                </code>
            </pre>
            <div className="flex justify-end items-center px-4 py-2 bg-gray-800/50 border-t border-gray-700">
                 <CopyButton onCopy={handleCopy} isCopied={isCopied} />
            </div>
        </div>
    );
};