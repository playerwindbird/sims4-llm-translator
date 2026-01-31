import { useState, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import type { ParsedItem } from "@/lib/xml-utils";
import type { ProjectSettings } from "@/hooks/use-project-state";
import { Copy, Check, Play, Pause, X, RotateCcw, ChevronLeft, ChevronRight } from "lucide-react";
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
    AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

// Assuming Tabs are available or I need to implement them/install them.
// Wait, I saw components list earlier, I don't recall seeing 'tabs.tsx'.
// I should check. If not, I'll use simple button toggles.

interface TranslationControlsProps {
    items: ParsedItem[];
    translations: Record<string, string>; // Added prop
    settings: ProjectSettings;
    onUpdateSettings: (settings: Partial<ProjectSettings>) => void;
    onApplyTranslations: (jsonString: string) => void;
    onClearTranslations: () => void;
}

export function TranslationControls({
    items,
    translations, // Added
    settings,
    onUpdateSettings,
    onApplyTranslations,
    onClearTranslations,
}: TranslationControlsProps) {
    const [mode, setMode] = useState<"manual" | "auto">("manual");
    const [manualBatchIndex, setManualBatchIndex] = useState(0);

    // Reset manual batch index when items change
    useEffect(() => {
        setManualBatchIndex(0);
    }, [items]); // eslint-disable-line

    const [jsonInput, setJsonInput] = useState("");
    const [isCopied, setIsCopied] = useState(false);
    const [isTranslating, setIsTranslating] = useState(false);
    const [isPaused, setIsPaused] = useState(false);
    const [currentBatchIndex, setCurrentBatchIndex] = useState(0);
    const dummyRef = useRef(false); // Placeholder for line count matching if needed, or just insert.
    const shouldPauseRef = useRef(false);
    const abortControllerRef = useRef<AbortController | null>(null);
    const abortReasonRef = useRef<"pause" | "reset" | null>(null);

    const generateSourceJson = () => {
        const batchSize = settings.manualBatchSize || 50;
        const start = manualBatchIndex * batchSize;
        const end = Math.min(start + batchSize, items.length);
        const batchItems = items.slice(start, end);

        const obj: Record<string, string> = {};
        batchItems.forEach((item) => {
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

    const runTranslationLoop = async (startIndex: number) => {
        setIsTranslating(true);
        setIsTranslating(true);
        setIsPaused(false); // Ensure not paused when running
        shouldPauseRef.current = false; // Ensure pause flag is reset
        abortControllerRef.current = new AbortController();
        abortReasonRef.current = null;

        try {
            const batchSize = settings.batchSize || 50;
            const totalItems = items.length;
            const totalBatches = Math.ceil(totalItems / batchSize);

            if (startIndex === 0) {
                setProgress({ current: 0, total: totalBatches });
            } else {
                setProgress({ current: startIndex, total: totalBatches });
            }

            for (let i = startIndex; i < totalBatches; i++) {
                if (shouldPauseRef.current) {
                    setCurrentBatchIndex(i);
                    setIsPaused(true); // Set paused state when loop exits due to pause
                    return;
                }

                const start = i * batchSize;
                const end = Math.min(start + batchSize, totalItems);
                const batchItems = items.slice(start, end);

                const batchObj: Record<string, string> = {};
                batchItems.forEach((item) => {
                    batchObj[item.id] = item.source;
                });

                const sourceJson = JSON.stringify(batchObj, null, 2);

                const prompt = `Translate the following JSON values to the target language (Chinese). Keep the keys unchanged. Return ONLY the JSON.\n\n${sourceJson}`;

                const response = await fetch(`${settings.apiBaseUrl}/chat/completions`, {
                    method: "POST",
                    signal: abortControllerRef.current?.signal,
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
                setCurrentBatchIndex(i + 1);
            }

            // Completed
            setIsTranslating(false);
            setIsPaused(false);
            setCurrentBatchIndex(0);

        } catch (e: any) {
            if (e.name === 'AbortError') {
                if (abortReasonRef.current === 'pause') {
                    setIsPaused(true);
                }
                return;
            }
            alert("翻译失败: " + e.message);
            setIsTranslating(false);
            setIsPaused(false);
            setCurrentBatchIndex(0); // Reset index on error
        }
    };

    const handleStartPauseContinue = () => {
        if (!isTranslating) {
            // Start fresh
            setIsPaused(false);
            shouldPauseRef.current = false;
            setCurrentBatchIndex(0);
            runTranslationLoop(0);
        } else if (isPaused) {
            // Continue
            setIsPaused(false);
            shouldPauseRef.current = false;
            runTranslationLoop(currentBatchIndex);
        } else {
            // Pause
            shouldPauseRef.current = true;
            abortReasonRef.current = "pause";
            abortControllerRef.current?.abort();
        }
    };

    const handleCancel = () => {
        shouldPauseRef.current = true; // Signal loop to stop
        abortReasonRef.current = "reset"; // generic abort
        abortControllerRef.current?.abort();
        setIsTranslating(false);
        setIsPaused(false);
        setCurrentBatchIndex(0);
        setProgress({ current: 0, total: 0 });
    };

    const handleReset = () => {
        handleCancel(); // Reuse stop logic
        onClearTranslations();
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
                            disabled={isTranslating}
                            className="h-8"
                        >
                            手动模式
                        </Button>
                        <Button
                            variant={mode === "auto" ? "default" : "ghost"}
                            size="sm"
                            onClick={() => setMode("auto")}
                            disabled={isTranslating}
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
                        <div className="space-y-3 pt-2">
                            <div className="flex items-center justify-between">
                                <Label>一次性处理条目数</Label>
                                <span className="text-sm font-mono text-muted-foreground">{settings.manualBatchSize || 50}</span>
                            </div>
                            <Slider
                                min={1}
                                max={100}
                                step={1}
                                value={settings.manualBatchSize || 50}
                                onChange={(e) => {
                                    onUpdateSettings({ manualBatchSize: Number(e.target.value) });
                                    setManualBatchIndex(0);
                                }}
                            />
                        </div>

                        <div className="space-y-2">
                            <div className="flex items-center justify-between">
                                <Label>1. 复制源 JSON</Label>
                                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                                    <span>批次 {manualBatchIndex + 1} / {Math.max(1, Math.ceil(items.length / (settings.manualBatchSize || 50)))}</span>
                                    <div className="flex gap-1">
                                        <Button
                                            variant="outline"
                                            size="icon"
                                            className="h-6 w-6"
                                            onClick={() => setManualBatchIndex(Math.max(0, manualBatchIndex - 1))}
                                            disabled={manualBatchIndex === 0}
                                        >
                                            <ChevronLeft className="h-3 w-3" />
                                        </Button>
                                        <Button
                                            variant="outline"
                                            size="icon"
                                            className="h-6 w-6"
                                            onClick={() => {
                                                const total = Math.ceil(items.length / (settings.manualBatchSize || 50));
                                                setManualBatchIndex(Math.min(total - 1, manualBatchIndex + 1));
                                            }}
                                            disabled={manualBatchIndex >= Math.ceil(items.length / (settings.manualBatchSize || 50)) - 1}
                                        >
                                            <ChevronRight className="h-3 w-3" />
                                        </Button>
                                    </div>
                                </div>
                            </div>
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
                                    disabled={isTranslating}
                                />
                            </div>
                            <div className="space-y-2">
                                <Label>模型名称</Label>
                                <Input
                                    value={settings.model}
                                    onChange={(e) => onUpdateSettings({ model: e.target.value })}
                                    placeholder="gpt-3.5-turbo"
                                    disabled={isTranslating}
                                />
                            </div>
                        </div>

                        <div className="space-y-2">
                            <Label>API 密钥</Label>
                            <Input
                                type="password"
                                value={settings.apiKey}
                                onChange={(e) => onUpdateSettings({ apiKey: e.target.value })}
                                placeholder="sk-..."
                                disabled={isTranslating}
                            />
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
                                disabled={isTranslating}
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
                            <Button className="w-full" onClick={handleStartPauseContinue} disabled={!settings.apiKey}>
                                {isTranslating ? (
                                    isPaused ? (
                                        <><Play className="mr-2 h-4 w-4" /> 继续翻译</>
                                    ) : (
                                        <><Pause className="mr-2 h-4 w-4" /> 暂停翻译</>
                                    )
                                ) : (
                                    <><Play className="mr-2 h-4 w-4" /> 开始自动翻译</>
                                )}
                            </Button>
                            {(isTranslating || isPaused) && (
                                <Button variant="secondary" className="w-full" onClick={handleCancel}>
                                    <X className="mr-2 h-4 w-4" /> 取消翻译
                                </Button>
                            )}
                            {Object.values(translations).some(t => t.trim() !== '') && (
                                <AlertDialog>
                                    <AlertDialogTrigger asChild>
                                        <Button variant="destructive" className="w-full">
                                            <RotateCcw className="mr-2 h-4 w-4" /> 重置翻译
                                        </Button>
                                    </AlertDialogTrigger>
                                    <AlertDialogContent>
                                        <AlertDialogHeader>
                                            <AlertDialogTitle>确认重置？</AlertDialogTitle>
                                            <AlertDialogDescription>
                                                将清空所有已翻译文本，是否确认？
                                            </AlertDialogDescription>
                                        </AlertDialogHeader>
                                        <AlertDialogFooter>
                                            <AlertDialogCancel>取消</AlertDialogCancel>
                                            <AlertDialogAction onClick={handleReset}>确认</AlertDialogAction>
                                        </AlertDialogFooter>
                                    </AlertDialogContent>
                                </AlertDialog>
                            )}
                        </div>
                    </div>
                )}
            </CardContent>
        </Card>
    );
}
