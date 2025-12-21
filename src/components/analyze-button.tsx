'use client'

import { useFormStatus } from 'react-dom'
import { Button } from '@/components/ui/button'
import { Sparkles, Loader2 } from 'lucide-react'

export function AnalyzeButton() {
    const { pending } = useFormStatus()

    return (
        <Button
            type="submit"
            size="sm"
            variant="outline"
            className="gap-2 text-primary border-primary/20 hover:bg-primary/5"
            disabled={pending}
        >
            {pending ? (
                <>
                    <Loader2 className="w-3 h-3 animate-spin" />
                    분석 중...
                </>
            ) : (
                <>
                    <Sparkles className="w-3 h-3" />
                    AI 분석 (공감)
                </>
            )}
        </Button>
    )
}
