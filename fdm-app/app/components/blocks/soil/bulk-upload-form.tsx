import { FileText, FileUp, Trash2, Upload, X } from "lucide-react"
import { useState } from "react"
import { toast } from "sonner"
import { Dropzone } from "~/components/custom/dropzone"
import { Button } from "~/components/ui/button"
import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
} from "~/components/ui/card"
import { Progress } from "~/components/ui/progress"
import { ScrollArea } from "~/components/ui/scroll-area"
import { Spinner } from "~/components/ui/spinner"
import { cn } from "~/lib/utils"
import type { ProcessedAnalysis } from "./bulk-upload-review"

export function BulkSoilAnalysisUploadForm({
    onSuccess,
}: {
    onSuccess: (data: ProcessedAnalysis[]) => void
}) {
    const [files, setFiles] = useState<File[]>([])
    const [isUploading, setIsUploading] = useState(false)
    const [uploadProgress, setUploadProgress] = useState(0)
    const [currentFile, setCurrentFile] = useState<string | null>(null)
    const MAX_FILE_SIZE = 5 * 1024 * 1024

    const handleFilesChange = (newFiles: File[]) => {
        setFiles(newFiles)
    }

    const handleUpload = async () => {
        if (files.length === 0) return

        setIsUploading(true)
        setUploadProgress(0)

        const allResults: any[] = []
        const totalFiles = files.length
        let completedFiles = 0
        let errorOccurred = false

        const formData = new FormData()
        for (const file of files) {
            formData.append("soilAnalysisFile", file)
        }

        try {
            const response = await fetch("/api/soil-analysis/extract", {
                method: "POST",
                body: formData,
                credentials: "same-origin",
            })

            if (!response.ok) {
                let errorMessage = "Fout bij starten van analyse"
                try {
                    const errorData = await response.json()
                    errorMessage =
                        errorData.message || errorData.error || errorMessage
                } catch {
                    try {
                        const textError = await response.text()
                        if (textError) errorMessage = textError
                    } catch {
                        // Ignore text parsing errors
                    }
                }
                throw new Error(`${errorMessage} (Status: ${response.status})`)
            }

            if (!response.body) {
                throw new Error("Geen stream response ontvangen")
            }

            const reader = response.body.getReader()
            const decoder = new TextDecoder()
            let buffer = ""

            while (true) {
                const { done, value } = await reader.read()
                if (done) break

                buffer += decoder.decode(value, { stream: true })
                const lines = buffer.split("\n")
                // Keep the last partial line in the buffer
                buffer = lines.pop() || ""

                for (const line of lines) {
                    if (!line.trim()) continue
                    try {
                        const result = JSON.parse(line)
                        completedFiles++

                        if (result.success && result.analyses) {
                            allResults.push(...result.analyses)
                        } else if (result.error) {
                            toast.error(
                                `Fout bij ${result.filename}: ${result.error}`,
                            )
                        }

                        setCurrentFile(result.filename)
                        setUploadProgress(
                            Math.round((completedFiles / totalFiles) * 100),
                        )
                    } catch (e) {
                        console.error("Error parsing NDJSON line:", e)
                    }
                }
            }

            // Process final partial line if exists
            if (buffer.trim()) {
                try {
                    const result = JSON.parse(buffer)
                    completedFiles++

                    if (result.success && result.analyses) {
                        allResults.push(...result.analyses)
                    } else if (result.error) {
                        toast.error(
                            `Fout bij ${result.filename}: ${result.error}`,
                        )
                    }

                    setCurrentFile(result.filename)
                    setUploadProgress(
                        Math.round((completedFiles / totalFiles) * 100),
                    )
                } catch (e) {
                    console.error("Error parsing final NDJSON line:", e)
                }
            }
        } catch (error) {
            console.error("Bulk upload error:", error)
            toast.error(
                error instanceof Error ? error.message : "Upload mislukt",
            )
            errorOccurred = true
        } finally {
            setIsUploading(false)
            setCurrentFile(null)

            if (allResults.length > 0) {
                toast.success(
                    `${allResults.length} analyses succesvol verwerkt`,
                )
                onSuccess(allResults)
            } else if (!errorOccurred && totalFiles > 0) {
                toast.error("Geen analyses kunnen verwerken")
            }
        }
    }

    const removeFile = (index: number) => {
        const newFiles = [...files]
        newFiles.splice(index, 1)
        setFiles(newFiles)
    }

    const formatFileSize = (bytes: number) => {
        if (bytes === 0) return "0 B"
        const k = 1024
        const sizes = ["B", "KB", "MB", "GB"]
        const i = Math.floor(Math.log(bytes) / Math.log(k))
        return `${Number.parseFloat((bytes / k ** i).toFixed(2))} ${sizes[i]}`
    }

    return (
        <Card className="w-full">
            <CardHeader>
                <CardTitle>Bodemanalyses uploaden</CardTitle>
                <CardDescription>
                    Sleep PDF-bestanden hierheen om ze te analyseren en te
                    koppelen aan percelen.
                </CardDescription>
            </CardHeader>
            <CardContent>
                <div
                    className={cn(
                        "grid gap-6",
                        files.length > 0 ? "lg:grid-cols-2" : "",
                    )}
                >
                    {/* Dropzone Column */}
                    <div className="flex flex-col h-full">
                        <Dropzone
                            name="soilAnalysisFiles"
                            accept=".pdf"
                            multiple
                            value={files}
                            onFilesChange={handleFilesChange}
                            allowReset={false}
                            maxSize={MAX_FILE_SIZE}
                            disabled={isUploading}
                            className={cn(
                                "w-full transition-all duration-200 border-2",
                                files.length > 0
                                    ? "h-64 lg:h-full min-h-[300px]"
                                    : "h-64",
                            )}
                        >
                            <div className="flex flex-col items-center justify-center space-y-4 text-center px-4">
                                <div
                                    className={cn(
                                        "flex items-center justify-center rounded-full bg-muted transition-colors",
                                        files.length > 0
                                            ? "h-12 w-12"
                                            : "h-16 w-16",
                                    )}
                                >
                                    <Upload
                                        className={cn(
                                            "text-muted-foreground",
                                            files.length > 0
                                                ? "h-6 w-6"
                                                : "h-8 w-8",
                                        )}
                                    />
                                </div>
                                <div className="space-y-1">
                                    <p className="text-sm font-medium text-foreground">
                                        {files.length > 0
                                            ? "Voeg meer bestanden toe"
                                            : "Sleep bestanden hierheen"}
                                    </p>
                                    <p className="text-xs text-muted-foreground">
                                        PDF, max 5MB per bestand
                                    </p>
                                </div>
                            </div>
                        </Dropzone>
                    </div>

                    {/* File List Column */}
                    {files.length > 0 && (
                        <div className="flex flex-col h-full min-h-[300px]">
                            <div className="flex items-center justify-between mb-3">
                                <h4 className="text-sm font-medium leading-none flex items-center gap-2">
                                    Geselecteerde bestanden{" "}
                                    <span className="text-muted-foreground text-xs font-normal">
                                        ({files.length})
                                    </span>
                                </h4>
                                <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => setFiles([])}
                                    disabled={isUploading}
                                    className="h-8 px-2 text-xs text-muted-foreground hover:text-destructive"
                                >
                                    <Trash2 className="mr-2 h-3 w-3" />
                                    Alles wissen
                                </Button>
                            </div>

                            <div className="flex-1 rounded-md border relative flex flex-col overflow-hidden">
                                <ScrollArea className="flex-1 h-[300px] lg:h-auto">
                                    <div className="p-3 space-y-2">
                                        {files.map((file, index) => (
                                            <div
                                                key={`${file.name}-${index}`}
                                                className="flex items-center justify-between rounded-md border bg-card p-2 shadow-sm group"
                                            >
                                                <div className="flex items-center space-x-3 overflow-hidden">
                                                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-muted/50 text-muted-foreground group-hover:text-primary group-hover:bg-primary/10 transition-colors">
                                                        <FileText className="h-4 w-4" />
                                                    </div>
                                                    <div className="min-w-0">
                                                        <p
                                                            className="truncate text-sm font-medium leading-none"
                                                            title={file.name}
                                                        >
                                                            {file.name}
                                                        </p>
                                                        <p className="text-xs text-muted-foreground mt-1">
                                                            {formatFileSize(
                                                                file.size,
                                                            )}
                                                        </p>
                                                    </div>
                                                </div>
                                                <Button
                                                    variant="ghost"
                                                    size="icon"
                                                    className="h-8 w-8 text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                                                    onClick={() =>
                                                        removeFile(index)
                                                    }
                                                    disabled={isUploading}
                                                >
                                                    <X className="h-4 w-4" />
                                                    <span className="sr-only">
                                                        Verwijder bestand
                                                    </span>
                                                </Button>
                                            </div>
                                        ))}
                                    </div>
                                </ScrollArea>
                            </div>

                            {isUploading && (
                                <div className="mt-4 space-y-2">
                                    <div className="flex justify-between text-xs">
                                        <span className="text-muted-foreground truncate max-w-[200px]">
                                            {uploadProgress >= 100
                                                ? "Voltooien..."
                                                : currentFile
                                                  ? `Analyseert: ${currentFile}`
                                                  : "Bestanden verwerken..."}
                                        </span>
                                        <span className="font-medium">
                                            {uploadProgress}%
                                        </span>
                                    </div>
                                    <Progress
                                        value={uploadProgress}
                                        className="h-1"
                                    />
                                </div>
                            )}

                            <div className="pt-4 mt-auto flex justify-end">
                                <Button
                                    onClick={handleUpload}
                                    disabled={isUploading || files.length === 0}
                                    className="w-full lg:w-auto min-w-[140px]"
                                >
                                    {isUploading ? (
                                        <>
                                            <Spinner className="mr-2 h-4 w-4 animate-spin" />
                                            Verwerken...
                                        </>
                                    ) : (
                                        <>
                                            <FileUp className="mr-2 h-4 w-4" />
                                            Upload analyses
                                        </>
                                    )}
                                </Button>
                            </div>
                        </div>
                    )}
                </div>
            </CardContent>
        </Card>
    )
}
