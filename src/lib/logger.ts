import { createClient } from '@/utils/supabase/client';

export type LogLevel = 'info' | 'warn' | 'error' | 'debug';

export interface LogEntry {
    session_id: string;
    source: 'client' | 'server' | 'stt-worker';
    level: LogLevel;
    message: string;
    metadata?: Record<string, any>;
}

class SystemLogger {
    private static instance: SystemLogger;
    private supabase = createClient();

    private constructor() { }

    public static getInstance(): SystemLogger {
        if (!SystemLogger.instance) {
            SystemLogger.instance = new SystemLogger();
        }
        return SystemLogger.instance;
    }

    /**
     * Log a message to both console and Supabase system_logs
     */
    public log(entry: LogEntry) {
        // 1. Local Console Log (DX)
        const prefix = `[${entry.source.toUpperCase()}]`;
        const args: any[] = [prefix, entry.message];
        if (entry.metadata) args.push(entry.metadata);

        if (entry.level === 'error') {
            console.error(...args);
        } else if (entry.level === 'warn') {
            console.warn(...args);
        } else {
            console.log(...args);
        }

        // 2. Remote Persist (Supabase)
        // Fire-and-forget to prevent blocking main thread
        this.supabase.from('system_logs').insert({
            session_id: entry.session_id,
            source: entry.source,
            level: entry.level,
            message: entry.message,
            metadata: entry.metadata
        }).then(({ error }) => {
            if (error) {
                console.warn('[Logger] Failed to sync log to Supabase:', error.message);
            }
        });
    }

    public info(sessionId: string, message: string, metadata?: any) {
        this.log({ session_id: sessionId, source: 'client', level: 'info', message, metadata });
    }

    public warn(sessionId: string, message: string, metadata?: any) {
        this.log({ session_id: sessionId, source: 'client', level: 'warn', message, metadata });
    }

    public error(sessionId: string, message: string, metadata?: any) {
        this.log({ session_id: sessionId, source: 'client', level: 'error', message, metadata });
    }
}

export const logger = SystemLogger.getInstance();
