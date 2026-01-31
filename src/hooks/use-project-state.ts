import { useState, useEffect } from "react";
import { type ParsedItem, parseXML } from "@/lib/xml-utils";

export interface ProjectState {
    xmlContent: string | null;
    parsedItems: ParsedItem[];
    translations: Record<string, string>;
    settings: ProjectSettings;
    isLoading: boolean;
    setXmlContent: (content: string) => Promise<void>;
    updateTranslation: (id: string, value: string) => void;
    updateSettings: (settings: Partial<ProjectSettings>) => void;
    clearProject: () => void;
}

export interface ProjectSettings {
    apiKey: string;
    apiBaseUrl: string;
    model: string;
    batchSize: number;
}

const STORAGE_KEY = "sims4-translator-project";

export function useProjectState(): ProjectState {
    const [isHydrated, setIsHydrated] = useState(false);
    const [xmlContent, setXmlContentState] = useState<string | null>(null);
    const [parsedItems, setParsedItems] = useState<ParsedItem[]>([]);
    const [translations, setTranslations] = useState<Record<string, string>>({});
    const [settings, setSettings] = useState<ProjectSettings>({
        apiKey: "",
        apiBaseUrl: "https://api.openai.com/v1",
        model: "gpt-3.5-turbo",
        batchSize: 50,
    });

    // Hydrate from localStorage
    useEffect(() => {
        try {
            const stored = localStorage.getItem(STORAGE_KEY);
            if (stored) {
                const data = JSON.parse(stored);
                setXmlContentState(data.xmlContent || null);
                setParsedItems(data.parsedItems || []);
                setTranslations(data.translations || {});
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
            xmlContent,
            parsedItems,
            translations,
            settings,
        };
        localStorage.setItem(STORAGE_KEY, JSON.stringify(stateToSave));
    }, [xmlContent, parsedItems, translations, settings, isHydrated]);

    const setXmlContent = async (content: string) => {
        try {
            const { items } = await parseXML(content);
            setXmlContentState(content);
            setParsedItems(items);

            // Initialize translations with existing Dest values if not already present
            // Or maybe we should keep existing dests as "current translation"
            const initialTranslations: Record<string, string> = {};
            items.forEach((item) => {
                initialTranslations[item.id] = "";
            });
            setTranslations(initialTranslations);
        } catch (e) {
            console.error("Failed to parse XML", e);
            throw e;
        }
    };

    const updateTranslation = (id: string, value: string) => {
        setTranslations((prev) => ({
            ...prev,
            [id]: value,
        }));
    };

    const updateSettings = (newSettings: Partial<ProjectSettings>) => {
        setSettings((prev) => ({ ...prev, ...newSettings }));
    };

    const clearProject = () => {
        setXmlContentState(null);
        setParsedItems([]);
        setTranslations({});
        // We typically want to keep settings (API keys etc) even if clearing the project file
    };

    return {
        xmlContent,
        parsedItems,
        translations,
        settings,
        isLoading: !isHydrated,
        setXmlContent,
        updateTranslation,
        updateSettings,
        clearProject,
    };
}
