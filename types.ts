
export enum MessageRole {
    USER = 'user',
    MODEL = 'model',
    TOOL = 'tool', // New role for tool status messages
}

export interface ChatMessage {
    role: MessageRole;
    content: string;
}

export interface Prompt {
    id: string;
    name: string;
    prompt: string;
}

export type ReasoningEffort = 'low' | 'medium' | 'high';

export interface Settings {
    // General settings
    appTitle: string;
    generateTitle: boolean;
    prompts: Prompt[];
    selectedPromptId: string | null;

    // Gemini settings
    apiKey: string;
    saveApiKey: boolean;
    model: string;
    
    // Active provider
    activeProvider: 'gemini' | 'other' | 'codex';

    // Other provider settings
    otherApiKey: string;
    saveOtherApiKey: boolean;
    otherModel: string;
    otherApiUrl: string;

    // Codex provider settings
    codexApiKey: string;
    saveCodexApiKey: boolean;
    codexModel: string;
    codexApiUrl: string;
    codexReasoningEffort: ReasoningEffort;

    // GitHub Integration settings
    githubUsername: string;
    githubPat: string;
    saveGithubPat: boolean;
    githubCommitMessage: string;
    githubInstructions: string;
}

export interface ChatSession {
    id: string;
    title: string;
    messages: ChatMessage[];
    timestamp: number;
    model: string; // The specific model used for this chat
    provider: 'gemini' | 'other' | 'codex'; // The provider used
}