import { useState, useEffect } from "react";
import { type ParsedItem, type ParsedData, parseXML } from "@/lib/xml-utils";

// 单个文件的数据结构
export interface FileData {
    fileName: string;
    xmlContent: string;
    parsedItems: ParsedItem[];
    translations: Record<string, string>;
}

export interface ProjectState {
    files: FileData[];
    // 兼容性：合并所有文件的 items 和 translations
    allParsedItems: ParsedItem[];
    allTranslations: Record<string, string>;
    settings: ProjectSettings;
    isLoading: boolean;
    addFiles: (filesData: { fileName: string; content: string }[]) => Promise<void>;
    updateTranslation: (id: string, value: string) => void;
    updateSettings: (settings: Partial<ProjectSettings>) => void;
    clearProject: () => void;
    clearTranslations: () => void;
    // 导出单个文件
    getFileExportData: (fileIndex: number) => { fileName: string; xmlContent: string; translations: Record<string, string> } | null;
}

export interface ProjectSettings {
    apiKey: string;
    apiBaseUrl: string;
    model: string;
    batchSize: number;
    manualBatchSize: number;
    customPrompt: string;
    manualPrompt: string;
}

export const DEFAULT_PROMPT = `你是一个专业的游戏翻译器。请将以下 JSON 中的值翻译成简体中文。

要求：
1. 保持 JSON 键名不变
2. 只翻译值的内容
3. 保持游戏术语的一致性
4. 返回有效的 JSON 格式`;

const STORAGE_KEY = "sims4-translator-project";

export function useProjectState(): ProjectState {
    const [isHydrated, setIsHydrated] = useState(false);
    const [files, setFiles] = useState<FileData[]>([]);
    const [settings, setSettings] = useState<ProjectSettings>({
        apiKey: "",
        apiBaseUrl: "https://api.openai.com/v1",
        model: "gpt-3.5-turbo",
        batchSize: 10,
        manualBatchSize: 50,
        customPrompt: DEFAULT_PROMPT,
        manualPrompt: DEFAULT_PROMPT,
    });

    // 计算合并后的 items 和 translations
    const allParsedItems = files.flatMap(f => f.parsedItems);
    const allTranslations = files.reduce<Record<string, string>>((acc, file) => {
        return { ...acc, ...file.translations };
    }, {});

    // Hydrate from localStorage
    useEffect(() => {
        try {
            const stored = localStorage.getItem(STORAGE_KEY);
            if (stored) {
                const data = JSON.parse(stored);
                // 兼容旧版本的单文件数据
                if (data.xmlContent && !data.files) {
                    // 旧版本数据迁移
                    const legacyFile: FileData = {
                        fileName: "legacy.xml",
                        xmlContent: data.xmlContent,
                        parsedItems: data.parsedItems || [],
                        translations: data.translations || {},
                    };
                    setFiles([legacyFile]);
                } else if (data.files) {
                    setFiles(data.files || []);
                }
                setSettings((prev) => ({ ...prev, ...(data.settings || {}) }));
            }
        } catch (e) {
            console.error("Failed to load state from localStorage", e);
        } finally {
            setIsHydrated(true);
        }
    }, []);

    // Persist to localStorage
    useEffect(() => {
        if (!isHydrated) return;

        const stateToSave = {
            files,
            settings,
        };
        localStorage.setItem(STORAGE_KEY, JSON.stringify(stateToSave));
    }, [files, settings, isHydrated]);

    const addFiles = async (filesData: { fileName: string; content: string }[]) => {
        try {
            const newFiles: FileData[] = [];
            for (const { fileName, content } of filesData) {
                const { items } = await parseXML(content, fileName);
                const initialTranslations: Record<string, string> = {};
                items.forEach((item) => {
                    initialTranslations[item.id] = "";
                });
                newFiles.push({
                    fileName,
                    xmlContent: content,
                    parsedItems: items,
                    translations: initialTranslations,
                });
            }
            setFiles(prev => [...prev, ...newFiles]);
        } catch (e) {
            console.error("Failed to parse XML", e);
            throw e;
        }
    };

    const updateTranslation = (id: string, value: string) => {
        setFiles(prev => prev.map(file => {
            // 检查这个 id 是否属于这个文件
            const hasId = file.parsedItems.some(item => item.id === id);
            if (hasId) {
                return {
                    ...file,
                    translations: {
                        ...file.translations,
                        [id]: value,
                    },
                };
            }
            return file;
        }));
    };

    const updateSettings = (newSettings: Partial<ProjectSettings>) => {
        setSettings((prev) => ({ ...prev, ...newSettings }));
    };

    const clearProject = () => {
        setFiles([]);
        // We typically want to keep settings (API keys etc) even if clearing the project file
    };

    const clearTranslations = () => {
        setFiles(prev => prev.map(file => {
            const initialTranslations: Record<string, string> = {};
            file.parsedItems.forEach((item) => {
                initialTranslations[item.id] = "";
            });
            return {
                ...file,
                translations: initialTranslations,
            };
        }));
    };

    const getFileExportData = (fileIndex: number) => {
        const file = files[fileIndex];
        if (!file) return null;
        return {
            fileName: file.fileName,
            xmlContent: file.xmlContent,
            translations: file.translations,
        };
    };

    return {
        files,
        allParsedItems,
        allTranslations,
        settings,
        isLoading: !isHydrated,
        addFiles,
        updateTranslation,
        updateSettings,
        clearProject,
        clearTranslations,
        getFileExportData,
    };
}
