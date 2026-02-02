import { useRef } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Upload } from "lucide-react";

interface XMLUploaderProps {
    onUpload: (filesData: { fileName: string; content: string }[]) => void;
}

export function XMLUploader({ onUpload }: XMLUploaderProps) {
    const fileInputRef = useRef<HTMLInputElement>(null);

    const handleFiles = async (fileList: FileList) => {
        const filesData: { fileName: string; content: string }[] = [];

        for (let i = 0; i < fileList.length; i++) {
            const file = fileList[i];
            const content = await new Promise<string>((resolve, reject) => {
                const reader = new FileReader();
                reader.onload = (e) => resolve(e.target?.result as string);
                reader.onerror = reject;
                reader.readAsText(file);
            });
            filesData.push({
                fileName: file.name,
                content,
            });
        }

        if (filesData.length > 0) {
            onUpload(filesData);
        }
    };

    const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
        const files = event.target.files;
        if (files && files.length > 0) {
            handleFiles(files);
        }
    };

    const handleDrop = (event: React.DragEvent) => {
        event.preventDefault();
        const files = event.dataTransfer.files;
        if (files && files.length > 0) {
            handleFiles(files);
        }
    };

    return (
        <Card className="w-full max-w-xl mx-auto mt-10 hover:border-primary/50 transition-colors cursor-pointer border-dashed border-2"
            onClick={() => fileInputRef.current?.click()}
            onDragOver={(e) => e.preventDefault()}
            onDrop={handleDrop}
        >
            <CardContent className="flex flex-col items-center justify-center p-10 space-y-4">
                <div className="p-4 bg-primary/10 rounded-full">
                    <Upload className="w-8 h-8 text-primary" />
                </div>
                <div className="text-center space-y-1">
                    <h3 className="text-lg font-semibold">上传 Sims 4 XML</h3>
                    <p className="text-sm text-muted-foreground">
                        将 xml 文件拖拽至此，或点击上传。<br />
                        <span className="text-primary">支持同时选择多个文件</span>
                    </p>
                </div>
                <input
                    type="file"
                    ref={fileInputRef}
                    onChange={handleFileChange}
                    accept=".xml"
                    multiple
                    className="hidden"
                />
                <Button variant="outline">选择文件</Button>
            </CardContent>
        </Card>
    );
}
