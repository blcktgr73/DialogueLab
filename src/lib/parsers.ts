import * as XLSX from 'xlsx';

export type TranscriptEntry = {
    speaker: string;
    content: string;
    timestamp: string | undefined;
};

export async function parseTranscriptFile(file: File): Promise<TranscriptEntry[]> {
    const extension = file.name.split('.').pop()?.toLowerCase();

    if (extension === 'txt') {
        return parseTxt(file);
    } else if (['csv', 'xls', 'xlsx'].includes(extension || '')) {
        return parseExcelOrCsv(file);
    } else {
        throw new Error('지원하지 않는 파일 형식입니다. (.txt, .csv, .xls, .xlsx)');
    }
}

async function parseTxt(file: File): Promise<TranscriptEntry[]> {
    const text = await file.text();
    const lines = text.split('\n');
    const entries: TranscriptEntry[] = [];

    for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed) continue;

        // Check for "Speaker: Content" format
        // Simple regex: Capture everything before first colon as speaker
        const match = trimmed.match(/^([^:]+):(.+)$/);
        if (match) {
            entries.push({
                speaker: match[1].trim(),
                content: match[2].trim(),
                timestamp: undefined // TXT parsing usually lacks reliable timestamp unless standard format
            });
        } else {
            // If no colon, append to previous if possible or treat as generic
            if (entries.length > 0) {
                entries[entries.length - 1].content += ' ' + trimmed;
            }
        }
    }
    return entries;
}

async function parseExcelOrCsv(file: File): Promise<TranscriptEntry[]> {
    const arrayBuffer = await file.arrayBuffer();
    const workbook = XLSX.read(arrayBuffer, { type: 'array' });
    const firstSheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[firstSheetName];

    // Convert to array of arrays
    const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1 }) as any[][];

    if (jsonData.length === 0) return [];

    const entries: TranscriptEntry[] = [];

    // Header Detection Strategy often fails with Clova Note because of metadata rows.
    // Robust Strategy: Scan for Timestamp Pattern (e.g., "00:00", "12:30", "01:02:03")
    // The structure is usually: [Speaker] [Time] [Content]

    let timeColIdx = -1;
    let speakerColIdx = -1;
    let contentColIdx = -1;

    // 1. Identify Columns based on data patterns in the first 20 rows
    for (let i = 0; i < Math.min(jsonData.length, 20); i++) {
        const row = jsonData[i];
        if (!row) continue;

        for (let j = 0; j < row.length; j++) {
            const cell = String(row[j]).trim();
            // Match MM:SS or HH:MM:SS
            if (/^\d{1,2}:\d{2}(:\d{2})?$/.test(cell)) {
                timeColIdx = j;
                // Clova Note usually has Speaker before Time, and Content after Time
                // Let's verify this assumption in the same row
                if (j > 0 && row[j + 1]) {
                    speakerColIdx = j - 1;
                    contentColIdx = j + 1;
                    break;
                }
            }
        }
        if (timeColIdx !== -1) break;
    }

    // Fallback: If no timestamp found, look for standard headers "Speaker", "Content"
    if (timeColIdx === -1) {
        const headers = jsonData[0].map((h: any) => String(h).trim().toLowerCase());
        speakerColIdx = headers.findIndex(h => h.includes('참석자') || h.includes('speaker') || h.includes('발화자'));
        contentColIdx = headers.findIndex(h => h.includes('내용') || h.includes('content') || h.includes('text'));
        // If still not found, try row 1 or 2 (metadata skipping)
        if (speakerColIdx === -1) {
            // Try finding headers in first few rows
            for (let r = 0; r < 5; r++) {
                const rowHeaders = (jsonData[r] || []).map((h: any) => String(h).trim().toLowerCase());
                const s = rowHeaders.findIndex(h => h.includes('참석자') || h.includes('speaker'));
                const c = rowHeaders.findIndex(h => h.includes('내용') || h.includes('content'));
                if (s !== -1 && c !== -1) {
                    speakerColIdx = s;
                    contentColIdx = c;
                    break;
                }
            }
        }
    }

    if (speakerColIdx === -1 || contentColIdx === -1) {
        throw new Error('데이터 구조를 인식할 수 없습니다. (참석자/내용 컬럼 또는 00:00 형식의 시간 포맷이 필요합니다)');
    }

    // 2. Extract Data
    for (let i = 0; i < jsonData.length; i++) {
        const row = jsonData[i];
        if (!row) continue;

        const speaker = row[speakerColIdx];
        const content = row[contentColIdx];
        const timestamp = timeColIdx !== -1 ? row[timeColIdx] : undefined;

        // Filter out header rows or metadata rows (where speaker/content might be empty or match header names)
        if (!speaker || !content) continue;
        if (String(speaker).includes('참석자') && String(content).includes('내용')) continue; // Skip explicit header row

        entries.push({
            speaker: String(speaker).trim(),
            content: String(content).trim(),
            timestamp: timestamp ? String(timestamp).trim() : undefined
        });
    }

    return entries;
}
