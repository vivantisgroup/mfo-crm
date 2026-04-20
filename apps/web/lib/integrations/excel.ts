// apps/web/lib/integrations/excel.ts

export class ExcelService {
  constructor(private accessToken: string, private fileId: string) {}

  /**
   * Fetches data from the first worksheet's used range via MS Graph.
   */
  async fetchSheetData(): Promise<Record<string, string>[]> {
    // 1. Get worksheets
    const wsUrl = `https://graph.microsoft.com/v1.0/me/drive/items/${this.fileId}/workbook/worksheets`;
    const wsRes = await fetch(wsUrl, {
      headers: { Authorization: `Bearer ${this.accessToken}` }
    });
    
    if (!wsRes.ok) {
        let msg = wsRes.statusText;
        try { msg = (await wsRes.json()).error?.message || msg; } catch {}
        throw new Error(`Excel API Error (Fetching Worksheets): ${wsRes.status} ${msg}`);
    }

    const wsData = await wsRes.json();
    if (!wsData.value || wsData.value.length === 0) {
        throw new Error("No worksheets found in this Excel file.");
    }

    const firstSheetId = wsData.value[0].id;

    // 2. Get Used Range
    const rangeUrl = `https://graph.microsoft.com/v1.0/me/drive/items/${this.fileId}/workbook/worksheets/${firstSheetId}/usedRange`;
    const rangeRes = await fetch(rangeUrl, {
      headers: { Authorization: `Bearer ${this.accessToken}` }
    });

    if (!rangeRes.ok) {
        let msg = rangeRes.statusText;
        try { msg = (await rangeRes.json()).error?.message || msg; } catch {}
        throw new Error(`Excel API Error (Fetching Range): ${rangeRes.status} ${msg}`);
    }

    const rangeData = await rangeRes.json();
    const rows: string[][] = rangeData.values || [];

    if (rows.length < 2) return [];

    const headers = rows[0].map(h => String(h).trim().toLowerCase());
    const records = [];

    for (let i = 1; i < rows.length; i++) {
      const row = rows[i];
      const record: Record<string, string> = {};
      headers.forEach((header, colIndex) => {
        record[header] = String(row[colIndex] || '');
      });
      records.push(record);
    }

    return records;
  }
}
