import type { ParsedItem } from "@/lib/xml-utils";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { AlertCircle } from "lucide-react";


interface TranslationEditorProps {
    items: ParsedItem[];
    translations: Record<string, string>;
    onTranslationChange: (id: string, value: string) => void;
}

export function TranslationEditor({
    items,
    translations,
    onTranslationChange,
}: TranslationEditorProps) {

    if (items.length === 0) {
        return (
            <div className="text-center text-muted-foreground py-10">
                没有可翻译的项目。
            </div>
        )
    }

    return (
        <div className="space-y-4">
            <div className="flex items-center justify-between pb-4">
                <h2 className="text-2xl font-bold">翻译编辑器</h2>
                <div className="text-sm text-muted-foreground">
                    {items.length} 条目
                </div>
            </div>
            <div className="grid gap-4">
                {items.map((item) => {
                    const currentTranslation = translations[item.id] || "";
                    const isMissing = !currentTranslation.trim();

                    return (
                        <Card key={item.id} className={`transition-all ${isMissing ? "border-destructive/30 bg-destructive/5" : "hover:border-primary/30"}`}>
                            <CardContent className="p-4 grid gap-4 grid-cols-1 md:grid-cols-2">
                                <div className="space-y-2">
                                    <Label className="text-xs text-muted-foreground font-mono">{item.id}</Label>
                                    <div className="p-3 bg-muted rounded-md text-sm whitespace-pre-wrap font-medium">
                                        {item.source}
                                    </div>
                                </div>
                                <div className="space-y-2">
                                    <div className="flex items-center justify-between">
                                        <Label className="text-xs text-muted-foreground">目标文本 (中文)</Label>
                                        {isMissing && (
                                            <div className="flex items-center text-destructive text-xs">
                                                <AlertCircle className="w-3 h-3 mr-1" />
                                                必填
                                            </div>
                                        )}
                                    </div>

                                    <Textarea
                                        value={currentTranslation}
                                        onChange={(e) => onTranslationChange(item.id, e.target.value)}
                                        className="min-h-[80px] font-medium resize-y"
                                        placeholder="在此输入翻译..."
                                        dir="auto"
                                    />
                                </div>
                            </CardContent>
                        </Card>
                    );
                })}
            </div>
        </div>
    );
}
