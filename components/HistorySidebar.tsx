
import React, { useState, useEffect, useRef } from 'react';
import { ChatSession } from '../types';
import { NewChatIcon, TrashIcon, EditIcon } from './icons';

interface HistorySidebarProps {
    sessions: ChatSession[];
    activeSessionId: string | null;
    onNewChat: () => void;
    onSelectChat: (id: string) => void;
    onDeleteChat: (id: string) => void;
    onRenameChat: (id: string, newTitle: string) => void;
}

export const HistorySidebar: React.FC<HistorySidebarProps> = ({ sessions, activeSessionId, onNewChat, onSelectChat, onDeleteChat, onRenameChat }) => {
    const [editingId, setEditingId] = useState<string | null>(null);
    const [editingText, setEditingText] = useState('');
    const inputRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        if (editingId && inputRef.current) {
            inputRef.current.focus();
        }
    }, [editingId]);

    const handleRenameStart = (e: React.MouseEvent, session: ChatSession) => {
        e.stopPropagation();
        setEditingId(session.id);
        setEditingText(session.title);
    };

    const handleRenameConfirm = () => {
        if (editingId && editingText.trim()) {
            onRenameChat(editingId, editingText.trim());
        }
        setEditingId(null);
        setEditingText('');
    };

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter') {
            handleRenameConfirm();
        } else if (e.key === 'Escape') {
            setEditingId(null);
            setEditingText('');
        }
    };

    const handleDelete = (e: React.MouseEvent, sessionId: string) => {
        e.stopPropagation();
        if (window.confirm('Are you sure you want to delete this chat?')) {
            onDeleteChat(sessionId);
        }
    };

    return (
        <aside className="w-72 bg-gray-900/80 backdrop-blur-sm flex flex-col h-full">
            <div className="p-4 border-b border-gray-700">
                <button
                    onClick={onNewChat}
                    className="w-full flex items-center justify-center gap-2 px-4 py-2 text-sm font-bold bg-green-600 text-white rounded-md hover:bg-green-700 transition-colors"
                >
                    <NewChatIcon className="w-5 h-5" />
                    New Chat
                </button>
            </div>
            <nav className="flex-1 overflow-y-auto p-2 space-y-1">
                {sessions.map(session => (
                    <div
                        key={session.id}
                        onClick={() => !editingId && onSelectChat(session.id)}
                        className={`group flex items-center justify-between p-3 rounded-md cursor-pointer transition-colors ${
                            activeSessionId === session.id ? 'bg-green-800/50' : 'hover:bg-gray-700/50'
                        }`}
                    >
                        {editingId === session.id ? (
                            <input
                                ref={inputRef}
                                type="text"
                                value={editingText}
                                onChange={(e) => setEditingText(e.target.value)}
                                onBlur={handleRenameConfirm}
                                onKeyDown={handleKeyDown}
                                className="w-full bg-transparent focus:outline-none text-sm text-gray-100 border-b border-green-500"
                                onClick={e => e.stopPropagation()}
                            />
                        ) : (
                            <>
                                <div className="flex-grow truncate pr-2">
                                    <p className="text-sm text-gray-200 truncate">{session.title}</p>
                                    <p className="text-xs text-gray-500 truncate">{session.model}</p>
                                </div>
                                <div className="flex items-center flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
                                    <button
                                        onClick={(e) => handleRenameStart(e, session)}
                                        className="p-1 text-gray-400 hover:text-white"
                                        aria-label="Rename chat"
                                    >
                                        <EditIcon className="w-4 h-4" />
                                    </button>
                                    <button
                                        onClick={(e) => handleDelete(e, session.id)}
                                        className="p-1 text-gray-400 hover:text-red-400"
                                        aria-label="Delete chat"
                                    >
                                        <TrashIcon className="w-4 h-4" />
                                    </button>
                                </div>
                            </>
                        )}
                    </div>
                ))}
            </nav>
        </aside>
    );
};