
import React from 'react';
import { ChatMessage } from '../types';
import { Message } from './Message';
import { LogoIcon, SettingsIcon, NewChatIcon } from './icons';

interface ChatWindowProps {
    messages: ChatMessage[];
    isConfigured: boolean;
    onOpenSettings: () => void;
    hasActiveSession: boolean;
    onNewChat: () => void;
}

export const ChatWindow: React.FC<ChatWindowProps> = ({ messages, isConfigured, onOpenSettings, hasActiveSession, onNewChat }) => {

    const WelcomeMessage = () => (
        <div className="flex flex-col items-center justify-center h-full text-center text-gray-400 p-8">
            <LogoIcon className="w-24 h-24 mb-6 text-green-500" />
            <h2 className="text-3xl font-bold mb-2 text-gray-200">Google Scripts Assistant</h2>
            <p className="max-w-md">Чем я могу помочь вам с Google Apps Script сегодня?</p>
            <p className="max-w-md">How can I help you with Google Apps Script today?</p>
        </div>
    );

    const SettingsNeededMessage = () => (
         <div className="flex flex-col items-center justify-center h-full text-center text-gray-400 p-8">
            <SettingsIcon className="w-24 h-24 mb-6 text-yellow-500" />
            <h2 className="text-3xl font-bold mb-2 text-gray-200">Требуется настройка</h2>
            <p className="max-w-md mb-6">Пожалуйста, введите ваш API-ключ в настройках, чтобы начать работу.</p>
            <button 
                onClick={onOpenSettings}
                className="bg-green-600 text-white font-bold py-2 px-6 rounded-lg hover:bg-green-700 transition-colors flex items-center gap-2"
            >
                <SettingsIcon className="w-5 h-5" />
                <span>Открыть настройки</span>
            </button>
        </div>
    );
    
    const NoActiveSessionMessage = () => (
        <div className="flex flex-col items-center justify-center h-full text-center text-gray-400 p-8">
            <LogoIcon className="w-24 h-24 mb-6 text-green-500" />
            <h2 className="text-3xl font-bold mb-2 text-gray-200">Начнем работу!</h2>
            <p className="max-w-md mb-6">Создайте новый чат в боковой панели, чтобы начать беседу.</p>
            <button 
                onClick={onNewChat}
                className="bg-green-600 text-white font-bold py-2 px-6 rounded-lg hover:bg-green-700 transition-colors flex items-center gap-2"
            >
                <NewChatIcon className="w-5 h-5" />
                <span>Новый чат</span>
            </button>
        </div>
    );

    if (!isConfigured) {
        return <SettingsNeededMessage />;
    }

    if (!hasActiveSession) {
        return <NoActiveSessionMessage />;
    }

    return (
        <div className="p-4 space-y-6">
            {messages.length === 0 ? (
                <WelcomeMessage />
            ) : (
                messages.map((msg, index) => (
                    <Message key={index} message={msg} />
                ))
            )}
        </div>
    );
};