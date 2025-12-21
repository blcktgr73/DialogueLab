'use client'

import { useState } from 'react'
import { updateSessionTitle } from '@/app/actions/session'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Pencil } from 'lucide-react'

interface SessionTitleProps {
    sessionId: string
    initialTitle: string | null
}

export function SessionTitle({ sessionId, initialTitle }: SessionTitleProps) {
    const [isEditing, setIsEditing] = useState(false)
    const [title, setTitle] = useState(initialTitle || '제목 없는 세션')
    const [isLoading, setIsLoading] = useState(false)

    const handleUpdate = async (e: React.FormEvent) => {
        e.preventDefault()
        if (!title.trim()) return

        setIsLoading(true)
        try {
            await updateSessionTitle(sessionId, title)
            setIsEditing(false)
        } catch (error) {
            alert('제목 수정 실패')
        } finally {
            setIsLoading(false)
        }
    }

    if (isEditing) {
        return (
            <form onSubmit={handleUpdate} className="flex gap-2 items-center">
                <Input
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    className="text-lg font-bold h-9"
                    autoFocus
                    disabled={isLoading}
                />
                <Button type="submit" size="sm" disabled={isLoading}>저장</Button>
                <Button type="button" variant="ghost" size="sm" onClick={() => setIsEditing(false)} disabled={isLoading}>취소</Button>
            </form>
        )
    }

    return (
        <div className="flex items-center gap-2 group cursor-pointer" onClick={() => setIsEditing(true)}>
            <h1 className="text-xl font-bold tracking-tight hover:underline decoration-dashed underline-offset-4 decoration-muted-foreground/50">
                {title}
            </h1>
            <Pencil className="w-4 h-4 text-muted-foreground opacity-0 group-hover:opacity-50" />
        </div>
    )
}
