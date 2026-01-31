import { useState, useEffect } from "react";
import type { ParsedItem } from "@/lib/xml-utils";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { AlertCircle, ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight } from "lucide-react";


interface TranslationEditorProps {
    items: ParsedItem[];
    translations: Record<string, string>;
    onTranslationChange: (id: string, value: string) => void;
}

const ITEMS_PER_PAGE = 100;

function PaginationControls({
    currentPage,
    totalPages,
    onPageChange
}: {
    currentPage: number;
    totalPages: number;
    onPageChange: (page: number) => void;
}) {
    if (totalPages <= 1) return null;

    return (
        <div className="flex items-center justify-center gap-2 py-4">
            <Button
                variant="outline"
                size="icon"
                onClick={() => onPageChange(1)}
                disabled={currentPage === 1}
                title="第一页"
            >
                <ChevronsLeft className="h-4 w-4" />
            </Button>
            <Button
                variant="outline"
                size="icon"
                onClick={() => onPageChange(currentPage - 1)}
                disabled={currentPage === 1}
                title="上一页"
            >
                <ChevronLeft className="h-4 w-4" />
            </Button>

            <div className="flex items-center gap-2 mx-2">
                <span className="text-sm font-medium">
                    第 {currentPage} 页，共 {totalPages} 页
                </span>
            </div>

            <Button
                variant="outline"
                size="icon"
                onClick={() => onPageChange(currentPage + 1)}
                disabled={currentPage === totalPages}
                title="下一页"
            >
                <ChevronRight className="h-4 w-4" />
            </Button>
            <Button
                variant="outline"
                size="icon"
                onClick={() => onPageChange(totalPages)}
                disabled={currentPage === totalPages}
                title="最后一页"
            >
                <ChevronsRight className="h-4 w-4" />
            </Button>
        </div>
    );
}

export function TranslationEditor({
    items,
    translations,
    onTranslationChange,
}: TranslationEditorProps) {
    const [currentPage, setCurrentPage] = useState(1);

    // Reset loop if items change (e.g. new file loaded)
    useEffect(() => {
        setCurrentPage(1);
    }, [items]);

    const totalPages = Math.ceil(items.length / ITEMS_PER_PAGE);

    // Ensure current page is valid
    const safeCurrentPage = Math.min(Math.max(1, currentPage), Math.max(1, totalPages));

    if (safeCurrentPage !== currentPage) {
        setCurrentPage(safeCurrentPage);
    }

    const startIndex = (safeCurrentPage - 1) * ITEMS_PER_PAGE;
    const endIndex = Math.min(startIndex + ITEMS_PER_PAGE, items.length);
    const currentItems = items.slice(startIndex, endIndex);

    const scrollToTop = () => {
        window.scrollTo({ top: 0, behavior: 'smooth' });
    };

    const handlePageChange = (page: number) => {
        setCurrentPage(page);
        scrollToTop();
    };

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
                <div className="flex items-center gap-4 text-sm text-muted-foreground">
                    <div>
                        共 {items.length} 条目
                    </div>
                    {totalPages > 1 && (
                        <div className="flex items-center gap-2">
                            第 {safeCurrentPage} / {totalPages} 页
                        </div>
                    )}
                </div>
            </div>

            <PaginationControls
                currentPage={safeCurrentPage}
                totalPages={totalPages}
                onPageChange={handlePageChange}
            />

            <div className="grid gap-4">
                {currentItems.map((item) => {
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

            <PaginationControls
                currentPage={safeCurrentPage}
                totalPages={totalPages}
                onPageChange={handlePageChange}
            />
        </div>
    );
}


