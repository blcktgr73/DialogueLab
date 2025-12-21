'use client'

import { useState } from "react"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { RefreshCcw, Lightbulb, ThumbsUp, XCircle } from "lucide-react"

export interface PracticeCardData {
    context: string
    actual_response: string
    speaker_name: string
    critique: string
    better_alternative: string
    rationale: string
}

export function PracticeCardList({ cards }: { cards: PracticeCardData[] }) {
    return (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {cards.map((card, idx) => (
                <PracticeCard key={idx} data={card} index={idx} />
            ))}
        </div>
    )
}

function PracticeCard({ data, index }: { data: PracticeCardData, index: number }) {
    const [isFlipped, setIsFlipped] = useState(false)

    return (
        <div className="perspective-1000 w-full h-[400px] cursor-pointer group" onClick={() => setIsFlipped(!isFlipped)}>
            <div className={cn(
                "relative w-full h-full transition-all duration-500 transform-style-3d",
                isFlipped ? "rotate-y-180" : ""
            )}>
                {/* Front Side */}
                <div className="absolute w-full h-full backface-hidden bg-white dark:bg-slate-900 border rounded-xl shadow-sm flex flex-col hover:shadow-md transition-shadow overflow-hidden">
                    <div className="p-6 flex flex-col h-full">
                        <div className="text-xs font-bold text-muted-foreground uppercase tracking-widest mb-4 flex-shrink-0">
                            Practice Card #{index + 1}
                        </div>

                        <div className="flex-1 overflow-y-auto pr-2 min-h-0 space-y-4 custom-scrollbar">
                            <div className="bg-muted/50 p-3 rounded-lg text-sm italic text-muted-foreground border-l-4 border-muted">
                                "{data.context}"
                            </div>

                            <div className="space-y-1">
                                <div className="text-xs font-semibold text-primary sticky top-0 bg-white dark:bg-slate-900 py-1">
                                    {data.speaker_name}의 실제 반응
                                </div>
                                <div className="text-base font-medium pb-2">"{data.actual_response}"</div>
                            </div>
                        </div>

                        <div className="mt-4 pt-0 flex-shrink-0">
                            <div className="bg-amber-50 dark:bg-amber-950/30 p-4 rounded-lg flex items-center gap-3 text-amber-700 dark:text-amber-400">
                                <Lightbulb className="w-5 h-5 flex-shrink-0" />
                                <span className="text-sm font-medium">카드를 뒤집어 피드백 확인하기</span>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Back Side */}
                <div className="absolute w-full h-full backface-hidden bg-slate-900 text-slate-50 dark:bg-slate-800 border rounded-xl shadow-lg rotate-y-180 flex flex-col overflow-hidden">
                    <div className="p-6 flex flex-col h-full">
                        <div className="flex-1 overflow-y-auto pr-2 min-h-0 space-y-6 custom-scrollbar">
                            <div>
                                <div className="flex items-center gap-2 mb-2 text-red-300">
                                    <XCircle className="w-4 h-4" />
                                    <span className="text-xs font-bold uppercase">Diagnosis</span>
                                </div>
                                <p className="text-sm leading-relaxed opacity-90">{data.critique}</p>
                            </div>

                            <div>
                                <div className="flex items-center gap-2 mb-2 text-green-300">
                                    <ThumbsUp className="w-4 h-4" />
                                    <span className="text-xs font-bold uppercase">Better Alternative</span>
                                </div>
                                <div className="bg-white/10 p-3 rounded-lg border border-white/10">
                                    <p className="text-lg font-medium">"{data.better_alternative}"</p>
                                </div>
                            </div>

                            <div>
                                <div className="text-xs font-bold uppercase text-slate-400 mb-1">Rationale</div>
                                <p className="text-xs text-slate-300">{data.rationale}</p>
                            </div>
                        </div>

                        <div className="mt-4 flex-shrink-0">
                            <Button variant="secondary" size="sm" className="w-full gap-2" onClick={(e) => {
                                e.stopPropagation();
                                setIsFlipped(false);
                            }}>
                                <RefreshCcw className="w-3 h-3" /> 다시 보기
                            </Button>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    )
}
