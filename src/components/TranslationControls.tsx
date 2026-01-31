import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { ParsedItem } from "@/lib/xml-utils";
import type { ProjectSettings } from "@/hooks/use-project-state";
import { Copy, Check, Play, Loader2 } from "lucide-react";

// Assuming Tabs are available or I need to implement them/install them.
// Wait, I saw components list earlier, I don't recall seeing 'tabs.tsx'.
// I should check. If not, I'll use simple button toggles.

interface TranslationControlsProps {
    items: ParsedItem[];
    settings: ProjectSettings;
    onUpdateSettings: (settings: Partial<ProjectSettings>) => void;
    onApplyTranslations: (jsonString: string) => void;
}

export function TranslationControls({
    items,
    settings,
    onUpdateSettings,
    onApplyTranslations,
}: TranslationControlsProps) {
    const [mode, setMode] = useState<"manual" | "auto">("manual");
    const [jsonInput, setJsonInput] = useState("");
    const [isCopied, setIsCopied] = useState(false);
    const [isTranslating, setIsTranslating] = useState(false);

    const generateSourceJson = () => {
        const obj: Record<string, string> = {};
        items.forEach((item) => {
            obj[item.id] = item.source;
        });
        return JSON.stringify(obj, null, 2);
    };

    const handleCopy = () => {
        navigator.clipboard.writeText(generateSourceJson());
        setIsCopied(true);
        setTimeout(() => setIsCopied(false), 2000);
    };

    const handleApplyManual = () => {
        try {
            if (!jsonInput.trim()) return;
            onApplyTranslations(jsonInput);
            setJsonInput("");
        } catch (e) {
            alert("Invalid JSON format");
        }
    };

    const handleAutoTranslate = async () => {
        setIsTranslating(true);
        // This would be the actual API call logic
        // For now, we'll mock it or just set a timeout if we want to simulate
        // But since this is client side only and we want to use the API key provided...

        // TODO: Implement actual LLM call here or in a helper
        // Since we are running in browser, we can call fetch directly.

        // For this step, I will just simulate a delay and then "mock" translation if it was real?
        // Or I should implement the call. 
        // The user said "Auto mode needs API Key and URL... tool calls it... auto extracts JSON".

        try {
            const sourceJson = generateSourceJson();
            const prompt = `Translate the following JSON values to the target language (Chinese). Keep the keys unchanged. Return ONLY the JSON.\n\n${sourceJson}`;

            const response = await fetch(`${settings.apiBaseUrl}/chat/completions`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    "Authorization": `Bearer ${settings.apiKey}`
                },
                body: JSON.stringify({
                    model: settings.model,
                    messages: [
                        { role: "system", content: "You are a translator. Translate the values to Chinese. Return strictly valid JSON." },
                        { role: "user", content: prompt }
                    ]
                })
            });

            if (!response.ok) {
                const err = await response.text();
                throw new Error(err);
            }

            const data = await response.json();
            const content = data.choices[0].message.content;

            // Extract JSON from content (it might have markdown code blocks)
            const jsonMatch = content.match(/```json\n([\s\S]*?)\n```/) || content.match(/{[\s\S]*}/);
            const jsonStr = jsonMatch ? jsonMatch[1] || jsonMatch[0] : content;

            onApplyTranslations(jsonStr);
        } catch (e: any) {
            alert("Translation failed: " + e.message);
        } finally {
            setIsTranslating(false);
        }
    };

    return (
        <Card className="w-full">
            <CardHeader>
                <div className="flex items-center justify-between">
                    <CardTitle>Translation Tools</CardTitle>
                    <div className="flex bg-muted rounded-lg p-1">
                        <Button
                            variant={mode === "manual" ? "secondary" : "ghost"}
                            size="sm"
                            onClick={() => setMode("manual")}
                            className="h-8"
                        >
                            Manual Mode
                        </Button>
                        <Button
                            variant={mode === "auto" ? "secondary" : "ghost"}
                            size="sm"
                            onClick={() => setMode("auto")}
                            className="h-8"
                        >
                            Auto Mode (LLM)
                        </Button>
                    </div>
                </div>
                <CardDescription>
                    {mode === "manual"
                        ? "Copy the JSON, translate it externally, and paste the result back."
                        : "Automatically translate using a compatible LLM API."}
                </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
                {mode === "manual" ? (
                    <div className="space-y-4">
                        <div className="space-y-2">
                            <Label>1. Copy Source JSON</Label>
                            <div className="flex gap-2">
                                <Textarea
                                    readOnly
                                    value={generateSourceJson()}
                                    className="h-24 font-mono text-xs bg-muted"
                                />
                                <Button variant="outline" size="icon" className="h-24 w-12 shrink-0" onClick={handleCopy}>
                                    {isCopied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                                </Button>
                            </div>
                        </div>
                        <div className="space-y-2">
                            <Label>2. Paste Translated JSON</Label>
                            <div className="flex gap-2">
                                <Textarea
                                    value={jsonInput}
                                    onChange={(e) => setJsonInput(e.target.value)}
                                    placeholder='{"id": "translated text", ...}'
                                    className="h-24 font-mono text-xs"
                                />
                                <Button className="h-24 w-12 shrink-0" onClick={handleApplyManual}>
                                    Apply
                                </Button>
                            </div>
                        </div>
                    </div>
                ) : (
                    <div className="space-y-4">
                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <Label>API Base URL</Label>
                                <Input
                                    value={settings.apiBaseUrl}
                                    onChange={(e) => onUpdateSettings({ apiBaseUrl: e.target.value })}
                                    placeholder="https://api.openai.com/v1"
                                />
                            </div>
                            <div className="space-y-2">
                                <Label>Model Name</Label>
                                <Input
                                    value={settings.model}
                                    onChange={(e) => onUpdateSettings({ model: e.target.value })}
                                    placeholder="gpt-3.5-turbo"
                                />
                            </div>
                        </div>
                        <div className="space-y-2">
                            <Label>API Key</Label>
                            <Input
                                type="password"
                                value={settings.apiKey}
                                onChange={(e) => onUpdateSettings({ apiKey: e.target.value })}
                                placeholder="sk-..."
                            />
                        </div>
                        <Button className="w-full" onClick={handleAutoTranslate} disabled={!settings.apiKey || isTranslating}>
                            {isTranslating ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Translating...</> : <><Play className="mr-2 h-4 w-4" /> Start Auto Translation</>}
                        </Button>
                    </div>
                )}
            </CardContent>
        </Card>
    );
}
