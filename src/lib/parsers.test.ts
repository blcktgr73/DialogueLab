import { describe, it, expect, vi, beforeEach } from 'vitest';
import { parseTranscriptFile } from './parsers';
import * as XLSX from 'xlsx';

// Mock xlsx
vi.mock('xlsx', () => {
    return {
        read: vi.fn(),
        utils: {
            sheet_to_json: vi.fn()
        },
        SheetNames: [],
        Sheets: {}
    };
});

describe('parseTranscriptFile', () => {
    // Reset mocks before each test to prevent state leakage
    beforeEach(() => {
        vi.resetAllMocks();
    });

    describe('TXT Parsing', () => {
        it('supports .txt files', async () => {
            const content = 'Speaker A: Hello\nSpeaker B: World';
            const file = new File([content], 'test.txt', { type: 'text/plain' });

            // Polyfill text() for JSDOM
            Object.defineProperty(file, 'text', { value: async () => content });

            const result = await parseTranscriptFile(file);
            expect(result).toHaveLength(2);
            expect(result[0].content).toBe('Hello');
        });
    });

    describe('Excel/CSV Parsing', () => {
        it('parses Clova Note style layout (Speaker/Time/Content)', async () => {
            const mockData = [
                ['Some Metadata', '', ''],
                ['참석자', '시간', '내용'],
                ['참석자 1', '00:00', '안녕하세요'],
                ['참석자 2', '00:05', '반갑습니다']
            ];

            (XLSX.read as any).mockReturnValue({
                SheetNames: ['Sheet1'],
                Sheets: { 'Sheet1': {} }
            });
            (XLSX.utils.sheet_to_json as any).mockReturnValue(mockData);

            const file = new File([''], 'test.xlsx', { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
            // Polyfill arrayBuffer
            Object.defineProperty(file, 'arrayBuffer', { value: async () => new ArrayBuffer(0) });

            const result = await parseTranscriptFile(file);

            expect(result).toHaveLength(2);
            expect(result[0]).toEqual({
                speaker: '참석자 1',
                timestamp: '00:00',
                content: '안녕하세요'
            });
        });

        it('parses files with flexible headers (Speaker/Content without Time)', async () => {
            const mockData = [
                ['Speaker Name', 'Text Content'], // English Header
                ['Alice', 'Hello there'],
                ['Bob', 'Hi Alice']
            ];

            (XLSX.read as any).mockReturnValue({
                SheetNames: ['Sheet1'],
                Sheets: { 'Sheet1': {} }
            });
            (XLSX.utils.sheet_to_json as any).mockReturnValue(mockData);

            const file = new File([''], 'test.csv', { type: 'text/csv' });
            Object.defineProperty(file, 'arrayBuffer', { value: async () => new ArrayBuffer(0) });

            const result = await parseTranscriptFile(file);
            expect(result).toHaveLength(2);
            expect(result[0].speaker).toBe('Alice');
        });

        it('throws error when structure is unrecognizable', async () => {
            const mockData = [
                ['Column A', 'Column B'],
                ['Data 1', 'Data 2']
            ];

            (XLSX.read as any).mockReturnValue({
                SheetNames: ['Sheet1'],
                Sheets: { 'Sheet1': {} }
            });
            (XLSX.utils.sheet_to_json as any).mockReturnValue(mockData);

            const file = new File([''], 'bad.xlsx');
            Object.defineProperty(file, 'arrayBuffer', { value: async () => new ArrayBuffer(0) });

            await expect(parseTranscriptFile(file)).rejects.toThrow('데이터 구조를 인식할 수 없습니다');
        });
    });
});
