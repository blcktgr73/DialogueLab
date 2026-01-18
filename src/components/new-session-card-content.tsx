'use client';

import dynamic from 'next/dynamic';
import { createSessionWithTranscript } from "@/app/actions/session";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { createSession } from "@/app/actions/session";
import { SimulationSetupDialog } from "@/components/simulation-setup-dialog";


const AudioRecorder = dynamic(() => import('@/components/audio-recorder').then(mod => mod.AudioRecorder), {
    ssr: false,
    loading: () => <div className="h-48 flex items-center justify-center text-muted-foreground animate-pulse">녹음기 준비 중...</div>
});

export function NewSessionCardContent() {
    const router = useRouter();

    const handleTranscriptionComplete = async (text: string, rawData: any) => {
        try {
            toast.loading("세션을 생성하고 있습니다...");

            // speakers 추출 (Diarization 결과가 있다면)
            // 지금은 단순하게 '화자 1, 화자 2' 등으로 매핑된다고 가정
            // 만약 Raw Data가 있다면 여기서 좀 더 정교하게 처리 가능

            const sessionId = await createSessionWithTranscript(text, rawData);

            toast.dismiss();
            toast.success("세션이 생성되었습니다.");

            // 해당 세션으로 이동
            router.push(`/sessions/${sessionId}`);

        } catch (error: any) {
            toast.dismiss();
            toast.error("세션 생성 중 오류가 발생했습니다.");
            console.error(error);
        }
    };

    return (
        <div className="flex flex-col items-center w-full">
            <AudioRecorder onTranscriptionComplete={handleTranscriptionComplete} />

            <div className="mt-8 border-t pt-6 w-full flex flex-col gap-3">
                <form action={createSession}>
                    <Button variant="outline" type="submit" className="w-full hover:text-primary border-dashed border-gray-300 text-gray-600 hover:bg-gray-50">
                        녹음 없이 세션 만들기 (텍스트 업로드)
                    </Button>
                </form>

                <SimulationSetupDialog />
            </div>
        </div>
    );
}
