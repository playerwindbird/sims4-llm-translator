import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
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
            alert("无效的 JSON 格式");
        }
    };

    const [progress, setProgress] = useState({ current: 0, total: 0 });

    const handleAutoTranslate = async () => {
        setIsTranslating(true);
        setProgress({ current: 0, total: 0 });

        try {
            const batchSize = settings.batchSize || 50;
            const totalItems = items.length;
            const totalBatches = Math.ceil(totalItems / batchSize);

            setProgress({ current: 0, total: totalBatches });

            for (let i = 0; i < totalBatches; i++) {
                const start = i * batchSize;
                const end = Math.min(start + batchSize, totalItems);
                const batchItems = items.slice(start, end);

                // Skip if all items in this batch are already translated? 
                // User didn't ask for this, but it saves tokens. 
                // For now, adhere to "translate everything" or simple logic to avoid complexity unless requested.
                // However, the prompt is just "translate".
                // I will just translate the batch.

                const batchObj: Record<string, string> = {};
                batchItems.forEach((item) => {
                    batchObj[item.id] = item.source;
                });

                const sourceJson = JSON.stringify(batchObj, null, 2);

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
                    throw new Error(`Batch ${i + 1}/${totalBatches} failed: ${err}`);
                }

                const data = await response.json();
                const content = data.choices[0].message.content;

                // Extract JSON from content
                const jsonMatch = content.match(/```json\n([\s\S]*?)\n```/) || content.match(/{[\s\S]*}/);
                const jsonStr = jsonMatch ? jsonMatch[1] || jsonMatch[0] : content;

                onApplyTranslations(jsonStr);

                // Update progress after successful batch
                setProgress({ current: i + 1, total: totalBatches });
            }

        } catch (e: any) {
            alert("翻译失败: " + e.message);
        } finally {
            setIsTranslating(false);
            setProgress({ current: 0, total: 0 });
        }
    };

    return (
        <Card className="w-full">
            <CardHeader>
                <div className="flex items-center justify-between">
                    <CardTitle>翻译工具</CardTitle>
                    <div className="flex bg-muted rounded-lg p-1">
                        <Button
                            variant={mode === "manual" ? "default" : "ghost"}
                            size="sm"
                            onClick={() => setMode("manual")}
                            className="h-8"
                        >
                            手动模式
                        </Button>
                        <Button
                            variant={mode === "auto" ? "default" : "ghost"}
                            size="sm"
                            onClick={() => setMode("auto")}
                            className="h-8"
                        >
                            自动模式 (LLM)
                        </Button>
                    </div>
                </div>
                <CardDescription>
                    {mode === "manual"
                        ? "复制 JSON，外部翻译后，将结果粘贴回来。"
                        : "使用兼容的 LLM API 自动翻译。"}
                </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
                {mode === "manual" ? (
                    <div className="space-y-4">
                        <div className="space-y-2">
                            <Label>1. 复制源 JSON</Label>
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
                            <Label>2. 粘贴翻译后的 JSON</Label>
                            <div className="flex gap-2">
                                <Textarea
                                    value={jsonInput}
                                    onChange={(e) => setJsonInput(e.target.value)}
                                    placeholder='{"id": "translated text", ...}'
                                    className="h-24 font-mono text-xs"
                                />
                                <Button className="h-24 w-12 shrink-0" onClick={handleApplyManual}>
                                    应用
                                </Button>
                            </div>
                        </div>
                    </div>
                ) : (
                    <div className="space-y-4">
                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <Label>API 基础 URL</Label>
                                <Input
                                    value={settings.apiBaseUrl}
                                    onChange={(e) => onUpdateSettings({ apiBaseUrl: e.target.value })}
                                    placeholder="https://api.openai.com/v1"
                                />
                            </div>
                            <div className="space-y-2">
                                <Label>模型名称</Label>
                                <Input
                                    value={settings.model}
                                    onChange={(e) => onUpdateSettings({ model: e.target.value })}
                                    placeholder="gpt-3.5-turbo"
                                />
                            </div>
                        </div>

                        <div className="space-y-3 pt-2">
                            <div className="flex items-center justify-between">
                                <Label>一次性处理条目数</Label>
                                <span className="text-sm font-mono text-muted-foreground">{settings.batchSize}</span>
                            </div>
                            <Slider
                                min={1}
                                max={100}
                                step={1}
                                value={settings.batchSize}
                                onChange={(e) => onUpdateSettings({ batchSize: Number(e.target.value) })}
                            />
                        </div>

                        {isTranslating && (
                            <div className="space-y-2">
                                <div className="flex justify-between text-xs text-muted-foreground">
                                    <span>进度</span>
                                    <span>{progress.current} / {progress.total} 批次</span>
                                </div>
                                <div className="h-2 bg-secondary rounded-full overflow-hidden">
                                    <div
                                        className="h-full bg-primary transition-all duration-300"
                                        style={{ width: `${(progress.current / Math.max(progress.total, 1)) * 100}%` }}
                                    />
                                </div>
                            </div>
                        )}
                        <div className="space-y-2">
                            <Label>API 密钥</Label>
                            <Input
                                type="password"
                                value={settings.apiKey}
                                onChange={(e) => onUpdateSettings({ apiKey: e.target.value })}
                                placeholder="sk-..."
                            />
                        </div>
                        <Button className="w-full" onClick={handleAutoTranslate} disabled={!settings.apiKey || isTranslating}>
                            {isTranslating ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> 翻译中...</> : <><Play className="mr-2 h-4 w-4" /> 开始自动翻译</>}
                        </Button>
                    </div>
                )}
            </CardContent>
        </Card>
    );
}
