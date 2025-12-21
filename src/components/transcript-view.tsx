import { Card, CardContent } from "@/components/ui/card"
import { cn } from "@/lib/utils"

export type Transcript = {
    id: string
    speaker: string
    content: string
    timestamp: number
    created_at: string
}

export function TranscriptView({ transcripts }: { transcripts: Transcript[] }) {
    if (transcripts.length === 0) {
        return (
            <div className="text-center py-12 text-muted-foreground">
                아직 기록된 대화가 없습니다.
            </div>
        )
    }

    return (
        <div className="space-y-4">
            {transcripts.map((t) => (
                <div key={t.id} className={cn(
                    "flex flex-col gap-1 max-w-[85%]",
                    t.speaker === 'user' ? "ml-auto items-end" : "items-start"
                )}>
                    <span className="text-xs text-muted-foreground px-1">
                        {t.speaker === 'user' ? '나' : t.speaker}
                    </span>
                    <Card className={cn(
                        "border-none shadow-sm",
                        t.speaker === 'user' ? "bg-primary text-primary-foreground" : "bg-muted"
                    )}>
                        <CardContent className="p-3 text-sm leading-relaxed">
                            {t.content}
                        </CardContent>
                    </Card>
                </div>
            ))}
        </div>
    )
}
