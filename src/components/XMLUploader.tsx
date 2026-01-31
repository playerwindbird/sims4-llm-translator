import { useRef } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Upload } from "lucide-react";

interface XMLUploaderProps {
    onUpload: (content: string) => void;
}

export function XMLUploader({ onUpload }: XMLUploaderProps) {
    const fileInputRef = useRef<HTMLInputElement>(null);

    const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (file) {
            const reader = new FileReader();
            reader.onload = (e) => {
                const content = e.target?.result as string;
                onUpload(content);
            };
            reader.readAsText(file);
        }
    };

    const handleDrop = (event: React.DragEvent) => {
        event.preventDefault();
        const file = event.dataTransfer.files?.[0];
        if (file) {
            const reader = new FileReader();
            reader.onload = (e) => {
                const content = e.target?.result as string;
                onUpload(content);
            };
            reader.readAsText(file);
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
                    <h3 className="text-lg font-semibold">Upload Sims 4 XML</h3>
                    <p className="text-sm text-muted-foreground">
                        Drag and drop your extracted .xml file here, or click to browse.
                    </p>
                </div>
                <input
                    type="file"
                    ref={fileInputRef}
                    onChange={handleFileChange}
                    accept=".xml"
                    className="hidden"
                />
                <Button variant="outline">Select File</Button>
            </CardContent>
        </Card>
    );
}
