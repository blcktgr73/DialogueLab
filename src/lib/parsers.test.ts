import { describe, it, expect, vi } from 'vitest';
import { parseTranscriptFile } from './parsers';

describe('parseTranscriptFile', () => {
    it('supports .txt files', async () => {
        const content = 'Speaker A: Hello\nSpeaker B: World';
        const file = new File([content], 'test.txt', { type: 'text/plain' });

        // Polyfill text() for JSDOM environment if missing or mostly for stability in tests
        Object.defineProperty(file, 'text', {
            value: async () => content,
            writable: true
        });

        const result = await parseTranscriptFile(file);

        expect(result).toHaveLength(2);
        expect(result[0]).toEqual({
            speaker: 'Speaker A',
            content: 'Hello',
            timestamp: undefined
        });
        expect(result[1]).toEqual({
            speaker: 'Speaker B',
            content: 'World',
            timestamp: undefined
        });
    });

    it('throws error for unsupported file types', async () => {
        const file = new File([''], 'test.pdf', { type: 'application/pdf' });
        await expect(parseTranscriptFile(file)).rejects.toThrow('지원하지 않는 파일 형식입니다');
    });
});
