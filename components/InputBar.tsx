
import React, { useState, useRef, useEffect } from 'react';
import { SendIcon, PaperclipIcon, XCircleIcon, MicrophoneIcon } from './icons';
import { useSpeechRecognition } from '../hooks/useSpeechRecognition';

interface InputBarProps {
    onSend: (message: string, file: File | null) => void;
    isLoading: boolean;
    disabled: boolean;
    onAttachClick: () => void;
}

export const InputBar: React.FC<InputBarProps> = ({ onSend, isLoading, disabled, onAttachClick }) => {
    const [input, setInput] = useState('');
    const [file, setFile] = useState<File | null>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);

    const {
        transcript,
        isListening,
        startListening,
        stopListening,
        browserSupportsSpeechRecognition
    } = useSpeechRecognition();

    useEffect(() => {
        if (transcript) {
            setInput(transcript);
        }
    }, [transcript]);

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if ((input.trim() || file) && !disabled) {
            onSend(input, file);
            setInput('');
            setFile(null);
            if(fileInputRef.current) {
                fileInputRef.current.value = "";
            }
        }
    };

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files[0]) {
            setFile(e.target.files[0]);
        }
    };
    
    const removeFile = () => {
        setFile(null);
        if(fileInputRef.current) {
            fileInputRef.current.value = "";
        }
    }

    const getPlaceholder = () => {
        if (disabled && !isLoading) {
             return "Please configure your API key or select a chat...";
        }
        return "Спросите что-нибудь или прикрепите файл... / Ask something or attach a file...";
    }
    
    const handleVoiceToggle = () => {
        if (isListening) {
            stopListening();
        } else {
            startListening();
        }
    };

    return (
        <div className="relative">
            {file && (
                <div className="absolute bottom-full left-0 mb-2 w-full">
                    <div className="bg-gray-700 text-gray-200 text-sm rounded-full py-1 px-3 inline-flex items-center gap-2">
                        <PaperclipIcon className="w-4 h-4" />
                        <span className="truncate max-w-xs">{file.name}</span>
                        <button onClick={removeFile} className="text-gray-400 hover:text-white">
                            <XCircleIcon className="w-5 h-5" />
                        </button>
                    </div>
                </div>
            )}
            <form onSubmit={handleSubmit} className="flex items-center gap-3">
                <input
                    type="file"
                    ref={fileInputRef}
                    onChange={handleFileChange}
                    className="hidden"
                    aria-hidden="true"
                />
                <button
                    type="button"
                    onClick={() => {
                        onAttachClick();
                        fileInputRef.current?.click();
                    }}
                    disabled={isLoading || disabled}
                    className="p-3 text-gray-400 hover:text-white disabled:text-gray-600 disabled:cursor-not-allowed transition-colors focus:outline-none"
                    aria-label="Attach file"
                >
                    <PaperclipIcon className="w-6 h-6" />
                </button>
                <input
                    type="text"
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    placeholder={getPlaceholder()}
                    disabled={isLoading || disabled}
                    className="flex-1 px-4 py-3 bg-gray-800 border border-gray-700 rounded-full focus:outline-none focus:ring-2 focus:ring-green-500 text-gray-200 placeholder-gray-500 disabled:opacity-50 transition-all"
                />
                <div className="flex items-center">
                    {browserSupportsSpeechRecognition && (
                        <button
                            type="button"
                            onClick={handleVoiceToggle}
                            disabled={isLoading || disabled}
                            className={`p-3 text-gray-400 hover:text-white disabled:text-gray-600 disabled:cursor-not-allowed transition-colors focus:outline-none ${isListening ? 'text-red-500 animate-pulse' : ''}`}
                            aria-label={isListening ? "Stop listening" : "Start listening"}
                        >
                            <MicrophoneIcon className="w-6 h-6" />
                        </button>
                    )}
                    <button
                        type="submit"
                        disabled={isLoading || (!input.trim() && !file) || disabled}
                        className="p-3 bg-green-600 rounded-full text-white hover:bg-green-700 disabled:bg-gray-600 disabled:cursor-not-allowed transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-gray-900 focus:ring-green-500"
                        aria-label="Send message"
                    >
                        <SendIcon className="w-6 h-6" />
                    </button>
                </div>
            </form>
        </div>
    );
};