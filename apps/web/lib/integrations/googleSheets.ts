// apps/web/lib/integrations/googleSheets.ts

export class GoogleSheetsService {
  constructor(private apiKey: string, private spreadsheetId: string) {}

  /**
   * Fetches data from a specific range. Assuming the first row contains headers.
   */
  async fetchSheetData(range: string = 'A1:Z'): Promise<Record<string, string>[]> {
    const url = `https://sheets.googleapis.com/v4/spreadsheets/${this.spreadsheetId}/values/${range}?key=${this.apiKey}`;
    const res = await fetch(url);
    
    if (!res.ok) {
        let msg = res.statusText;
        try { msg = (await res.json()).error?.message || msg; } catch {}
        throw new Error(`Google Sheets API Error: ${res.status} ${msg}`);
    }

    const data = await res.json();
    const rows: string[][] = data.values || [];

    if (rows.length < 2) return []; // No data after headers

    const headers = rows[0].map(h => h.trim().toLowerCase());
    const records = [];

    for (let i = 1; i < rows.length; i++) {
      const row = rows[i];
      const record: Record<string, string> = {};
      headers.forEach((header, colIndex) => {
        record[header] = row[colIndex] || '';
      });
      records.push(record);
    }

    return records;
  }
}
