'use client'

import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
} from "@/components/ui/card"
import {
    Tabs,
    TabsContent,
    TabsList,
    TabsTrigger,
} from "@/components/ui/tabs"
import {
    Radar,
    RadarChart,
    PolarGrid,
    PolarAngleAxis,
    PolarRadiusAxis,
    ResponsiveContainer,
    BarChart,
    Bar,
    XAxis,
    YAxis,
    Tooltip,
    Legend
} from 'recharts';
import { Badge } from "@/components/ui/badge";

// Types matching the Gemini Output
interface MitiSpeakerEvaluation {
    role_interviewer: {
        global_scores: {
            cultivating_change_talk: number
            softening_sustain_talk: number
            partnership: number
            empathy: number
        }
        behavior_counts: {
            question_open: number
            question_closed: number
            reflection_simple: number
            reflection_complex: number
            mi_adherent: number
            mi_non_adherent: number
        }
        strength: string
        weakness: string
    }
    role_client: {
        change_talk_count: number
        sustain_talk_count: number
        self_disclosure_rating: number
        primary_motivation: string
    }
}

interface MitiDashboardProps {
    speakers: Record<string, MitiSpeakerEvaluation>
}

export function MitiDashboard({ speakers }: MitiDashboardProps) {
    const speakerNames = Object.keys(speakers);
    if (speakerNames.length === 0) return <div>분석 데이터가 없습니다.</div>;

    // Data Transformation for Charts
    // 1. Global Scores Radar Chart Data
    // We want to compare speakers on the same chart, or show tabs?
    // Side-by-side comparison on one chart is good for symmetric evaluation.

    const globalScoreMetrics = [
        { key: 'cultivating_change_talk', label: '변화대화 형성' },
        { key: 'softening_sustain_talk', label: '유지대화 완화' },
        { key: 'partnership', label: '동반자 관계' },
        { key: 'empathy', label: '공감' },
    ];

    const radarData = globalScoreMetrics.map(metric => {
        const dataPoint: any = { subject: metric.label, fullMark: 5 };
        speakerNames.forEach(name => {
            const interviewerData = speakers[name]?.role_interviewer;
            dataPoint[name] = interviewerData?.global_scores?.[metric.key as keyof MitiSpeakerEvaluation['role_interviewer']['global_scores']] || 0;
        });
        return dataPoint;
    });

    // 2. Behavior Counts Bar Chart
    const behaviorMetrics = [
        { key: 'question_open', label: '열린 질문' },
        { key: 'question_closed', label: '닫힌 질문' },
        { key: 'reflection_simple', label: '단순 반영' },
        { key: 'reflection_complex', label: '복합 반영' },
        { key: 'mi_adherent', label: 'MI 일치' },
        { key: 'mi_non_adherent', label: 'MI 불일치' },
    ];

    const barData = behaviorMetrics.map(metric => {
        const dataPoint: any = { name: metric.label };
        speakerNames.forEach(name => {
            const interviewerData = speakers[name]?.role_interviewer;
            dataPoint[name] = interviewerData?.behavior_counts?.[metric.key as keyof MitiSpeakerEvaluation['role_interviewer']['behavior_counts']] || 0;
        });
        return dataPoint;
    });

    // Colors for speakers
    const colors = ['#8884d8', '#82ca9d', '#ffc658'];

    return (
        <div className="space-y-6">
            <h2 className="text-2xl font-bold tracking-tight">MITI 정밀 분석 결과</h2>

            <Tabs defaultValue="interviewer" className="w-full">
                <TabsList className="grid w-full grid-cols-2">
                    <TabsTrigger value="interviewer">상담자 관점 (Interviewer)</TabsTrigger>
                    <TabsTrigger value="client">내담자 관점 (Client)</TabsTrigger>
                </TabsList>

                <TabsContent value="interviewer" className="space-y-6 mt-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        {/* Radar Chart: Global Scores */}
                        <Card>
                            <CardHeader>
                                <CardTitle className="text-sm font-medium">전반적 척도 (Global Scores)</CardTitle>
                                <CardDescription>1~5점 (높을수록 좋음)</CardDescription>
                            </CardHeader>
                            <CardContent className="h-[300px] w-full p-4">
                                <div className="w-full h-full min-h-[300px]">
                                    <ResponsiveContainer width="100%" height="100%" minHeight={300} minWidth={0}>
                                        <RadarChart cx="50%" cy="50%" outerRadius="80%" data={radarData}>
                                            <PolarGrid />
                                            <PolarAngleAxis dataKey="subject" />
                                            <PolarRadiusAxis angle={30} domain={[0, 5]} />
                                            {speakerNames.map((name, idx) => (
                                                <Radar
                                                    key={name}
                                                    name={name}
                                                    dataKey={name}
                                                    stroke={colors[idx % colors.length]}
                                                    fill={colors[idx % colors.length]}
                                                    fillOpacity={0.3}
                                                />
                                            ))}
                                            <Legend />
                                            <Tooltip />
                                        </RadarChart>
                                    </ResponsiveContainer>
                                </div>
                            </CardContent>
                        </Card>

                        {/* Bar Chart: Behaviors */}
                        <Card>
                            <CardHeader>
                                <CardTitle className="text-sm font-medium">행동 빈도 (Behavior Counts)</CardTitle>
                                <CardDescription>각 대화 기술 사용 횟수</CardDescription>
                            </CardHeader>
                            <CardContent className="h-[300px] w-full p-4">
                                <div className="w-full h-full min-h-[300px]">
                                    <ResponsiveContainer width="100%" height="100%" minHeight={300} minWidth={0}>
                                        <BarChart data={barData} layout="vertical" margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
                                            <XAxis type="number" allowDecimals={false} />
                                            <YAxis dataKey="name" type="category" width={80} fontSize={12} />
                                            <Tooltip />
                                            <Legend />
                                            {speakerNames.map((name, idx) => (
                                                <Bar key={name} dataKey={name} fill={colors[idx % colors.length]} radius={[0, 4, 4, 0]} />
                                            ))}
                                        </BarChart>
                                    </ResponsiveContainer>
                                </div>
                            </CardContent>
                        </Card>
                    </div>

                    {/* Qualitative Feedback */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {speakerNames.map((name, idx) => {
                            const interviewerData = speakers[name]?.role_interviewer;
                            if (!interviewerData) return null;

                            return (
                                <Card key={name} className="bg-muted/30">
                                    <CardHeader>
                                        <CardTitle className="text-base flex items-center gap-2">
                                            <span className="w-3 h-3 rounded-full" style={{ backgroundColor: colors[idx % colors.length] }} />
                                            {name}의 강점과 약점
                                        </CardTitle>
                                    </CardHeader>
                                    <CardContent className="space-y-4">
                                        <div>
                                            <h4 className="text-sm font-semibold text-green-600 mb-1">잘한 점 (Strength)</h4>
                                            <p className="text-sm">{interviewerData.strength}</p>
                                        </div>
                                        <div>
                                            <h4 className="text-sm font-semibold text-red-500 mb-1">아쉬운 점 (Weakness)</h4>
                                            <p className="text-sm">{interviewerData.weakness}</p>
                                        </div>
                                    </CardContent>
                                </Card>
                            )
                        })}
                    </div>
                </TabsContent>

                <TabsContent value="client" className="space-y-6 mt-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {speakerNames.map((name, idx) => {
                            const clientData = speakers[name].role_client;
                            if (!clientData) return null;
                            return (
                                <Card key={name}>
                                    <CardHeader>
                                        <CardTitle className="text-base flex items-center gap-2">
                                            <span className="w-3 h-3 rounded-full" style={{ backgroundColor: colors[idx % colors.length] }} />
                                            {name}의 내담자 반응
                                        </CardTitle>
                                    </CardHeader>
                                    <CardContent className="space-y-4">
                                        <div className="flex gap-4 text-center">
                                            <div className="flex-1 bg-blue-50 p-2 rounded">
                                                <div className="text-2xl font-bold text-blue-600">{clientData.change_talk_count}</div>
                                                <div className="text-xs text-muted-foreground">변화 대화</div>
                                            </div>
                                            <div className="flex-1 bg-amber-50 p-2 rounded">
                                                <div className="text-2xl font-bold text-amber-600">{clientData.sustain_talk_count}</div>
                                                <div className="text-xs text-muted-foreground">유지 대화(저항)</div>
                                            </div>
                                            <div className="flex-1 bg-slate-50 p-2 rounded">
                                                <div className="text-2xl font-bold text-slate-600">{clientData.self_disclosure_rating}/5</div>
                                                <div className="text-xs text-muted-foreground">자기 개방</div>
                                            </div>
                                        </div>
                                        <div>
                                            <h4 className="text-xs font-semibold text-muted-foreground mb-1">주요 동기 (Motivation)</h4>
                                            <p className="text-sm italic">"{clientData.primary_motivation}"</p>
                                        </div>
                                    </CardContent>
                                </Card>
                            )
                        })}
                    </div>
                </TabsContent>
            </Tabs>
        </div>
    )
}
