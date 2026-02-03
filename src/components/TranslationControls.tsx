import { useState, useRef, useEffect, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import type { ParsedItem } from "@/lib/xml-utils";
import type { ProjectSettings } from "@/hooks/use-project-state";
import { DEFAULT_PROMPT } from "@/hooks/use-project-state";
import { Copy, Check, Play, Pause, X, RotateCcw, FileText, Files, ChevronDown } from "lucide-react";
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
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

// Assuming Tabs are available or I need to implement them/install them.
// Wait, I saw components list earlier, I don't recall seeing 'tabs.tsx'.
// I should check. If not, I'll use simple button toggles.

interface TranslationControlsProps {
    files: { fileName: string; parsedItems: ParsedItem[] }[];
    items: ParsedItem[];
    translations: Record<string, string>; // Added prop
    settings: ProjectSettings;
    onUpdateSettings: (settings: Partial<ProjectSettings>) => void;
    onApplyTranslations: (jsonString: string) => void;
    onClearTranslations: () => void;
    activeFileTab: string;
    onActiveFileTabChange: (tab: string) => void;
}

export function TranslationControls({
    files,
    items,
    translations, // Added
    settings,
    onUpdateSettings,
    onApplyTranslations,
    onClearTranslations,
    activeFileTab,
    onActiveFileTabChange,
}: TranslationControlsProps) {
    const [mode, setMode] = useState<"manual" | "auto">("manual");
    const [sourceJsonKey, setSourceJsonKey] = useState(0); // Used to trigger source JSON refresh
    const [isSourceJsonRefreshing, setIsSourceJsonRefreshing] = useState(false); // Animation state for source JSON refresh

    const [jsonInput, setJsonInput] = useState("");
    const [isCopied, setIsCopied] = useState(false);
    const [isPromptCopied, setIsPromptCopied] = useState(false);
    const [isBothCopied, setIsBothCopied] = useState(false);
    const [manualPrompt, setManualPrompt] = useState(settings.manualPrompt || DEFAULT_PROMPT);
    const [isTranslating, setIsTranslating] = useState(false);
    const [isPaused, setIsPaused] = useState(false);
    const [currentBatchIndex, setCurrentBatchIndex] = useState(0);
    const shouldPauseRef = useRef(false);
    const abortControllerRef = useRef<AbortController | null>(null);
    const abortReasonRef = useRef<"pause" | "reset" | null>(null);

    // Entry count animation state
    const [entryDelta, setEntryDelta] = useState<{ added: number; removed: number } | null>(null);
    const [animationKey, setAnimationKey] = useState(0); // Used to force animation restart
    const entryDeltaTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const prevProcessedCountRef = useRef<number | null>(null);

    // Source JSON refresh animation refs
    const sourceJsonRefreshTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const sourceJsonAnimationEndTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    // API test state
    const [isTestingApi, setIsTestingApi] = useState(false);
    const [apiTestResult, setApiTestResult] = useState<{ success: boolean; message: string } | null>(null);

    // 根据 activeFileTab 获取当前文件的 items
    const currentItems = useMemo(() => {
        if (activeFileTab === "all") {
            return items;
        }
        const fileIndex = parseInt(activeFileTab, 10);
        const file = files[fileIndex];
        return file ? file.parsedItems : [];
    }, [activeFileTab, items, files]);

    // 获取当前文件名用于显示
    const currentFileName = useMemo(() => {
        if (activeFileTab === "all") {
            return "全部文件";
        }
        const fileIndex = parseInt(activeFileTab, 10);
        const file = files[fileIndex];
        if (!file) return "全部文件";
        const name = file.fileName.replace(/\.[^/.]+$/, ""); // 去掉扩展名
        return name.length > 15 ? name.substring(0, 12) + "..." : name;
    }, [activeFileTab, files]);

    // 获取短文件名用于下拉菜单
    const getShortFileName = (fileName: string) => {
        const name = fileName.replace(/\.[^/.]+$/, ""); // 去掉扩展名
        return name.length > 20 ? name.substring(0, 17) + "..." : name;
    };

    const generateSourceJson = () => {
        const batchSize = settings.manualBatchSize || 50;
        // Only get untranslated items from current file
        const untranslatedItems = currentItems.filter(item => !translations[item.id] || translations[item.id].trim() === '');
        const batchItems = untranslatedItems.slice(0, batchSize);

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

    const handleCopyPrompt = () => {
        navigator.clipboard.writeText(manualPrompt);
        setIsPromptCopied(true);
        setTimeout(() => setIsPromptCopied(false), 2000);
    };

    const handleCopyBoth = () => {
        const combined = `${manualPrompt}\n\n${generateSourceJson()}`;
        navigator.clipboard.writeText(combined);
        setIsBothCopied(true);
        setTimeout(() => setIsBothCopied(false), 2000);
    };

    const handleResetManualPrompt = () => {
        setManualPrompt(DEFAULT_PROMPT);
        onUpdateSettings({ manualPrompt: DEFAULT_PROMPT });
    };

    const handleManualPromptChange = (value: string) => {
        setManualPrompt(value);
        onUpdateSettings({ manualPrompt: value });
    };

    // Calculate processed and pending counts for current file
    const processedCount = currentItems.filter(item => translations[item.id] && translations[item.id].trim() !== '').length;
    const pendingCount = currentItems.length - processedCount;

    // Track changes in processed count and trigger animation
    useEffect(() => {
        // Skip animation on initial mount
        if (prevProcessedCountRef.current === null) {
            prevProcessedCountRef.current = processedCount;
            return;
        }

        const delta = processedCount - prevProcessedCountRef.current;

        if (delta !== 0) {
            // Clear any existing timeout but keep the accumulated values
            if (entryDeltaTimeoutRef.current) {
                clearTimeout(entryDeltaTimeoutRef.current);
            }

            // Accumulate the delta animation
            setEntryDelta(prev => {
                const currentProcessedDelta = prev?.added ?? 0;
                const currentPendingDelta = prev?.removed ?? 0;

                // delta > 0 means: processed +delta, pending -delta
                // delta < 0 means: processed +delta (negative), pending -delta (positive since delta is negative)
                return {
                    added: currentProcessedDelta + delta,      // processed change
                    removed: currentPendingDelta - delta       // pending change (opposite of processed)
                };
            });

            // Increment animation key to restart CSS animation
            setAnimationKey(prev => prev + 1);

            // Clear after 2.5 seconds
            entryDeltaTimeoutRef.current = setTimeout(() => {
                setEntryDelta(null);
            }, 2500);
        }

        prevProcessedCountRef.current = processedCount;
    }, [processedCount]);

    // Trigger refresh animation for source JSON with debounce
    const triggerSourceJsonRefresh = () => {
        // Always update the key to refresh content immediately
        setSourceJsonKey(prev => prev + 1);

        // Clear any pending animation start timeout
        if (sourceJsonRefreshTimeoutRef.current) {
            clearTimeout(sourceJsonRefreshTimeoutRef.current);
        }
        // Clear any pending animation end timeout
        if (sourceJsonAnimationEndTimeoutRef.current) {
            clearTimeout(sourceJsonAnimationEndTimeoutRef.current);
        }

        // Reset animation state first to prepare for new animation
        setIsSourceJsonRefreshing(false);

        // Debounce: wait a short time before starting animation
        // This prevents flickering during rapid changes
        sourceJsonRefreshTimeoutRef.current = setTimeout(() => {
            setIsSourceJsonRefreshing(true);
            // Reset animation state after animation completes
            sourceJsonAnimationEndTimeoutRef.current = setTimeout(() => {
                setIsSourceJsonRefreshing(false);
            }, 600);
        }, 150);
    };

    // 当切换文件时触发源 JSON 刷新
    useEffect(() => {
        triggerSourceJsonRefresh();
        // Reset processed count ref to avoid animation when switching files
        prevProcessedCountRef.current = processedCount;
    }, [activeFileTab]);

    const handleApplyManual = () => {
        try {
            if (!jsonInput.trim()) return;
            onApplyTranslations(jsonInput);
            setJsonInput("");
            // Refresh source JSON after applying translations
            triggerSourceJsonRefresh();
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
            const batchSize = settings.batchSize || 10;
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

                const systemPrompt = settings.customPrompt || DEFAULT_PROMPT;
                const userPrompt = `${sourceJson}`;

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
                            { role: "system", content: systemPrompt },
                            { role: "user", content: userPrompt }
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

    const handleTestApi = async () => {
        setIsTestingApi(true);
        setApiTestResult(null);

        try {
            const response = await fetch(`${settings.apiBaseUrl}/models`, {
                method: "GET",
                headers: {
                    "Authorization": `Bearer ${settings.apiKey}`
                }
            });

            if (response.ok) {
                setApiTestResult({ success: true, message: "API 连接成功！" });
            } else {
                const err = await response.text();
                setApiTestResult({ success: false, message: `连接失败: ${response.status} ${err.slice(0, 100)}` });
            }
        } catch (e: any) {
            setApiTestResult({ success: false, message: `连接失败: ${e.message}` });
        } finally {
            setIsTestingApi(false);
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
                            自动模式
                        </Button>
                    </div>
                </div>
                <CardDescription>
                    {mode === "manual"
                        ? "由于AI单次处理长度上限，手动模式需要分批处理，拖动选择复制条目数，复制提示词和源JSON，外部翻译后，将结果黏贴回来，进行下一批"
                        : "使用兼容的 LLM API 自动翻译。"}
                </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
                {/* 文件选择器 - 只在有多个文件时显示 */}
                {files.length > 1 && (
                    <div className="flex items-center gap-2 p-3 bg-muted/50 rounded-lg border border-border/50">
                        <span className="text-sm text-muted-foreground shrink-0">当前文件：</span>
                        <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                                <Button 
                                    variant="outline" 
                                    size="sm" 
                                    className="flex-1 justify-between gap-2 h-8"
                                    disabled={isTranslating}
                                >
                                    <span className="flex items-center gap-2 truncate">
                                        {activeFileTab === "all" ? (
                                            <><Files className="h-4 w-4 shrink-0" /><span className="truncate">全部文件</span></>
                                        ) : (
                                            <><FileText className="h-4 w-4 shrink-0" /><span className="truncate">{currentFileName}</span></>
                                        )}
                                    </span>
                                    <ChevronDown className="h-4 w-4 shrink-0 opacity-50" />
                                </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="start" className="max-h-60 overflow-auto w-56">
                                <DropdownMenuItem 
                                    onClick={() => onActiveFileTabChange("all")}
                                    className={activeFileTab === "all" ? "bg-accent" : ""}
                                >
                                    <Files className="h-4 w-4 mr-2" />
                                    <span>全部文件</span>
                                    <span className="ml-auto text-xs text-muted-foreground">{items.length}</span>
                                </DropdownMenuItem>
                                {files.map((file, index) => (
                                    <DropdownMenuItem
                                        key={index}
                                        onClick={() => onActiveFileTabChange(index.toString())}
                                        className={activeFileTab === index.toString() ? "bg-accent" : ""}
                                    >
                                        <FileText className="h-4 w-4 mr-2" />
                                        <span className="truncate">{getShortFileName(file.fileName)}</span>
                                        <span className="ml-auto text-xs text-muted-foreground">{file.parsedItems.length}</span>
                                    </DropdownMenuItem>
                                ))}
                            </DropdownMenuContent>
                        </DropdownMenu>
                    </div>
                )}
                {mode === "manual" ? (
                    <div className="space-y-4">
                        <div className="space-y-3 pt-2">
                            <div className="flex items-center justify-between">
                                <Label>复制条目数</Label>
                                <span className="text-sm font-mono text-muted-foreground">{settings.manualBatchSize || 50}</span>
                            </div>
                            <Slider
                                min={1}
                                max={1000}
                                step={1}
                                value={settings.manualBatchSize || 50}
                                onChange={(e) => {
                                    onUpdateSettings({ manualBatchSize: Number(e.target.value) });
                                    // Refresh source JSON when batch size changes
                                    triggerSourceJsonRefresh();
                                }}
                            />
                        </div>

                        <div className="space-y-2">
                            <div className="flex items-center justify-between">
                                <Label>提示词模板</Label>
                                <Button
                                    variant="ghost"
                                    size="sm"
                                    className="h-6 text-xs text-muted-foreground hover:text-foreground"
                                    onClick={handleResetManualPrompt}
                                    disabled={manualPrompt === DEFAULT_PROMPT}
                                >
                                    恢复默认
                                </Button>
                            </div>
                            <div className="flex gap-2">
                                <Textarea
                                    value={manualPrompt}
                                    onChange={(e) => handleManualPromptChange(e.target.value)}
                                    placeholder="输入提示词模板..."
                                    className="h-28 font-mono text-xs"
                                />
                                <Button variant="outline" size="icon" className="h-28 w-12 shrink-0" onClick={handleCopyPrompt}>
                                    {isPromptCopied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                                </Button>
                            </div>
                        </div>

                        <div className="space-y-2">
                            <Label>复制源 JSON<span className="text-muted-foreground text-xs font-normal">({Math.min(settings.manualBatchSize || 50, currentItems.filter(item => !translations[item.id] || translations[item.id].trim() === '').length)}条)</span></Label>
                            <div className="flex gap-2">
                                <Textarea
                                    key={sourceJsonKey}
                                    readOnly
                                    value={generateSourceJson()}
                                    className={`h-24 font-mono text-xs bg-muted ${isSourceJsonRefreshing ? 'source-json-refresh-animation' : ''}`}
                                />
                                <Button variant="outline" size="icon" className="h-24 w-12 shrink-0" onClick={handleCopy}>
                                    {isCopied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                                </Button>
                            </div>
                            <Button
                                variant="secondary"
                                className="w-full"
                                onClick={handleCopyBoth}
                            >
                                {isBothCopied ? (
                                    <><Check className="mr-2 h-4 w-4" /> 已复制</>
                                ) : (
                                    <><Copy className="mr-2 h-4 w-4" /> 一键复制提示词和源 JSON</>
                                )}
                            </Button>
                        </div>

                        <div className="space-y-2">
                            <Label>粘贴翻译后的 JSON</Label>
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
                        {/* Entry count status bar */}
                        <div className="flex items-center justify-center gap-4 py-3 px-4 bg-muted/50 rounded-lg text-sm">
                            <span className="text-muted-foreground">
                                已处理条目：<span className="font-mono font-medium text-foreground">{processedCount}</span>
                                {entryDelta && entryDelta.added > 0 && (
                                    <span key={`processed-add-${animationKey}`} className="entry-delta-animation ml-2 text-blue-500 font-medium">
                                        +{entryDelta.added}
                                    </span>
                                )}
                                {entryDelta && entryDelta.added < 0 && (
                                    <span key={`processed-sub-${animationKey}`} className="entry-delta-animation ml-2 text-red-500 font-medium">
                                        {entryDelta.added}
                                    </span>
                                )}
                            </span>
                            <span className="text-muted-foreground">/</span>
                            <span className="text-muted-foreground">
                                待处理条目：<span className="font-mono font-medium text-foreground">{pendingCount}</span>
                                {entryDelta && entryDelta.removed < 0 && (
                                    <span key={`pending-sub-${animationKey}`} className="entry-delta-animation ml-2 text-green-500 font-medium">
                                        {entryDelta.removed}
                                    </span>
                                )}
                                {entryDelta && entryDelta.removed > 0 && (
                                    <span key={`pending-add-${animationKey}`} className="entry-delta-animation ml-2 text-red-500 font-medium">
                                        +{entryDelta.removed}
                                    </span>
                                )}
                            </span>
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
                            <div className="flex gap-2">
                                <Input
                                    type="password"
                                    value={settings.apiKey}
                                    onChange={(e) => onUpdateSettings({ apiKey: e.target.value })}
                                    placeholder="sk-..."
                                    disabled={isTranslating}
                                    className="flex-1"
                                />
                                <Button
                                    variant="outline"
                                    size="sm"
                                    disabled={!settings.apiKey || !settings.apiBaseUrl || isTranslating || isTestingApi}
                                    onClick={handleTestApi}
                                    className="h-10 px-4 shrink-0"
                                >
                                    {isTestingApi ? (
                                        <span className="flex items-center">
                                            <span className="animate-spin mr-2 h-4 w-4 border-2 border-current border-t-transparent rounded-full"></span>
                                            测试中
                                        </span>
                                    ) : (
                                        "测试"
                                    )}
                                </Button>
                            </div>
                            {apiTestResult && (
                                <p className={`text-xs ${apiTestResult.success ? 'text-green-500' : 'text-red-500'}`}>
                                    {apiTestResult.message}
                                </p>
                            )}
                        </div>

                        <div className="space-y-2">
                            <div className="flex items-center justify-between">
                                <Label>自定义提示词</Label>
                                <Button
                                    variant="ghost"
                                    size="sm"
                                    className="h-6 text-xs text-muted-foreground hover:text-foreground"
                                    onClick={() => onUpdateSettings({ customPrompt: DEFAULT_PROMPT })}
                                    disabled={isTranslating || settings.customPrompt === DEFAULT_PROMPT}
                                >
                                    恢复默认
                                </Button>
                            </div>
                            <Textarea
                                value={settings.customPrompt || DEFAULT_PROMPT}
                                onChange={(e) => onUpdateSettings({ customPrompt: e.target.value })}
                                placeholder="输入自定义提示词..."
                                className="h-28 font-mono text-xs"
                                disabled={isTranslating}
                            />
                        </div>

                        <div className="space-y-3 pt-2">
                            <div className="flex items-center justify-between">
                                <Label>单批处理条目数</Label>
                                <span className="text-sm font-mono text-muted-foreground">{settings.batchSize}</span>
                            </div>
                            <Slider
                                min={1}
                                max={1000}
                                step={1}
                                value={settings.batchSize}
                                onChange={(e) => onUpdateSettings({ batchSize: Number(e.target.value) })}
                                disabled={isTranslating}
                            />
                        </div>

                        {isTranslating && (
                            <div className="space-y-2">
                                <div className="flex justify-between text-xs text-muted-foreground">
                                    <span>
                                        {isPaused ? (
                                            "已暂停"
                                        ) : (
                                            <>
                                                翻译中
                                                <span className="animated-ellipsis">
                                                    <span>.</span>
                                                    <span>.</span>
                                                    <span>.</span>
                                                </span>
                                            </>
                                        )}
                                    </span>
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

                        {/* Entry count status bar */}
                        <div className="flex items-center justify-center gap-4 py-3 px-4 bg-muted/50 rounded-lg text-sm">
                            <span className="text-muted-foreground">
                                已处理条目：<span className="font-mono font-medium text-foreground">{processedCount}</span>
                                {entryDelta && entryDelta.added > 0 && (
                                    <span key={`auto-processed-add-${animationKey}`} className="entry-delta-animation ml-2 text-blue-500 font-medium">
                                        +{entryDelta.added}
                                    </span>
                                )}
                                {entryDelta && entryDelta.added < 0 && (
                                    <span key={`auto-processed-sub-${animationKey}`} className="entry-delta-animation ml-2 text-red-500 font-medium">
                                        {entryDelta.added}
                                    </span>
                                )}
                            </span>
                            <span className="text-muted-foreground">/</span>
                            <span className="text-muted-foreground">
                                待处理条目：<span className="font-mono font-medium text-foreground">{pendingCount}</span>
                                {entryDelta && entryDelta.removed < 0 && (
                                    <span key={`auto-pending-sub-${animationKey}`} className="entry-delta-animation ml-2 text-green-500 font-medium">
                                        {entryDelta.removed}
                                    </span>
                                )}
                                {entryDelta && entryDelta.removed > 0 && (
                                    <span key={`auto-pending-add-${animationKey}`} className="entry-delta-animation ml-2 text-red-500 font-medium">
                                        +{entryDelta.removed}
                                    </span>
                                )}
                            </span>
                        </div>

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
