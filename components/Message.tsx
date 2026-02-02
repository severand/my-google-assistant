
import React from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { ChatMessage, MessageRole } from '../types';
import { CodeBlock } from './CodeBlock';
import { UserIcon, LogoIcon, SettingsIcon } from './icons';

interface MessageProps {
    message: ChatMessage;
}

export const Message: React.FC<MessageProps> = ({ message }) => {
    const isModel = message.role === MessageRole.MODEL;
    const isUser = message.role === MessageRole.USER;
    const isTool = message.role === MessageRole.TOOL;

    let Icon: React.FC<any>;
    let bgColor: string;
    let alignClass: string;
    let textColor: string;
    let iconColor: string;
    let showIcon: boolean = true;
    
    switch (message.role) {
        case MessageRole.MODEL:
            Icon = LogoIcon;
            bgColor = 'bg-gray-800';
            alignClass = 'justify-start';
            textColor = 'text-gray-300';
            iconColor = 'text-green-400';
            break;
        case MessageRole.USER:
            Icon = UserIcon;
            bgColor = 'bg-blue-900/50';
            alignClass = 'justify-end';
            textColor = 'text-gray-100';
            iconColor = 'text-blue-400';
            break;
        case MessageRole.TOOL:
            Icon = SettingsIcon; // Using settings icon for tools
            bgColor = 'bg-transparent';
            alignClass = 'justify-center';
            textColor = 'text-gray-500 italic text-sm';
            iconColor = 'text-gray-500';
            showIcon = false; // Let's make tool messages more subtle
            break;
        default:
            Icon = () => null;
            bgColor = '';
            alignClass = '';
            textColor = '';
            iconColor = '';
    }

    if (isTool) {
        return (
            <div className={`flex items-center gap-2 my-2 ${alignClass} ${textColor}`}>
                 <Icon className={`w-4 h-4 flex-shrink-0 ${iconColor}`} />
                 <ReactMarkdown>{message.content}</ReactMarkdown>
            </div>
        );
    }

    return (
        <div className={`flex items-start gap-4 ${alignClass}`}>
            {isModel && <Icon className={`w-8 h-8 mt-2 flex-shrink-0 ${iconColor}`} />}
            <div className={`max-w-3xl w-full rounded-lg p-4 ${bgColor} ${textColor}`}>
                {message.content === '' && isModel ? (
                    <div className="flex items-center space-x-2">
                        <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse"></div>
                        <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse delay-75"></div>
                        <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse delay-150"></div>
                    </div>
                ) : (
                    <ReactMarkdown
                        className="prose prose-invert prose-p:my-2 prose-headings:my-4 prose-blockquote:border-l-green-400"
                        remarkPlugins={[remarkGfm]}
                        components={{
                            code({ node, inline, className, children, ...props }) {
                                const match = /language-(\w+)/.exec(className || '');
                                return !inline && match ? (
                                    <CodeBlock language={match[1]} value={String(children).replace(/\n$/, '')} />
                                ) : (
                                    <code className={`${className} bg-gray-700 rounded-md px-1.5 py-0.5 font-mono text-sm`} {...props}>
                                        {children}
                                    </code>
                                );
                            },
                        }}
                    >
                        {message.content}
                    </ReactMarkdown>
                )}
            </div>
            {isUser && <Icon className={`w-8 h-8 mt-2 flex-shrink-0 ${iconColor}`} />}
        </div>
    );
};
