import { useProjectState } from "@/hooks/use-project-state";
import { generateXML } from "@/lib/xml-utils";
import { XMLUploader } from "@/components/XMLUploader";
import { TranslationEditor } from "@/components/TranslationEditor";
import { TranslationControls } from "@/components/TranslationControls";
import { Button } from "@/components/ui/button";
import { Download, FilePlus, Github, FileDown, Files } from "lucide-react";
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
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

export function App() {
    const {
        files,
        allParsedItems,
        allTranslations,
        settings,
        isLoading,
        addFiles,
        updateTranslation,
        updateSettings,
        clearProject,
        clearTranslations,
        getFileExportData,
    } = useProjectState();

    const handleApplyTranslations = (jsonString: string) => {
        try {
            const parsed = JSON.parse(jsonString);
            // parsed could be { "id": "text", ... }
            Object.entries(parsed).forEach(([id, text]) => {
                if (typeof text === 'string') {
                    updateTranslation(id, text);
                }
            });
        } catch (e) {
            alert("解析翻译 JSON 失败。");
        }
    };

    const handleExportSingle = (fileIndex: number) => {
        const fileData = getFileExportData(fileIndex);
        if (!fileData) return;

        try {
            const newXML = generateXML(fileData.xmlContent, fileData.translations);
            const blob = new Blob([newXML], { type: "text/xml" });
            const url = URL.createObjectURL(blob);
            const a = document.createElement("a");
            a.href = url;
            // 使用原始文件名，添加 _translated 后缀
            const baseName = fileData.fileName.replace(/\.xml$/i, "");
            a.download = `${baseName}_translated.xml`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
        } catch (e) {
            console.error("Export failed", e);
            alert("导出失败。");
        }
    };

    const handleExportAll = () => {
        files.forEach((_, index) => {
            handleExportSingle(index);
        });
    };

    if (isLoading) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-background">
                <div className="text-muted-foreground animate-pulse">加载中...</div>
            </div>
        );
    }

    const hasFiles = files.length > 0;

    return (
        <div className="min-h-screen bg-background font-sans">
            <header className="border-b sticky top-0 bg-background/95 backdrop-blur z-10">
                <div className="container mx-auto py-4 px-4 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                        <div className="w-8 h-8 bg-primary rounded-lg flex items-center justify-center text-primary-foreground font-bold">
                            S4
                        </div>
                        <h1 className="text-xl font-bold tracking-tight">Sims 4 翻译助手</h1>
                        {hasFiles && (
                            <span className="text-sm text-muted-foreground ml-2">
                                ({files.length} 个文件)
                            </span>
                        )}
                    </div>

                    <div className="flex items-center gap-2">
                        {hasFiles && (
                            <>
                                {files.length === 1 ? (
                                    <Button variant="outline" size="sm" onClick={() => handleExportSingle(0)}>
                                        <Download className="w-4 h-4 mr-2" />
                                        导出 XML
                                    </Button>
                                ) : (
                                    <DropdownMenu>
                                        <DropdownMenuTrigger asChild>
                                            <Button variant="outline" size="sm">
                                                <Download className="w-4 h-4 mr-2" />
                                                导出 XML
                                            </Button>
                                        </DropdownMenuTrigger>
                                        <DropdownMenuContent align="end" className="max-h-80 overflow-auto">
                                            <DropdownMenuItem onClick={handleExportAll}>
                                                <Files className="w-4 h-4 mr-2" />
                                                导出全部 ({files.length} 个文件)
                                            </DropdownMenuItem>
                                            <DropdownMenuSeparator />
                                            {files.map((file, index) => (
                                                <DropdownMenuItem
                                                    key={index}
                                                    onClick={() => handleExportSingle(index)}
                                                >
                                                    <FileDown className="w-4 h-4 mr-2" />
                                                    {file.fileName}
                                                </DropdownMenuItem>
                                            ))}
                                        </DropdownMenuContent>
                                    </DropdownMenu>
                                )}
                                <AlertDialog>
                                    <AlertDialogTrigger asChild>
                                        <Button variant="ghost" size="sm">
                                            <FilePlus className="w-4 h-4 mr-2" />
                                            翻译新文件
                                        </Button>
                                    </AlertDialogTrigger>
                                    <AlertDialogContent>
                                        <AlertDialogHeader>
                                            <AlertDialogTitle>确认开始新文件？</AlertDialogTitle>
                                            <AlertDialogDescription>
                                                这将清空当前所有进度，确定要继续吗？
                                            </AlertDialogDescription>
                                        </AlertDialogHeader>
                                        <AlertDialogFooter>
                                            <AlertDialogCancel>取消</AlertDialogCancel>
                                            <AlertDialogAction onClick={clearProject}>确认</AlertDialogAction>
                                        </AlertDialogFooter>
                                    </AlertDialogContent>
                                </AlertDialog>
                            </>
                        )}
                        <a href="https://github.com/playerwindbird/sims4-llm-translator" target="_blank" rel="noreferrer" className="ml-2 text-muted-foreground hover:text-foreground">
                            <Github className="w-5 h-5" />
                        </a>
                    </div>
                </div>
            </header>

            <main className="container mx-auto py-8 px-4">
                {!hasFiles ? (
                    <div className="flex flex-col items-center justify-center py-20 animate-in fade-in slide-in-from-bottom-5 duration-500">
                        <div className="text-center mb-8 space-y-2 max-w-lg">
                            <h1 className="text-4xl font-extrabold lg:text-5xl tracking-tight">
                                用 AI 翻译您的 Sims 4 Mod
                            </h1>
                            <p className="text-xl text-muted-foreground">
                                上传 XML 文件，校验文本，并使用 AI 极速完成翻译。
                            </p>
                        </div>
                        <XMLUploader onUpload={addFiles} />
                    </div>
                ) : (
                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                        <div className="lg:col-span-1 space-y-6">
                            <div className="sticky top-24 space-y-6">
                                <TranslationControls
                                    items={allParsedItems}
                                    translations={allTranslations}
                                    settings={settings}
                                    onUpdateSettings={updateSettings}
                                    onApplyTranslations={handleApplyTranslations}
                                    onClearTranslations={clearTranslations}
                                />
                            </div>
                        </div>
                        <div className="lg:col-span-2">
                            <TranslationEditor
                                items={allParsedItems}
                                translations={allTranslations}
                                onTranslationChange={updateTranslation}
                            />
                        </div>
                    </div>
                )}
            </main>
        </div>
    );
}

export default App;