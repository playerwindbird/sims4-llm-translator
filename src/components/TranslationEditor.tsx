import { useState, useEffect, useMemo } from "react";
import type { ParsedItem } from "@/lib/xml-utils";
import type { FileData } from "@/hooks/use-project-state";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight, FileText, Files } from "lucide-react";


interface TranslationEditorProps {
    files: FileData[];
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

function ItemsList({
    items,
    translations,
    onTranslationChange,
}: {
    items: ParsedItem[];
    translations: Record<string, string>;
    onTranslationChange: (id: string, value: string) => void;
}) {
    const [currentPage, setCurrentPage] = useState(1);

    // 当 items 改变时重置页码
    useEffect(() => {
        setCurrentPage(1);
    }, [items]);

    const totalPages = Math.ceil(items.length / ITEMS_PER_PAGE);
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
        );
    }

    return (
        <div className="space-y-4">
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
                                    <Label className="text-xs text-muted-foreground">目标文本 (中文)</Label>

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

export function TranslationEditor({
    files,
    items,
    translations,
    onTranslationChange,
}: TranslationEditorProps) {
    const [activeTab, setActiveTab] = useState("all");

    // 获取当前标签页对应的 items
    const currentItems = useMemo(() => {
        if (activeTab === "all") {
            return items;
        }
        const fileIndex = parseInt(activeTab, 10);
        const file = files[fileIndex];
        return file ? file.parsedItems : [];
    }, [activeTab, items, files]);

    // 获取当前标签页的条目总数
    const currentItemCount = currentItems.length;

    // 只显示单个文件时不需要标签页
    const showTabs = files.length > 1;

    // 截取文件名（去掉路径和扩展名），最多显示20个字符
    const getShortFileName = (fileName: string) => {
        const name = fileName.replace(/\.[^/.]+$/, ""); // 去掉扩展名
        return name.length > 20 ? name.substring(0, 17) + "..." : name;
    };

    if (items.length === 0) {
        return (
            <div className="text-center text-muted-foreground py-10">
                没有可翻译的项目。
            </div>
        );
    }

    return (
        <div className="space-y-4">
            <div className="flex items-center justify-between pb-4">
                <h2 className="text-2xl font-bold">翻译编辑器</h2>
                <div className="text-sm text-muted-foreground">
                    共 {currentItemCount} 条目
                </div>
            </div>

            {showTabs ? (
                <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
                    <div className="overflow-x-auto pb-2">
                        <TabsList variant="line" className="w-auto min-w-full flex-nowrap">
                            <TabsTrigger value="all" className="gap-2 shrink-0">
                                <Files className="h-4 w-4" />
                                <span>全部</span>
                                <span className="ml-1 rounded-full bg-muted-foreground/20 px-2 py-0.5 text-xs">
                                    {items.length}
                                </span>
                            </TabsTrigger>
                            {files.map((file, index) => (
                                <TabsTrigger
                                    key={index}
                                    value={index.toString()}
                                    className="gap-2 shrink-0"
                                    title={file.fileName}
                                >
                                    <FileText className="h-4 w-4" />
                                    <span>{getShortFileName(file.fileName)}</span>
                                    <span className="ml-1 rounded-full bg-muted-foreground/20 px-2 py-0.5 text-xs">
                                        {file.parsedItems.length}
                                    </span>
                                </TabsTrigger>
                            ))}
                        </TabsList>
                    </div>
                    <TabsContent value="all">
                        <ItemsList
                            items={items}
                            translations={translations}
                            onTranslationChange={onTranslationChange}
                        />
                    </TabsContent>
                    {files.map((file, index) => (
                        <TabsContent key={index} value={index.toString()}>
                            <ItemsList
                                items={file.parsedItems}
                                translations={translations}
                                onTranslationChange={onTranslationChange}
                            />
                        </TabsContent>
                    ))}
                </Tabs>
            ) : (
                <ItemsList
                    items={items}
                    translations={translations}
                    onTranslationChange={onTranslationChange}
                />
            )}
        </div>
    );
}
