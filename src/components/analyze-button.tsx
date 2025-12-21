'use client'

import { useFormStatus } from 'react-dom'
import { Button } from '@/components/ui/button'
import { Sparkles, Brain, Code, Heart } from 'lucide-react'
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { analyzeSession } from "@/app/actions/analysis"
import { useState } from "react"

export function AnalyzeAction({ sessionId }: { sessionId: string }) {
    const [isLoading, setIsLoading] = useState(false)

    const handleAnalyze = async (lens: string) => {
        setIsLoading(true)
        try {
            await analyzeSession(sessionId, lens)
        } catch (error) {
            alert('분석 요청 실패: ' + error)
        } finally {
            setIsLoading(false)
        }
    }

    return (
        <DropdownMenu>
            <DropdownMenuTrigger asChild>
                <Button variant="default" size="sm" disabled={isLoading} className="gap-2 bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-700 hover:to-indigo-700 border-0">
                    <Sparkles className="w-4 h-4" />
                    {isLoading ? '분석 중...' : 'AI 분석'}
                </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={() => handleAnalyze('empathy')}>
                    <Heart className="w-4 h-4 mr-2" />
                    공감 (Empathy)
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => handleAnalyze('logic')}>
                    <Brain className="w-4 h-4 mr-2" />
                    논리 (Logic)
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => handleAnalyze('miti')} className="bg-violet-50 text-violet-700 focus:bg-violet-100">
                    <Code className="w-4 h-4 mr-2" />
                    MITI 정밀 평가 (Beta)
                </DropdownMenuItem>
            </DropdownMenuContent>
        </DropdownMenu>
    )
}

// Keeping old export for compatibility if needed, but we will replace usage in Page.
export function AnalyzeButton() {
    return null;
}
