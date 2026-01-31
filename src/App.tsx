import { useProjectState } from "@/hooks/use-project-state";
import { generateXML } from "@/lib/xml-utils";
import { XMLUploader } from "@/components/XMLUploader";
import { TranslationEditor } from "@/components/TranslationEditor";
import { TranslationControls } from "@/components/TranslationControls";
import { Button } from "@/components/ui/button";
import { Download, Trash2, Github } from "lucide-react";

export function App() {
    const {
        xmlContent,
        parsedItems,
        translations,
        settings,
        isLoading,
        setXmlContent,
        updateTranslation,
        updateSettings,
        clearProject,
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
            alert("Failed to parse JSON for translations.");
        }
    };

    const handleExport = () => {
        if (!xmlContent) return;
        try {
            const newXML = generateXML(xmlContent, translations);
            const blob = new Blob([newXML], { type: "text/xml" });
            const url = URL.createObjectURL(blob);
            const a = document.createElement("a");
            a.href = url;
            a.download = "translated_output.xml"; // Should probably use original name + suffix if possible, but we didn't store filename
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
        } catch (e) {
            console.error("Export failed", e);
            alert("Export failed.");
        }
    };

    if (isLoading) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-background">
                <div className="text-muted-foreground animate-pulse">Loading project...</div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-background font-sans">
            <header className="border-b sticky top-0 bg-background/95 backdrop-blur z-10">
                <div className="container mx-auto py-4 px-4 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                        <div className="w-8 h-8 bg-primary rounded-lg flex items-center justify-center text-primary-foreground font-bold">
                            S4
                        </div>
                        <h1 className="text-xl font-bold tracking-tight">Sims 4 Translator</h1>
                    </div>

                    <div className="flex items-center gap-2">
                        {xmlContent && (
                            <>
                                <Button variant="outline" size="sm" onClick={handleExport}>
                                    <Download className="w-4 h-4 mr-2" />
                                    Export XML
                                </Button>
                                <Button variant="destructive" size="sm" onClick={() => {
                                    if (confirm("Are you sure? This will clear all current progress.")) {
                                        clearProject();
                                    }
                                }}>
                                    <Trash2 className="w-4 h-4 mr-2" />
                                    Clear
                                </Button>
                            </>
                        )}
                        <a href="https://github.com" target="_blank" rel="noreferrer" className="ml-2 text-muted-foreground hover:text-foreground">
                            <Github className="w-5 h-5" />
                        </a>
                    </div>
                </div>
            </header>

            <main className="container mx-auto py-8 px-4">
                {!xmlContent ? (
                    <div className="flex flex-col items-center justify-center py-20 animate-in fade-in slide-in-from-bottom-5 duration-500">
                        <div className="text-center mb-8 space-y-2 max-w-lg">
                            <h1 className="text-4xl font-extrabold lg:text-5xl tracking-tight">
                                Translate your Sims 4 Mods with AI
                            </h1>
                            <p className="text-xl text-muted-foreground">
                                Upload your extracted XML files, verify strings, and use LLMs to translate them instantly.
                            </p>
                        </div>
                        <XMLUploader onUpload={setXmlContent} />
                    </div>
                ) : (
                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                        <div className="lg:col-span-1 space-y-6">
                            <div className="sticky top-24 space-y-6">
                                <TranslationControls
                                    items={parsedItems}
                                    settings={settings}
                                    onUpdateSettings={updateSettings}
                                    onApplyTranslations={handleApplyTranslations}
                                />
                            </div>
                        </div>
                        <div className="lg:col-span-2">
                            <TranslationEditor
                                items={parsedItems}
                                translations={translations}
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