'use client'

import { useState } from 'react'
import Link from 'next/link'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import { MessageSquare, MoreVertical, Pencil, Trash2 } from 'lucide-react'
import { formatDistanceToNow } from 'date-fns'
import { ko } from 'date-fns/locale'
import { deleteSession, updateSessionTitle } from '@/app/actions/session'

interface SessionCardProps {
    session: {
        id: string
        title: string | null
        created_at: string
        mode: string
    }
}

export function SessionCard({ session }: SessionCardProps) {
    const [isEditing, setIsEditing] = useState(false)
    const [title, setTitle] = useState(session.title || '제목 없는 세션')
    const [isLoading, setIsLoading] = useState(false)

    const handleDelete = async (e: React.MouseEvent) => {
        e.preventDefault() // Prevent navigation
        if (!confirm('정말 이 세션을 삭제하시겠습니까? 복구할 수 없습니다.')) return

        try {
            await deleteSession(session.id)
        } catch (error) {
            alert('삭제 실패했습니다.')
        }
    }

    const handleUpdateTitle = async (e: React.FormEvent) => {
        e.preventDefault()
        if (!title.trim()) return

        setIsLoading(true)
        try {
            await updateSessionTitle(session.id, title)
            setIsEditing(false)
        } catch (error) {
            alert('수정 실패했습니다.')
        } finally {
            setIsLoading(false)
        }
    }

    if (isEditing) {
        return (
            <Card>
                <CardContent className="p-4 flex items-center justify-between gap-2">
                    <form onSubmit={handleUpdateTitle} className="flex-1 flex gap-2">
                        <Input
                            value={title}
                            onChange={(e) => setTitle(e.target.value)}
                            disabled={isLoading}
                            autoFocus
                        />
                        <Button type="submit" size="sm" disabled={isLoading}>저장</Button>
                        <Button type="button" variant="ghost" size="sm" onClick={() => setIsEditing(false)} disabled={isLoading}>취소</Button>
                    </form>
                </CardContent>
            </Card>
        )
    }

    return (
        <Link href={`/sessions/${session.id}`} className="block">
            <Card className="hover:bg-accent/50 transition-colors cursor-pointer group">
                <CardContent className="p-4 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <MessageSquare className="w-5 h-5 text-muted-foreground" />
                        <div className="flex flex-col">
                            <span className="font-medium group-hover:text-primary transition-colors">
                                {session.title || '제목 없는 세션'}
                            </span>
                            <span className="text-xs text-muted-foreground block">
                                {formatDistanceToNow(new Date(session.created_at), { addSuffix: true, locale: ko })}
                            </span>
                        </div>
                    </div>

                    <div className="flex items-center gap-2">
                        <div className="text-xs px-2 py-1 rounded-full bg-secondary text-secondary-foreground">
                            {session.mode === 'practice' ? '연습' : '자유'}
                        </div>

                        <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                                <Button variant="ghost" size="icon" className="h-8 w-8 opacity-0 group-hover:opacity-100 transition-opacity" onClick={(e) => e.preventDefault()}>
                                    <MoreVertical className="h-4 w-4" />
                                    <span className="sr-only">메뉴 열기</span>
                                </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                                <DropdownMenuItem onClick={(e) => { e.preventDefault(); setIsEditing(true); }}>
                                    <Pencil className="mr-2 h-4 w-4" />
                                    이름 변경
                                </DropdownMenuItem>
                                <DropdownMenuItem onClick={handleDelete} className="text-red-600 focus:text-red-600">
                                    <Trash2 className="mr-2 h-4 w-4" />
                                    삭제
                                </DropdownMenuItem>
                            </DropdownMenuContent>
                        </DropdownMenu>
                    </div>
                </CardContent>
            </Card>
        </Link>
    )
}
