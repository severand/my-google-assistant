
import React, { useState, useEffect, useRef } from 'react';
import { Settings, Prompt, ReasoningEffort, ChatSession } from '../types';
import { PREDEFINED_MODELS, DEFAULT_SYSTEM_INSTRUCTION } from '../constants';
import { CloseIcon, CheckIcon, InfoIcon, LogoIcon, CloudIcon, GitHubIcon, ListIcon, PlusIcon, EditIcon, TrashIcon, CodeIcon, UploadIcon, DownloadIcon } from './icons';
import { GoogleGenAI } from '@google/genai';
import { readFileAsText } from '../utils/file';


interface SettingsModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSave: (settings: Settings) => void;
    currentSettings: Settings;
    onExport: () => void;
    // FIX: Updated the type for `allSessions` to `ChatSession[]` to match the current flat data structure.
    onImport: (data: { settings: Settings; allSessions: ChatSession[] }) => void;
}

type TestStatus = 'idle' | 'testing' | 'success' | 'error';
type Tab = 'gemini' | 'other' | 'codex' | 'github' | 'prompts';

export const SettingsModal: React.FC<SettingsModalProps> = ({ isOpen, onClose, onSave, currentSettings, onExport, onImport }) => {
    const [settings, setSettings] = useState<Settings>(currentSettings);
    const [useCustomModel, setUseCustomModel] = useState(false);
    const [testStatus, setTestStatus] = useState<TestStatus>('idle');
    const [testError, setTestError] = useState('');
    const [activeTab, setActiveTab] = useState<Tab>('gemini');
    const importFileRef = useRef<HTMLInputElement>(null);
    
    // State for prompt editing
    const [editingPrompt, setEditingPrompt] = useState<Prompt | null>(null);

    useEffect(() => {
        const newSettings = { ...currentSettings };
        if (!newSettings.prompts) newSettings.prompts = [];
        if (newSettings.prompts.length === 0) {
            const defaultPrompt = { id: `prompt-${Date.now()}`, name: 'Google Scripts Assistant (Default)', prompt: DEFAULT_SYSTEM_INSTRUCTION };
            newSettings.prompts.push(defaultPrompt);
            if (!newSettings.selectedPromptId) {
                newSettings.selectedPromptId = defaultPrompt.id;
            }
        }
        setSettings(newSettings);
        setActiveTab('gemini');
        setTestStatus('idle');
        setTestError('');
        setEditingPrompt(null);
        if (currentSettings.model && !PREDEFINED_MODELS.includes(currentSettings.model)) {
            setUseCustomModel(true);
        }
    }, [currentSettings, isOpen]);

    const handleSave = () => {
        onSave(settings);
    };
    
    const handleImportClick = () => {
        importFileRef.current?.click();
    };

    const handleFileImport = async (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (!file) return;

        try {
            const text = await readFileAsText(file);
            const data = JSON.parse(text);
            // Basic validation
            if (typeof data === 'object' && data !== null && 'settings' in data && 'allSessions' in data) {
                onImport(data);
            } else {
                throw new Error("Invalid backup file format.");
            }
        } catch (e: any) {
            alert(`Error importing file: ${e.message}`);
        } finally {
            // Reset file input
            if (importFileRef.current) {
                importFileRef.current.value = '';
            }
        }
    };


    const handleTestConnection = async () => {
        setTestStatus('testing');
        setTestError('');
        try {
            if (activeTab === 'gemini') {
                if (!settings.apiKey) throw new Error("API Key is required.");
                const ai = new GoogleGenAI({ apiKey: settings.apiKey });
                await ai.models.generateContent({ model: settings.model, contents: "hello" });
            } else if (activeTab === 'other') {
                if (!settings.otherApiKey || !settings.otherApiUrl || !settings.otherModel) throw new Error("API URL, Key, and Model are required.");
                const response = await fetch(settings.otherApiUrl, { method: 'POST', headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${settings.otherApiKey}`}, body: JSON.stringify({ model: settings.otherModel, messages: [{ role: 'user', content: 'hello' }]})});
                if (!response.ok) { const errorData = await response.json(); throw new Error(errorData.error?.message || `Request failed with status ${response.status}`); }
            } else if (activeTab === 'codex') {
                if (!settings.codexApiKey || !settings.codexApiUrl || !settings.codexModel) throw new Error("API URL, Key, and Model are required.");
                const response = await fetch(settings.codexApiUrl, { method: 'POST', headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${settings.codexApiKey}`}, body: JSON.stringify({ model: settings.codexModel, input: "hello", reasoning: { effort: settings.codexReasoningEffort } })});
                if (!response.ok) { const errorData = await response.json(); throw new Error(errorData.error?.message || `Request failed with status ${response.status}`); }
            } else if (activeTab === 'github') {
                if (!settings.githubUsername || !settings.githubPat) throw new Error("GitHub Username and Personal Access Token are required.");
                const response = await fetch(`https://api.github.com/users/${settings.githubUsername}`, { headers: { Authorization: `Bearer ${settings.githubPat}`}});
                if (!response.ok) throw new Error(`GitHub API Error: ${response.status} - ${response.statusText}. Check username and token permissions.`);
            }
            setTestStatus('success');
        } catch (e: any) {
            setTestStatus('error');
            setTestError(e.message || 'An unknown error occurred.');
        } finally {
            setTimeout(() => setTestStatus('idle'), 3000);
        }
    };
    
    const handleAddNewPrompt = () => { setEditingPrompt({ id: '', name: '', prompt: '' }); };
    
    const handleSavePrompt = () => {
        if (!editingPrompt || !editingPrompt.name.trim() || !editingPrompt.prompt.trim()) return;
        const newPrompts = [...settings.prompts];
        if (editingPrompt.id) { // Update existing
            const index = newPrompts.findIndex(p => p.id === editingPrompt.id);
            if (index > -1) newPrompts[index] = editingPrompt;
        } else { // Add new
            newPrompts.push({ ...editingPrompt, id: `prompt-${Date.now()}` });
        }
        setSettings({ ...settings, prompts: newPrompts });
        setEditingPrompt(null);
    };

    const handleDeletePrompt = (promptId: string) => {
        if (window.confirm('Are you sure you want to delete this prompt?')) {
            const newPrompts = settings.prompts.filter(p => p.id !== promptId);
            let newSelectedId = settings.selectedPromptId;
            if (settings.selectedPromptId === promptId) {
                newSelectedId = newPrompts.length > 0 ? newPrompts[0].id : null;
            }
            setSettings({ ...settings, prompts: newPrompts, selectedPromptId: newSelectedId });
        }
    };

    if (!isOpen) return null;

    const renderTestButtonContent = () => {
        switch (testStatus) {
            case 'testing': return (<span className="flex items-center gap-2"><svg className="animate-spin h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>Testing...</span>);
            case 'success': return (<span className="flex items-center gap-2"><CheckIcon className="w-5 h-5" />Success!</span>);
            case 'error': return 'Test Failed';
            default: return 'Test Connection';
        }
    };
    
    const TestButton = () => (<div className="flex justify-end mt-4"><button onClick={handleTestConnection} disabled={testStatus === 'testing'} className={`px-4 py-2 text-sm font-bold rounded-md transition-colors disabled:opacity-50 ${testStatus === 'success' ? 'bg-green-600' : testStatus === 'error' ? 'bg-red-600' : 'bg-gray-600 hover:bg-gray-500'} text-white`}>{renderTestButtonContent()}</button></div>);
    const TabButton: React.FC<{ tab: Tab; icon: React.ReactNode; label: string }> = ({ tab, icon, label }) => (<button onClick={() => { setActiveTab(tab); setTestStatus('idle'); setTestError(''); }} className={`flex-1 flex items-center justify-center gap-2 px-4 py-2 text-sm font-bold rounded-md transition-colors ${ activeTab === tab ? 'bg-green-600 text-white' : 'bg-gray-700 hover:bg-gray-600' }`}>{icon} {label}</button>);

    return (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50">
            <div className="bg-gray-800 rounded-lg shadow-2xl w-full max-w-2xl border border-gray-700 m-4 flex flex-col" onClick={e => e.stopPropagation()}>
                <header className="flex items-center justify-between p-4 border-b border-gray-700"><h2 className="text-xl font-bold text-gray-100">Settings</h2><button onClick={onClose} className="p-1 rounded-full hover:bg-gray-700"><CloseIcon className="w-6 h-6 text-gray-400" /></button></header>
                <div className="p-6 flex-grow overflow-y-auto max-h-[70vh]">
                    <div className="p-1 bg-gray-900 rounded-lg flex gap-1 mb-6">
                        <TabButton tab="gemini" icon={<LogoIcon className="w-5 h-5" />} label="Gemini" />
                        <TabButton tab="other" icon={<CloudIcon className="w-5 h-5" />} label="Other Provider" />
                        <TabButton tab="codex" icon={<CodeIcon className="w-5 h-5" />} label="Codex" />
                        <TabButton tab="github" icon={<GitHubIcon className="w-5 h-5" />} label="GitHub" />
                        <TabButton tab="prompts" icon={<ListIcon className="w-5 h-5" />} label="Prompts" />
                    </div>

                    {activeTab === 'gemini' && ( 
                        <div className="space-y-6">
                            <div><label htmlFor="apiKey" className="block text-sm font-medium text-gray-300 mb-1">Gemini API Key</label><input id="apiKey" type="password" value={settings.apiKey} onChange={e => setSettings({ ...settings, apiKey: e.target.value })} className="w-full px-3 py-2 bg-gray-900 border border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-green-500 text-gray-200" placeholder="Enter your Gemini API Key"/><div className="mt-2 text-sm"><label className="flex items-center gap-2 text-gray-400"><input type="checkbox" checked={settings.saveApiKey} onChange={e => setSettings({ ...settings, saveApiKey: e.target.checked })} className="h-4 w-4 rounded border-gray-300 text-green-600 bg-gray-700 focus:ring-green-500"/> Сохранить API ключ</label></div><p className="mt-2 text-xs text-gray-400">Получите ключ в <a href="https://aistudio.google.com/keys" target="_blank" rel="noopener noreferrer" className="text-green-400 underline hover:text-green-300">Google AI Studio</a>.</p></div>
                            <div className="p-4 bg-gray-900/50 rounded-lg border border-gray-700 flex items-start gap-4"><InfoIcon className="w-5 h-5 text-blue-400 flex-shrink-0 mt-0.5" /><div><h4 className="font-bold text-gray-200 text-sm">Информация о лимитах</h4><p className="text-xs text-gray-400 mt-1">Бесплатные ключи имеют лимит в 60 запросов в минуту (RPM). Если вы столкнулись с ошибкой, просто подождите минуту.</p></div></div>
                            <div><label htmlFor="model" className="block text-sm font-medium text-gray-300 mb-1">Model</label>{!useCustomModel ? <select id="model" value={settings.model} onChange={e => setSettings({ ...settings, model: e.target.value })} className="w-full px-3 py-2 bg-gray-900 border border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-green-500 text-gray-200">{PREDEFINED_MODELS.map(m => <option key={m} value={m}>{m}</option>)}</select> : <input type="text" value={settings.model} onChange={e => setSettings({ ...settings, model: e.target.value })} className="w-full px-3 py-2 bg-gray-900 border border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-green-500 text-gray-200" placeholder="Enter custom model name"/>}<div className="mt-2 text-sm"><label className="flex items-center gap-2 text-gray-400"><input type="checkbox" checked={useCustomModel} onChange={e => setUseCustomModel(e.target.checked)} className="h-4 w-4 rounded border-gray-300 text-green-600 bg-gray-700 focus:ring-green-500"/> Использовать свою модель</label></div></div>
                             <TestButton />
                            <div><label htmlFor="systemInstruction" className="block text-sm font-medium text-gray-300 mb-1">Системный промпт</label><select id="systemInstruction" value={settings.selectedPromptId || ''} onChange={e => setSettings({ ...settings, selectedPromptId: e.target.value })} className="w-full px-3 py-2 bg-gray-900 border border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-green-500 text-gray-200">{settings.prompts.map(p => (<option key={p.id} value={p.id}>{p.name}</option>))}</select></div>
                        </div>
                    )}
                    {activeTab === 'other' && (
                        <div className="space-y-6">
                            <div><label htmlFor="otherApiUrl" className="block text-sm font-medium text-gray-300 mb-1">URL эндпоинта API</label><input id="otherApiUrl" type="text" value={settings.otherApiUrl} onChange={e => setSettings({ ...settings, otherApiUrl: e.target.value })} className="w-full px-3 py-2 bg-gray-900 border border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-green-500 text-gray-200" placeholder="https://api.example.com/v1/chat/completions"/><p className="mt-2 text-xs text-gray-400">Укажите полный URL для API (OpenAI-compatible).</p></div>
                            <div><label htmlFor="otherApiKey" className="block text-sm font-medium text-gray-300 mb-1">API Key</label><input id="otherApiKey" type="password" value={settings.otherApiKey} onChange={e => setSettings({ ...settings, otherApiKey: e.target.value })} className="w-full px-3 py-2 bg-gray-900 border border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-green-500 text-gray-200" placeholder="Enter your API Key"/><div className="mt-2 text-sm"><label className="flex items-center gap-2 text-gray-400"><input type="checkbox" checked={settings.saveOtherApiKey} onChange={e => setSettings({ ...settings, saveOtherApiKey: e.target.checked })} className="h-4 w-4 rounded border-gray-300 text-green-600 bg-gray-700 focus:ring-green-500"/> Сохранить API ключ</label></div></div>
                            <div><label htmlFor="otherModel" className="block text-sm font-medium text-gray-300 mb-1">Имя модели</label><input id="otherModel" type="text" value={settings.otherModel} onChange={e => setSettings({ ...settings, otherModel: e.target.value })} className="w-full px-3 py-2 bg-gray-900 border border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-green-500 text-gray-200" placeholder="e.g., gpt-4, mistral-large"/></div>
                            <TestButton />
                            <div><label htmlFor="otherSystemInstruction" className="block text-sm font-medium text-gray-300 mb-1">Системный промпт</label><select id="otherSystemInstruction" value={settings.selectedPromptId || ''} onChange={e => setSettings({ ...settings, selectedPromptId: e.target.value })} className="w-full px-3 py-2 bg-gray-900 border border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-green-500 text-gray-200">{settings.prompts.map(p => (<option key={p.id} value={p.id}>{p.name}</option>))}</select></div>
                        </div>
                    )}
                    {activeTab === 'codex' && (
                        <div className="space-y-6">
                            <div className="p-4 bg-yellow-900/50 rounded-lg border border-yellow-700 flex items-start gap-4">
                                <InfoIcon className="w-5 h-5 text-yellow-400 flex-shrink-0 mt-0.5" />
                                <div>
                                    <h4 className="font-bold text-yellow-200 text-sm">Важная информация о провайдере Codex</h4>
                                    <p className="text-xs text-yellow-300 mt-1">
                                        Эта вкладка предназначена для подключения к API со <strong>специфической структурой запроса</strong>, которую вы предоставили (`{"input": "...", "reasoning": "..."}`). 
                                        Она <strong>несовместима</strong> со стандартными эндпоинтами OpenAI (`/v1/chat/completions`). Пожалуйста, укажите URL эндпоинта, который ожидает именно такой формат.
                                    </p>
                                </div>
                            </div>
                            <div>
                                <label htmlFor="codexApiUrl" className="block text-sm font-medium text-gray-300 mb-1">API Endpoint URL</label>
                                <input id="codexApiUrl" type="text" value={settings.codexApiUrl} onChange={e => setSettings({ ...settings, codexApiUrl: e.target.value })} className="w-full px-3 py-2 bg-gray-900 border border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-green-500 text-gray-200" placeholder="https://your-custom-api.com/v1/responses" />
                            </div>
                            <div>
                                <label htmlFor="codexApiKey" className="block text-sm font-medium text-gray-300 mb-1">API Key</label>
                                <input id="codexApiKey" type="password" value={settings.codexApiKey} onChange={e => setSettings({ ...settings, codexApiKey: e.target.value })} className="w-full px-3 py-2 bg-gray-900 border border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-green-500 text-gray-200" placeholder="Enter your API Key"/>
                                <div className="mt-2 text-sm">
                                    <label className="flex items-center gap-2 text-gray-400">
                                        <input type="checkbox" checked={settings.saveCodexApiKey} onChange={e => setSettings({ ...settings, saveCodexApiKey: e.target.checked })} className="h-4 w-4 rounded border-gray-300 text-green-600 bg-gray-700 focus:ring-green-500"/> Сохранить API ключ
                                    </label>
                                </div>
                            </div>
                            <div>
                                <label htmlFor="codexModel" className="block text-sm font-medium text-gray-300 mb-1">Model Name</label>
                                <input id="codexModel" type="text" value={settings.codexModel} onChange={e => setSettings({ ...settings, codexModel: e.target.value })} className="w-full px-3 py-2 bg-gray-900 border border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-green-500 text-gray-200" placeholder="e.g., gpt-5.1-codex-max"/>
                            </div>
                            <div>
                                <label htmlFor="codexReasoningEffort" className="block text-sm font-medium text-gray-300 mb-1">Reasoning Effort</label>
                                <select id="codexReasoningEffort" value={settings.codexReasoningEffort} onChange={e => setSettings({ ...settings, codexReasoningEffort: e.target.value as ReasoningEffort })} className="w-full px-3 py-2 bg-gray-900 border border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-green-500 text-gray-200">
                                    <option value="low">Low</option>
                                    <option value="medium">Medium</option>
                                    <option value="high">High</option>
                                </select>
                                <p className="mt-2 text-xs text-gray-400">This setting corresponds to the `reasoning: { "effort": "..." }` parameter in the API call.</p>
                            </div>
                            <TestButton />
                        </div>
                    )}
                    {activeTab === 'github' && (
                        <div className="space-y-6">
                            <div><label htmlFor="githubUsername" className="block text-sm font-medium text-gray-300 mb-1">GitHub Username</label><input id="githubUsername" type="text" value={settings.githubUsername} onChange={e => setSettings({ ...settings, githubUsername: e.target.value })} className="w-full px-3 py-2 bg-gray-900 border border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-green-500 text-gray-200" placeholder="Your GitHub username"/></div>
                            <div><label htmlFor="githubPat" className="block text-sm font-medium text-gray-300 mb-1">Personal Access Token (Classic)</label><input id="githubPat" type="password" value={settings.githubPat} onChange={e => setSettings({ ...settings, githubPat: e.target.value })} className="w-full px-3 py-2 bg-gray-900 border border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-green-500 text-gray-200" placeholder="ghp_..."/>
                                <div className="mt-2 text-sm"><label className="flex items-center gap-2 text-gray-400"><input type="checkbox" checked={settings.saveGithubPat} onChange={e => setSettings({ ...settings, saveGithubPat: e.target.checked })} className="h-4 w-4 rounded border-gray-300 text-green-600 bg-gray-700 focus:ring-green-500"/> Сохранить токен</label></div>
                                <p className="mt-2 text-xs text-gray-400">Создайте токен <a href="https://github.com/settings/tokens/new" target="_blank" rel="noopener noreferrer" className="text-green-400 underline hover:text-green-300">здесь</a>. Для доступа к репозиториям предоставьте права `repo`.</p>
                            </div>
                            <TestButton />
                            <div className="p-4 bg-yellow-900/50 rounded-lg border border-yellow-700 flex items-start gap-4"><InfoIcon className="w-5 h-5 text-yellow-400 flex-shrink-0 mt-0.5" /><div><h4 className="font-bold text-yellow-200 text-sm">Предупреждение о безопасности</h4><p className="text-xs text-yellow-300 mt-1">Ваш Personal Access Token — это как пароль. Обращайтесь с ним осторожно. Он будет сохранен в `localStorage` вашего браузера, если вы выберете опцию "Сохранить".</p></div></div>
                            <div><label htmlFor="githubCommitMessage" className="block text-sm font-medium text-gray-300 mb-1">Сообщение коммита по умолчанию</label><input id="githubCommitMessage" type="text" value={settings.githubCommitMessage} onChange={e => setSettings({ ...settings, githubCommitMessage: e.target.value })} className="w-full px-3 py-2 bg-gray-900 border border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-green-500 text-gray-200"/></div>
                            <div><label htmlFor="githubInstructions" className="block text-sm font-medium text-gray-300 mb-1">Инструкции для работы с GitHub</label><textarea id="githubInstructions" rows={4} value={settings.githubInstructions} onChange={e => setSettings({ ...settings, githubInstructions: e.target.value })} className="w-full px-3 py-2 bg-gray-900 border border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-green-500 text-gray-200 font-mono text-sm" placeholder="e.g., Always create new files in the 'src/' directory..."/></div>
                        </div>
                    )}
                    {activeTab === 'prompts' && (
                        <div className="space-y-4">
                            <div className="flex justify-between items-center">
                                <h3 className="text-lg font-bold text-gray-200">Библиотека промптов</h3>
                                <button onClick={handleAddNewPrompt} className="flex items-center gap-2 px-3 py-1 text-sm font-bold bg-green-600 text-white rounded-md hover:bg-green-700"><PlusIcon className="w-4 h-4" /> Новый промпт</button>
                            </div>
                            {editingPrompt && (
                                <div className="p-4 bg-gray-900 rounded-lg space-y-4 border border-gray-700">
                                    <h4 className="font-bold text-gray-200">{editingPrompt.id ? 'Редактировать промпт' : 'Новый промпт'}</h4>
                                    <div><label htmlFor="promptName" className="block text-sm font-medium text-gray-300 mb-1">Название</label><input id="promptName" type="text" value={editingPrompt.name} onChange={e => setEditingPrompt({ ...editingPrompt, name: e.target.value })} className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-green-500 text-gray-200"/></div>
                                    <div><label htmlFor="promptContent" className="block text-sm font-medium text-gray-300 mb-1">Текст промпта</label><textarea id="promptContent" rows={6} value={editingPrompt.prompt} onChange={e => setEditingPrompt({ ...editingPrompt, prompt: e.target.value })} className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-green-500 text-gray-200 font-mono text-sm"/></div>
                                    <div className="flex justify-end gap-2"><button onClick={() => setEditingPrompt(null)} className="px-3 py-1 text-sm font-bold bg-gray-600 text-gray-200 rounded-md hover:bg-gray-500">Отмена</button><button onClick={handleSavePrompt} className="px-3 py-1 text-sm font-bold bg-green-600 text-white rounded-md hover:bg-green-700">Сохранить</button></div>
                                </div>
                            )}
                            <div className="space-y-2">
                                {settings.prompts.map(p => (
                                    <div key={p.id} className={`p-3 rounded-lg flex items-center justify-between transition-colors ${settings.selectedPromptId === p.id ? 'bg-green-900/50 border border-green-700' : 'bg-gray-900/50'}`}>
                                        <div className="flex items-center gap-3"><input type="radio" name="selectedPrompt" checked={settings.selectedPromptId === p.id} onChange={() => setSettings({...settings, selectedPromptId: p.id})} className="h-4 w-4 text-green-600 bg-gray-700 border-gray-600 focus:ring-green-500"/><span className="font-semibold text-gray-200">{p.name}</span></div>
                                        <div className="flex items-center gap-2"><button onClick={() => setEditingPrompt(p)} className="p-1 text-gray-400 hover:text-white"><EditIcon className="w-4 h-4"/></button><button onClick={() => handleDeletePrompt(p.id)} className="p-1 text-gray-400 hover:text-red-400"><TrashIcon className="w-4 h-4"/></button></div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}
                    
                    <div className="border-t border-gray-700 pt-6 mt-6 space-y-4">
                        <h3 className="text-lg font-bold text-gray-200">Общие настройки</h3>
                        <div>
                            <label htmlFor="appTitle" className="block text-sm font-medium text-gray-300 mb-1">Заголовок приложения</label>
                            <input id="appTitle" type="text" value={settings.appTitle} onChange={e => setSettings({ ...settings, appTitle: e.target.value })} className="w-full px-3 py-2 bg-gray-900 border border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-green-500 text-gray-200"/>
                            <p className="mt-2 text-xs text-gray-400">Оставьте пустым, чтобы скрыть заголовок.</p>
                        </div>
                        <div>
                            <label className="flex items-center justify-between text-sm font-medium text-gray-300"><span>Автоматически создавать заголовки чатов (только для Gemini)</span><input type="checkbox" checked={settings.generateTitle} onChange={e => setSettings({ ...settings, generateTitle: e.target.checked })} className="h-4 w-4 rounded border-gray-300 text-green-600 bg-gray-700 focus:ring-green-500"/></label>
                            <p className="mt-2 text-xs text-gray-400">При включении, для каждого нового чата делается дополнительный запрос к API Gemini для создания заголовка.</p>
                        </div>
                        <div className="border-t border-gray-700 pt-4">
                             <h4 className="text-md font-bold text-gray-200 mb-2">Управление данными</h4>
                             <p className="text-xs text-gray-400 mb-4">Сохраните резервную копию всех ваших чатов и настроек в один файл или восстановите их из ранее сохраненного файла.</p>
                             <div className="flex gap-4">
                                <input type="file" accept=".json" ref={importFileRef} onChange={handleFileImport} className="hidden" />
                                <button onClick={handleImportClick} className="flex-1 flex items-center justify-center gap-2 px-4 py-2 text-sm font-bold bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors">
                                    <UploadIcon className="w-5 h-5"/>
                                    <span>Импорт данных</span>
                                </button>
                                <button onClick={onExport} className="flex-1 flex items-center justify-center gap-2 px-4 py-2 text-sm font-bold bg-gray-600 text-white rounded-md hover:bg-gray-500 transition-colors">
                                    <DownloadIcon className="w-5 h-5"/>
                                    <span>Экспорт данных</span>
                                </button>
                             </div>
                        </div>

                    </div>
                    {testStatus === 'error' && activeTab !== 'prompts' && <div className="mt-4 text-red-400 text-sm p-3 bg-red-900/50 rounded-md"><strong>Ошибка:</strong> {testError}</div>}
                </div>
                <footer className="flex items-center justify-end p-4 border-t border-gray-700 bg-gray-800/50">
                    <div className="flex gap-2"><button onClick={onClose} className="px-4 py-2 text-sm font-bold bg-gray-700 text-gray-200 rounded-md hover:bg-gray-600">Отмена</button><button onClick={handleSave} className="px-4 py-2 text-sm font-bold bg-green-600 text-white rounded-md hover:bg-green-700">Сохранить</button></div>
                </footer>
            </div>
        </div>
    );
};