'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { parseTranscriptFile, TranscriptEntry } from '@/lib/parsers'
import { bulkAddTranscripts } from '@/app/actions/transcript'
import { Upload } from 'lucide-react'

export function TranscriptUploader({ sessionId }: { sessionId: string }) {
    const [isParsing, setIsParsing] = useState(false)
    const [preview, setPreview] = useState<TranscriptEntry[]>([])
    const [file, setFile] = useState<File | null>(null)

    const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const selectedFile = e.target.files?.[0]
        if (!selectedFile) return

        setFile(selectedFile)
        setIsParsing(true)
        try {
            const data = await parseTranscriptFile(selectedFile)
            setPreview(data)
        } catch (err: any) {
            alert('파일 파싱 실패: ' + err.message)
            setFile(null)
            setPreview([])
        } finally {
            setIsParsing(false)
        }
    }

    const handleSave = async () => {
        if (preview.length === 0 || !file) return // Ensure file exists for its name
        try {
            // The original parseTranscriptFile already returns TranscriptEntry[], so 'preview' is already the parsed data.
            // The instruction seems to imply re-parsing or using a different parse function,
            // but given the existing structure, we'll pass 'preview' as the transcripts.
            // We'll assume 'parseTranscript' is a new function or a renamed 'parseTranscriptFile'
            // and 'text' would be the file content, but for now, we use the already parsed 'preview'.
            // If 'parseTranscript' is meant to be called here, 'text' would need to be read from 'file'.

            // Assuming the intent is to pass the already parsed 'preview' and the 'file.name'
            await bulkAddTranscripts(sessionId, preview, file.name)
            setPreview([])
            setFile(null)
            toast({
                title: '업로드 성공',
                description: `${preview.length}개의 대화가 추가되었습니다.`,
            })
        } catch (err: any) {
            toast({
                title: '저장 실패',
                description: err.message || '축어록 저장 중 오류가 발생했습니다.',
                variant: 'destructive',
            })
        }
    }

    return (
        <div className="p-4 border-t bg-background space-y-4">
            <div className="flex items-center gap-4">
                <div className="relative">
                    <input
                        type="file"
                        accept=".txt,.csv,.xls,.xlsx"
                        onChange={handleFileChange}
                        className="absolute inset-0 opacity-0 cursor-pointer w-full h-full"
                    />
                    <Button variant="outline" className="gap-2 pointer-events-none">
                        <Upload className="w-4 h-4" />
                        {file ? file.name : '축어록 파일 업로드 (TXT/Excel)'}
                    </Button>
                </div>

                {preview.length > 0 && (
                    <Button onClick={handleSave} variant="default">
                        {preview.length}개 대화 저장하기
                    </Button>
                )}
            </div>

            {preview.length > 0 && (
                <Card className="max-h-60 overflow-y-auto bg-muted/50 border-none">
                    <CardContent className="p-4 space-y-2 text-xs">
                        <h4 className="font-semibold mb-2">미리보기 (상위 5개)</h4>
                        {preview.slice(0, 5).map((p, i) => (
                            <div key={i} className="flex gap-2">
                                <span className="font-bold min-w-[50px]">{p.speaker}:</span>
                                <span className="text-muted-foreground truncate">{p.content}</span>
                            </div>
                        ))}
                        {preview.length > 5 && (
                            <div className="text-center text-muted-foreground pt-2">
                                ...외 {preview.length - 5}개 항목
                            </div>
                        )}
                    </CardContent>
                </Card>
            )}
        </div>
    )
}
