import { SessionTitle } from '@/components/session-title';
import { AnalyzeAction } from '@/components/analyze-button';
import { CollaborationManager } from '@/components/collaboration-manager';
import { getParticipants } from '@/app/actions/collaboration';

interface SessionHeaderProps {
    sessionId: string;
    initialTitle: string;
    createdAt: string;
    mode: string;
}

export async function SessionHeader({ sessionId, initialTitle, createdAt, mode }: SessionHeaderProps) {
    const participants = await getParticipants(sessionId);

    return (
        <div className="border-b pb-4 sticky top-0 bg-card/95 backdrop-blur z-10 pt-2 flex justify-between items-start">
            <div>
                <SessionTitle sessionId={sessionId} initialTitle={initialTitle} />
                <p className="text-muted-foreground text-xs mt-1">
                    {new Date(createdAt).toISOString().split('T')[0]} • {mode}
                </p>
            </div>

            <div className="flex items-center gap-2">
                <CollaborationManager sessionId={sessionId} initialParticipants={participants} />
                <AnalyzeAction sessionId={sessionId} />
            </div>
        </div>
    );
}
