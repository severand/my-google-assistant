

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { GoogleGenAI, Chat, FunctionDeclaration, Type, FunctionCall } from "@google/genai";
import { ChatMessage, MessageRole, Settings, ChatSession } from './types';
import { DEFAULT_SYSTEM_INSTRUCTION, PREDEFINED_MODELS, TITLE_GENERATION_PROMPT } from './constants';
import { ChatWindow } from './components/ChatWindow';
import { InputBar } from './components/InputBar';
import { SettingsModal } from './components/SettingsModal';
import { HistorySidebar } from './components/HistorySidebar';
import { LogoIcon, SettingsIcon, GitHubIcon, ChevronLeftIcon, ChevronRightIcon, MaximizeIcon, MinimizeIcon, CloseIcon } from './components/icons';
import { fileToBase64, readFileAsText } from './utils/file';

const getGitHubFileContentTool: FunctionDeclaration = { name: 'getGitHubFileContent', description: 'Gets the content of a file from a specified GitHub repository.', parameters: { type: Type.OBJECT, properties: { repo: { type: Type.STRING, description: 'The name of the GitHub repository (e.g., "my-project").' }, path: { type: Type.STRING, description: 'The full path to the file (e.g., "src/main.js").' } }, required: ['repo', 'path'] } };
const listGitHubRepoContentsTool: FunctionDeclaration = { name: 'listGitHubRepoContents', description: 'Lists the contents (files and directories) of a path in a GitHub repository.', parameters: { type: Type.OBJECT, properties: { repo: { type: Type.STRING, description: 'The name of the GitHub repository.' }, path: { type: Type.STRING, description: 'The path to the directory. Use "" or "/" for the root.' } }, required: ['repo', 'path'] } };
const createOrUpdateGitHubFileTool: FunctionDeclaration = { name: 'createOrUpdateGitHubFile', description: 'Creates a new file or updates an existing file in a GitHub repository.', parameters: { type: Type.OBJECT, properties: { repo: { type: Type.STRING, description: 'The name of the GitHub repository.' }, path: { type: Type.STRING, description: 'The full path where the file should be saved.' }, content: { type: Type.STRING, description: 'The new content of the file.' }, commitMessage: { type: Type.STRING, description: 'A descriptive commit message.' } }, required: ['repo', 'path', 'content', 'commitMessage'] } };

const App: React.FC = () => {
    const [allSessions, setAllSessions] = useState<ChatSession[]>([]);
    const [activeSessionId, setActiveSessionId] = useState<string | null>(null);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [isSettingsOpen, setIsSettingsOpen] = useState(false);
    const [isGithubModeActive, setIsGithubModeActive] = useState(false);
    const [isSidebarVisible, setIsSidebarVisible] = useState(true);
    const [isFullscreen, setIsFullscreen] = useState(false);
    const [showReEnterFullscreenPrompt, setShowReEnterFullscreenPrompt] = useState(false);
    
    const [settings, setSettings] = useState<Settings>({
        appTitle: 'Google Scripts Assistant',
        generateTitle: true,
        prompts: [],
        selectedPromptId: null,
        apiKey: '', saveApiKey: true, model: PREDEFINED_MODELS[0],
        activeProvider: 'gemini', 
        otherApiKey: '', saveOtherApiKey: true, otherModel: '', otherApiUrl: '',
        codexApiKey: '', saveCodexApiKey: true, codexModel: 'gpt-5.1-codex-max', codexApiUrl: '', codexReasoningEffort: 'high',
        githubUsername: '', githubPat: '', saveGithubPat: true, githubCommitMessage: 'feat: AI-generated changes', githubInstructions: 'When asked to modify or create code, use the available tools to interact with the user\'s GitHub repository directly. Announce which files you are reading or writing.'
    });
    const chatRef = useRef<Chat | null>(null);
    const mainContentRef = useRef<HTMLElement | null>(null);
    const wasInFullscreenBeforeAttach = useRef(false);

    useEffect(() => {
        try {
            const savedSettings = localStorage.getItem('app-settings');
            if (savedSettings) {
                const loadedSettings = JSON.parse(savedSettings);
                const newSettings = { ...settings, ...loadedSettings };
                if (!newSettings.prompts) newSettings.prompts = [];
                setSettings(newSettings);
                if ((!newSettings.apiKey && newSettings.activeProvider === 'gemini') || (!newSettings.otherApiKey && newSettings.activeProvider === 'other')) setIsSettingsOpen(true);
            } else {
                setIsSettingsOpen(true);
            }

            // Load sessions with migration from old format
            const savedGroupedSessions = localStorage.getItem('chat-sessions-by-model');
            const savedFlatSessions = localStorage.getItem('chat-sessions');
            let loadedSessions: ChatSession[] = [];

            if (savedFlatSessions) {
                loadedSessions = JSON.parse(savedFlatSessions);
            } else if (savedGroupedSessions) {
                // MIGRATION LOGIC from old grouped format
                const oldData: { [modelName: string]: Omit<ChatSession, 'model' | 'provider'>[] } = JSON.parse(savedGroupedSessions);
                const migratedSessions: ChatSession[] = [];
                for (const modelName in oldData) {
                    oldData[modelName].forEach(session => {
                        migratedSessions.push({
                            ...session,
                            model: modelName,
                            provider: 'gemini' // Default to gemini as provider info wasn't stored
                        });
                    });
                }
                loadedSessions = migratedSessions;
                localStorage.removeItem('chat-sessions-by-model'); // Clean up old data
            }
            
            loadedSessions.sort((a, b) => b.timestamp - a.timestamp);
            setAllSessions(loadedSessions);
        } catch (e) {
            console.error("Failed to load data from localStorage", e);
            setIsSettingsOpen(true);
        }
    }, []);

    useEffect(() => {
        const handleFullscreenChange = () => {
            const isCurrentlyFullscreen = !!document.fullscreenElement;
            setIsFullscreen(isCurrentlyFullscreen);
             if (!isCurrentlyFullscreen && wasInFullscreenBeforeAttach.current) {
                setShowReEnterFullscreenPrompt(true);
                wasInFullscreenBeforeAttach.current = false; // Reset ref
            }
        };
        document.addEventListener('fullscreenchange', handleFullscreenChange);
        return () => document.removeEventListener('fullscreenchange', handleFullscreenChange);
    }, []);

     useEffect(() => {
        if (isFullscreen) {
            setShowReEnterFullscreenPrompt(false);
        }
    }, [isFullscreen]);
    
    useEffect(() => {
        if (settings.appTitle) {
            document.title = settings.appTitle;
        }
    }, [settings.appTitle]);

    useEffect(() => { localStorage.setItem('chat-sessions', JSON.stringify(allSessions)); }, [allSessions]);
    
    const activeSession = allSessions.find(s => s.id === activeSessionId);
    
    useEffect(() => {
        if (mainContentRef.current) {
            const element = mainContentRef.current;
            // Check if the user is near the bottom of the scrollable area
            // A buffer of 100px allows for some leeway
            const isScrolledToBottom = element.scrollHeight - element.clientHeight <= element.scrollTop + 100;

            if (isScrolledToBottom) {
                // Scroll to the bottom
                element.scrollTop = element.scrollHeight;
            }
        }
    }, [activeSession?.messages]);


    useEffect(() => {
        if (!activeSession || activeSession.provider !== 'gemini' || !settings.apiKey) {
            chatRef.current = null;
            return;
        }
        try {
            const ai = new GoogleGenAI({ apiKey: settings.apiKey });
            const history = activeSession.messages.filter(m => m.role !== MessageRole.TOOL).map(m => ({ role: m.role, parts: [{ text: m.content }] })) || [];
            
            const selectedPrompt = settings.prompts.find(p => p.id === settings.selectedPromptId);
            let systemInstruction = selectedPrompt?.prompt || DEFAULT_SYSTEM_INSTRUCTION;
            if (isGithubModeActive) {
                systemInstruction = `${systemInstruction}\n\n**GitHub Mode Instructions:**\n${settings.githubInstructions}`;
            }
            
            const config: { systemInstruction: string; tools?: any; } = { systemInstruction };
            if (isGithubModeActive && settings.githubUsername && settings.githubPat) {
                config.tools = [{ functionDeclarations: [getGitHubFileContentTool, listGitHubRepoContentsTool, createOrUpdateGitHubFileTool] }];
            }
            
            chatRef.current = ai.chats.create({ model: activeSession.model, history, config });
            setError(null);
        } catch (e: any) {
            setError(`Failed to initialize chat: ${e.message}`);
        }
    }, [settings.apiKey, settings.prompts, settings.selectedPromptId, settings.githubUsername, settings.githubPat, activeSession, isGithubModeActive]);

    const generateTitle = useCallback(async (prompt: string) => {
        if (!settings.apiKey) return "New Chat";
        try {
            const ai = new GoogleGenAI({ apiKey: settings.apiKey });
            const response = await ai.models.generateContent({
                model: 'gemini-3-flash-preview',
                contents: `${TITLE_GENERATION_PROMPT}: "${prompt}"`,
            });
            return response.text?.replace(/"/g, '') || "New Chat";
        } catch (e) {
            console.error("Title generation failed:", e);
            return "New Chat";
        }
    }, [settings.apiKey]);
    
    const addMessageToSession = (message: ChatMessage) => {
        setAllSessions(prev => prev.map(session => session.id === activeSessionId ? { ...session, messages: [...session.messages, message] } : session));
    };

    const streamMessageContent = (contentChunk: string) => {
        setAllSessions(prev => prev.map(session => {
            if (session.id === activeSessionId) {
                const lastMessage = session.messages[session.messages.length - 1];
                if (lastMessage && lastMessage.role === MessageRole.MODEL) {
                    return { ...session, messages: [...session.messages.slice(0, -1), { ...lastMessage, content: lastMessage.content + contentChunk }] };
                }
            }
            return session;
        }));
    };

    const executeFunctionCall = async (fc: FunctionCall) => {
        const { name, args } = fc;
        let toolResponse;
        try {
            if (name === 'getGitHubFileContent') {
                const { repo, path } = args;
                addMessageToSession({ role: MessageRole.TOOL, content: `Reading file \`${path}\` from \`${repo}\`...` });
                const res = await fetch(`https://api.github.com/repos/${settings.githubUsername}/${repo}/contents/${path}`, { headers: { Accept: 'application/vnd.github.v3.raw', Authorization: `Bearer ${settings.githubPat}` } });
                if (!res.ok) throw new Error(`${res.status} - ${await res.text()}`);
                toolResponse = { content: await res.text() };
            } else if (name === 'listGitHubRepoContents') {
                const { repo, path } = args;
                addMessageToSession({ role: MessageRole.TOOL, content: `Listing contents of \`${path || './'}\` in \`${repo}\`...` });
                const res = await fetch(`https://api.github.com/repos/${settings.githubUsername}/${repo}/contents/${path}`, { headers: { Authorization: `Bearer ${settings.githubPat}` } });
                if (!res.ok) throw new Error(`${res.status} - ${await res.text()}`);
                const data = await res.json();
                toolResponse = { contents: data.map((item: any) => ({ name: item.name, type: item.type, path: item.path })) };
            } else if (name === 'createOrUpdateGitHubFile') {
                const { repo, path, content, commitMessage } = args;
                addMessageToSession({ role: MessageRole.TOOL, content: `Writing to file \`${path}\` in \`${repo}\`...` });
                const getFileRes = await fetch(`https://api.github.com/repos/${settings.githubUsername}/${repo}/contents/${path}`, { headers: { Authorization: `Bearer ${settings.githubPat}` } });
                const sha = getFileRes.ok ? (await getFileRes.json()).sha : undefined;
                
                const body = JSON.stringify({ message: commitMessage || settings.githubCommitMessage, content: btoa(unescape(encodeURIComponent(content as string))), sha });
                const putFileRes = await fetch(`https://api.github.com/repos/${settings.githubUsername}/${repo}/contents/${path}`, { method: 'PUT', headers: { Authorization: `Bearer ${settings.githubPat}` }, body });
                if (!putFileRes.ok) throw new Error(`GitHub Write Error: ${putFileRes.status} - ${await putFileRes.text()}`);
                toolResponse = { success: true, path: (await putFileRes.json()).content.path };
            }
            return { functionResponse: { name, response: toolResponse } };
        } catch (e: any) {
            addMessageToSession({ role: MessageRole.TOOL, content: `Error during \`${name}\`: ${e.message}` });
            return { functionResponse: { name, response: { error: e.message } } };
        }
    };

    const handleSendMessage = useCallback(async (prompt: string, file: File | null) => {
        if ((!prompt.trim() && !file) || isLoading || !activeSession) return;
        setIsLoading(true);
        setError(null);
        
        let userMessage = prompt;
        if (file) { userMessage = `${prompt}\n\n*Attachment: ${file.name}*`; }
        addMessageToSession({ role: MessageRole.USER, content: userMessage });
        addMessageToSession({ role: MessageRole.MODEL, content: '' });

        try {
            const currentProvider = activeSession.provider;
            
            if (currentProvider === 'gemini' && chatRef.current) {
                let messageToSend: string | (string | { inlineData: { mimeType: string; data: string; }; } | { text: string; })[];
                if (file) {
                    const supportedImageTypes = ['image/jpeg', 'image/png', 'image/webp'];

                    if (supportedImageTypes.includes(file.type)) {
                        const base64Data = await fileToBase64(file);
                        messageToSend = [{ text: prompt || "Describe this image." }, { inlineData: { mimeType: file.type, data: base64Data } }];
                    } else {
                        // Optimistically try to read any other file as text.
                        try {
                            // Limit file size to prevent excessively long prompts (e.g., 500 KB)
                            if (file.size > 500 * 1024) {
                                 throw new Error(`File size exceeds 500KB limit.`);
                            }
                            const fileContent = await readFileAsText(file);
                            messageToSend = `The user has uploaded a file named "${file.name}".\n\nFile content:\n\`\`\`\n${fileContent}\n\`\`\`\n\nUser's prompt about the file:\n${prompt}`;
                        } catch (e: any) {
                            // This will catch both file read errors and the size limit error.
                            console.error("File processing error:", e);
                            throw new Error(`Could not process "${file.name}". Please ensure it's a text-based file and under 500KB.`);
                        }
                    }
                } else {
                    messageToSend = prompt;
                }

                let isDone = false;
                while (!isDone) {
                    const result = await chatRef.current.sendMessageStream({ message: messageToSend });
                    let functionCalls: FunctionCall[] = [];
                    for await (const chunk of result) {
                        if (chunk.functionCalls) { functionCalls.push(...chunk.functionCalls); }
                        const parts = chunk.candidates?.[0]?.content?.parts || [];
                        let chunkContent = "";
                        for (const part of parts) {
                            if (part.text) {
                                chunkContent += part.text;
                            } else if (part.inlineData && part.inlineData.mimeType.startsWith('image/')) {
                                const { mimeType, data } = part.inlineData;
                                chunkContent += `\n\n![Generated Image](data:${mimeType};base64,${data})\n\n`;
                            }
                        }
                        if (chunkContent) { streamMessageContent(chunkContent); }
                    }

                    if (functionCalls.length > 0) {
                        const functionResponses = await Promise.all(functionCalls.map(executeFunctionCall));
                        messageToSend = functionResponses as any; 
                    } else {
                        isDone = true;
                    }
                }
            } else if (currentProvider === 'other') {
                if (file) { throw new Error("File uploads are only supported for the Gemini provider at this time."); }
                const { otherApiUrl, otherApiKey, otherModel } = settings;
                if (!otherApiUrl || !otherApiKey || !otherModel) { throw new Error("Other provider settings are incomplete."); }
                
                const apiMessages = (activeSession.messages || []).filter(m => m.role === MessageRole.USER || m.role === MessageRole.MODEL).map(({ role, content }) => ({ role, content }));
                const selectedPrompt = settings.prompts.find(p => p.id === settings.selectedPromptId);
                const systemInstruction = selectedPrompt?.prompt || DEFAULT_SYSTEM_INSTRUCTION;
                const systemMessage = { role: 'system', content: systemInstruction };
    
                const response = await fetch(otherApiUrl, { method: 'POST', headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${otherApiKey}` }, body: JSON.stringify({ model: otherModel, messages: [systemMessage, ...apiMessages], stream: false }) });
                if (!response.ok) { try { const errorData = await response.json(); throw new Error(errorData.error?.message || `API Error: ${response.status}`); } catch (e) { throw new Error(`API Error: ${response.status}`); } }
                const data = await response.json();
                const modelResponse = data.choices?.[0]?.message?.content?.trim() || "Sorry, I received an empty response.";
                streamMessageContent(modelResponse);
            } else if (currentProvider === 'codex') {
                if (file) { throw new Error("File uploads are not supported for the Codex provider."); }
                const { codexApiUrl, codexApiKey, codexModel, codexReasoningEffort } = settings;
                if (!codexApiUrl || !codexApiKey || !codexModel) { throw new Error("Codex provider settings are incomplete."); }

                const response = await fetch(codexApiUrl, { method: 'POST', headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${codexApiKey}` }, body: JSON.stringify({ model: codexModel, input: prompt, reasoning: { effort: codexReasoningEffort } }) });
                if (!response.ok) { try { const errorData = await response.json(); throw new Error(errorData.error?.message || `API Error: ${response.status}`); } catch (e) { throw new Error(`API Error: ${response.status}`); } }
                const data = await response.json();
                const modelResponse = data.output_text?.trim() || "Sorry, I received an empty response.";
                streamMessageContent(modelResponse);
            }
        } catch (e: any) {
            setError(e.message || "An error occurred.");
            setAllSessions(prev => prev.map(s => s.id === activeSessionId ? {...s, messages: s.messages.slice(0, -1)} : s));
        } finally {
            setIsLoading(false);
        }
    }, [isLoading, activeSession, settings, generateTitle, executeFunctionCall]);

    const handleSaveSettings = (newSettings: Settings) => {
        const updatedSettings = { ...settings, ...newSettings };
        setSettings(updatedSettings);
        
        const settingsToSave = { ...updatedSettings };
        if (!settingsToSave.saveApiKey) settingsToSave.apiKey = '';
        if (!settingsToSave.saveOtherApiKey) settingsToSave.otherApiKey = '';
        if (!settingsToSave.saveCodexApiKey) settingsToSave.codexApiKey = '';
        if (!settingsToSave.saveGithubPat) settingsToSave.githubPat = '';
        localStorage.setItem('app-settings', JSON.stringify(settingsToSave));
        
        setIsSettingsOpen(false);
    };

    const handleNewChat = () => {
        const provider = settings.activeProvider;
        const model = provider === 'gemini' 
            ? settings.model 
            : provider === 'other'
            ? settings.otherModel
            : settings.codexModel;

        if (!model) {
            setError("Please select a model in settings before starting a new chat.");
            setIsSettingsOpen(true);
            return;
        }

        const newSession: ChatSession = { id: `chat-${Date.now()}`, title: 'New Chat', messages: [], timestamp: Date.now(), model: model, provider: provider };
        setAllSessions(prev => [newSession, ...prev]);
        setActiveSessionId(newSession.id);
    };

    const handleDeleteChat = (sessionId: string) => {
        setAllSessions(prev => {
            const newSessions = prev.filter(s => s.id !== sessionId);
            if (activeSessionId === sessionId) {
                setActiveSessionId(newSessions.length > 0 ? newSessions[0].id : null);
            }
            return newSessions;
        });
    };
    
    const handleRenameChat = (sessionId: string, newTitle: string) => {
        setAllSessions(prev => prev.map(s => s.id === sessionId ? { ...s, title: newTitle } : s));
    };
    
    const handleExportData = () => {
        try {
            const dataToExport = { settings, allSessions };
            const jsonString = JSON.stringify(dataToExport, null, 2);
            const blob = new Blob([jsonString], { type: 'application/json' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `google-scripts-assistant-backup-${new Date().toISOString().split('T')[0]}.json`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
        } catch (e) {
            setError("Failed to export data.");
            console.error("Export error:", e);
        }
    };

    const handleImportData = (data: { settings: Settings; allSessions: ChatSession[] }) => {
        try {
            if (data.settings && Array.isArray(data.allSessions)) {
                setSettings(data.settings);
                setAllSessions(data.allSessions.sort((a, b) => b.timestamp - a.timestamp));
                localStorage.setItem('app-settings', JSON.stringify(data.settings));
                localStorage.setItem('chat-sessions', JSON.stringify(data.allSessions));
                setActiveSessionId(null); // Reset active session
                setIsSettingsOpen(false);
                alert("Import successful! Your chats and settings have been restored.");
            } else {
                throw new Error("Invalid file format.");
            }
        } catch (e: any) {
            setError(`Import failed: ${e.message}`);
            console.error("Import error:", e);
        }
    };

    const handleToggleFullscreen = () => {
        if (!document.fullscreenElement) {
            document.documentElement.requestFullscreen().catch((err) => {
                console.error(`Error attempting to enable full-screen mode: ${err.message} (${err.name})`);
            });
        } else {
            if (document.exitFullscreen) {
                document.exitFullscreen();
            }
        }
    };

    const handleAttachClick = () => {
        if (isFullscreen) {
            wasInFullscreenBeforeAttach.current = true;
        }
    };

    const isConfigured = settings.activeProvider === 'gemini' 
        ? !!settings.apiKey 
        : settings.activeProvider === 'other'
        ? (!!settings.otherApiKey && !!settings.otherApiUrl && !!settings.otherModel)
        : (!!settings.codexApiKey && !!settings.codexApiUrl && !!settings.codexModel);
    const isGithubConfigured = !!(settings.githubUsername && settings.githubPat);

    return (
        <div className="flex h-screen bg-gray-900 text-gray-200 font-sans">
            <div className={`flex-shrink-0 transition-all duration-300 ease-in-out border-r ${isSidebarVisible ? 'w-72 border-gray-700' : 'w-0 border-transparent'}`}>
                <div className="w-72 h-full overflow-hidden">
                    <HistorySidebar sessions={allSessions} activeSessionId={activeSessionId} onNewChat={handleNewChat} onSelectChat={setActiveSessionId} onDeleteChat={handleDeleteChat} onRenameChat={handleRenameChat} />
                </div>
            </div>
            
            <div className="flex flex-col flex-1 relative min-w-0">
                <button
                    onClick={() => setIsSidebarVisible(!isSidebarVisible)}
                    className="absolute top-1/2 -ml-4 z-20 transform -translate-y-1/2 bg-gray-800 p-1.5 rounded-full border border-gray-600 text-gray-400 hover:text-white hover:bg-green-600 focus:outline-none focus:ring-2 focus:ring-green-500 transition-all"
                    aria-label={isSidebarVisible ? 'Hide sidebar' : 'Show sidebar'}
                >
                    {isSidebarVisible ? <ChevronLeftIcon className="w-5 h-5" /> : <ChevronRightIcon className="w-5 h-5" />}
                </button>

                 <header className="bg-gray-800/50 backdrop-blur-sm border-b border-gray-700 p-4 flex items-center justify-between shadow-lg z-10">
                    <div className="flex items-center gap-3"><LogoIcon className="w-8 h-8 text-green-400" /> {settings.appTitle && <h1 className="text-xl font-bold tracking-wider text-gray-100">{settings.appTitle}</h1>}</div>
                    <div className="flex items-center gap-2">
                         {isConfigured && activeSession && (
                            <div className="hidden sm:flex items-center gap-2 text-xs text-gray-400 bg-gray-700/50 px-3 py-1 rounded-full border border-gray-600">
                                <span>Chat Model:</span>
                                <span className="font-semibold text-gray-300">{activeSession.model}</span>
                            </div>
                        )}
                        <button onClick={() => isGithubConfigured && setIsGithubModeActive(!isGithubModeActive)} disabled={!isGithubConfigured} title={isGithubConfigured ? "Toggle GitHub Mode" : "Configure GitHub integration in settings"} className={`flex items-center gap-2 px-3 py-2 text-sm font-bold rounded-md transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${isGithubModeActive ? 'bg-green-600 text-white' : 'bg-gray-700 hover:bg-gray-600'}`}>
                            <GitHubIcon className="w-5 h-5"/>
                            <span className="hidden md:inline">GitHub Mode</span>
                        </button>
                        <button onClick={handleToggleFullscreen} className="p-2 rounded-full hover:bg-gray-700 transition-colors" aria-label={isFullscreen ? 'Exit fullscreen' : 'Enter fullscreen'}>
                            {isFullscreen ? <MinimizeIcon className="w-6 h-6 text-gray-400" /> : <MaximizeIcon className="w-6 h-6 text-gray-400" />}
                        </button>
                        <button onClick={() => setIsSettingsOpen(true)} className="p-2 rounded-full hover:bg-gray-700 transition-colors" aria-label="Open settings"><SettingsIcon className="w-6 h-6 text-gray-400" /></button>
                    </div>
                </header>
                <main ref={mainContentRef} className="flex-1 overflow-y-auto relative">
                    {showReEnterFullscreenPrompt && (
                        <div className="sticky top-0 z-10 bg-yellow-900/80 backdrop-blur-sm text-yellow-100 text-center p-2 text-sm flex items-center justify-center gap-4" role="alert">
                            <span>You've exited fullscreen mode to attach a file.</span>
                            <button 
                                onClick={handleToggleFullscreen}
                                className="bg-yellow-600 hover:bg-yellow-500 text-white font-bold py-1 px-3 rounded-md transition-colors"
                            >
                                Re-enter Fullscreen
                            </button>
                            <button onClick={() => setShowReEnterFullscreenPrompt(false)} className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-yellow-300 hover:text-white" aria-label="Dismiss">
                                <CloseIcon className="w-5 h-5" />
                            </button>
                        </div>
                    )}
                    <ChatWindow messages={activeSession?.messages || []} isConfigured={isConfigured} onOpenSettings={() => setIsSettingsOpen(true)} hasActiveSession={!!activeSessionId} onNewChat={handleNewChat} />
                </main>
                {error && (<div className="px-4 py-2 bg-red-800 text-white text-center text-sm" onClick={() => setError(null)}>{error}</div>)}
                <footer className="p-4 bg-gray-900/80 backdrop-blur-sm border-t border-gray-700"><InputBar onSend={handleSendMessage} isLoading={isLoading} disabled={!isConfigured || !activeSessionId} onAttachClick={handleAttachClick} /></footer>
            </div>
            <SettingsModal isOpen={isSettingsOpen} onClose={() => setIsSettingsOpen(false)} onSave={handleSaveSettings} currentSettings={settings} onExport={handleExportData} onImport={handleImportData}/>
        </div>
    );
};

export default App;