'use client'

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { Card, CardContent } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { cn } from "@/lib/utils"
import { updateSpeaker } from "@/app/actions/transcript"
import { Pencil } from "lucide-react"

export type Transcript = {
    id: string
    speaker: string
    content: string
    timestamp: number
    created_at: string
    session_id: string
}

interface TranscriptViewProps {
    transcripts: Transcript[]
    sessionId: string
}

export function TranscriptView({ transcripts, sessionId }: TranscriptViewProps) {
    // We track which speaker is being edited using the speaker's name as key
    // But since multiple rows share the same speaker name, we might want to just edit *that specific instance* 
    // and let the server bulk update.
    // However, for UI UX, it's better if we just have a small local state for the input.

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
                    <SpeakerLabel
                        sessionId={sessionId}
                        initialName={t.speaker}
                        isUser={t.speaker === 'user'}
                    />
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

function SpeakerLabel({ sessionId, initialName, isUser }: { sessionId: string, initialName: string, isUser: boolean }) {
    const [isEditing, setIsEditing] = useState(false)
    const [name, setName] = useState(initialName)
    const [isLoading, setIsLoading] = useState(false)
    const router = useRouter()

    useEffect(() => {
        setName(initialName)
    }, [initialName])

    const handleSave = async () => {
        if (!name.trim() || name === initialName) {
            setIsEditing(false)
            setName(initialName)
            return
        }

        setIsLoading(true)
        try {
            await updateSpeaker(sessionId, initialName, name)
            setIsEditing(false)
            router.refresh() // Ensure client cache is invalidated
        } catch (error) {
            alert('이름 변경 실패')
            setName(initialName)
        } finally {
            setIsLoading(false)
        }
    }

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter') handleSave()
        if (e.key === 'Escape') {
            setIsEditing(false)
            setName(initialName)
        }
    }

    if (isEditing) {
        return (
            <div className="flex items-center gap-1 h-6">
                <Input
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    onBlur={handleSave}
                    onKeyDown={handleKeyDown}
                    className="h-6 w-24 text-xs px-1 py-0"
                    autoFocus
                    disabled={isLoading}
                />
            </div>
        )
    }

    return (
        <div
            className="group flex items-center gap-1 cursor-pointer"
            onClick={() => !isUser && setIsEditing(true)} // Don't edit if it's 'user' (system reserved usually, or maybe we allow it? Let's assume 'user' is special/me)
        // Wait, AC says "As a user I want to rename speaker". 
        // If 'user' role is distinct from 'Me', we should allow renaming. 
        // The logic above: t.speaker === 'user' ? '나' : t.speaker. 
        // If it's literally the string 'user', we display '나'.
        // If the user wants to rename 'user' to their name, we should allow it but maybe the logic `t.speaker === 'user'` needs to stay for alignment? 
        // Let's allow renaming everything for now. If they rename 'user' to 'Bob', alignment might break if we rely on 'user' string. 
        // The mapping `t.speaker === 'user' ? "ml-auto..."` relies on the string 'user'.
        // If I change 'user' in DB to 'Bob', then `t.speaker === 'user'` becomes false, and alignment becomes left.
        // This is probably DESIRED behavior (only 'user' string is special right-aligned).
        // But if I want to rename 'Counselor' to 'Dr. Smith', that works fine (both left).
        // Let's disable renaming for 'user' string for now to preserve right-alignment logic unless we change how we detect 'Me'.
        >
            <span className="text-xs text-muted-foreground px-1 hover:text-primary transition-colors flex items-center gap-1">
                {isUser ? '나' : name}
                {!isUser && <Pencil className="w-3 h-3 opacity-0 group-hover:opacity-100" />}
            </span>
        </div>
    )
}
