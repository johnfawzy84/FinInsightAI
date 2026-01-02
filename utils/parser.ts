import { Transaction, TransactionType, Category, ImportSettings, ColumnMapping } from "../types";
import * as XLSX from 'xlsx';

// Helper to parse date string based on format
const parseDate = (dateStr: string, format: string): string | null => {
  if (!dateStr) return null;
  
  let cleanStr = String(dateStr).trim();
  // Handle Excel serial dates (numbers)
  if (!isNaN(Number(cleanStr)) && cleanStr.length < 8 && !cleanStr.includes('.') && !cleanStr.includes('/')) {
      const date = new Date(Math.round((Number(cleanStr) - 25569) * 86400 * 1000));
      return date.toISOString().split('T')[0];
  }

  let day, month, year;

  try {
    if (format === 'DD.MM.YYYY') {
        const parts = cleanStr.split('.');
        if (parts.length === 3) {
            day = parts[0];
            month = parts[1];
            year = parts[2];
            // Fix year if 2 digits
            if(year.length === 2) year = `20${year}`;
            return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
        }
    } else if (format === 'MM/DD/YYYY') {
        const parts = cleanStr.split('/');
        if (parts.length === 3) {
            month = parts[0];
            day = parts[1];
            year = parts[2];
             if(year.length === 2) year = `20${year}`;
            return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
        }
    } else {
        // Try standard ISO parsing
        const d = new Date(cleanStr);
        if (!isNaN(d.getTime())) return d.toISOString().split('T')[0];
    }
  } catch(e) {
      return null;
  }
  
  return null;
};

// Helper to parse number based on separator
const parseAmount = (amountStr: string | number, decimalSeparator: '.' | ','): number => {
  if (typeof amountStr === 'number') return amountStr;
  if (!amountStr) return 0;
  
  let cleanStr = amountStr.toString().trim();
  
  // Remove currency symbols and spaces
  cleanStr = cleanStr.replace(/[^0-9.,-]/g, '');

  if (decimalSeparator === ',') {
    // German format: 1.000,00 -> 1000.00
    // Remove thousands separator (.) first, then replace decimal separator (,) with (.)
    cleanStr = cleanStr.replace(/\./g, '').replace(',', '.');
  } else {
    // US format: 1,000.00 -> 1000.00
    cleanStr = cleanStr.replace(/,/g, '');
  }
  
  return parseFloat(cleanStr);
};

// --- New Functions for Smart Import ---

export interface RawCsvData {
    headers: string[];
    rows: string[][]; // 2D array of strings
    preview: string[][]; // First 5 rows for UI
}

export const readCsvPreview = async (file: File, delimiter: string): Promise<RawCsvData> => {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = (e) => {
            try {
                const data = e.target?.result;
                let rows: string[][] = [];

                if (file.name.endsWith('.xlsx') || file.name.endsWith('.xls')) {
                     const workbook = XLSX.read(data, { type: 'binary' });
                     const firstSheetName = workbook.SheetNames[0];
                     const worksheet = workbook.Sheets[firstSheetName];
                     const json = XLSX.utils.sheet_to_json(worksheet, { header: 1, defval: '' }) as string[][];
                     rows = json.filter(row => row.length > 0 && row.some(c => !!c));
                } else {
                    const text = data as string;
                    // Basic CSV parser logic (handles quotes?)
                    // For MVP simplicity we use split, but ideally use a library or regex for quoted fields containing delimiters
                    rows = text.split(/\r\n|\n/)
                        .filter(line => line.trim() !== '')
                        .map(line => {
                             // Handle quotes vaguely: split by delimiter if not inside quotes
                             // Simplification: simple split. 
                             return line.split(delimiter).map(c => c.trim().replace(/^"|"$/g, ''));
                        });
                }
                
                if (rows.length === 0) throw new Error("File is empty");

                const headers = rows[0];
                const dataRows = rows.slice(1);

                resolve({
                    headers,
                    rows: dataRows,
                    preview: dataRows.slice(0, 5)
                });

            } catch(err) {
                reject(err);
            }
        };

        if (file.name.endsWith('.xlsx') || file.name.endsWith('.xls')) {
            reader.readAsBinaryString(file);
        } else {
            reader.readAsText(file, 'ISO-8859-1'); // Default to latin1 for CSVs often used in EU banking
        }
    });
};

export const parseMappedData = (
    rawData: string[][], 
    mapping: ColumnMapping, 
    settings: ImportSettings
): { success: Transaction[], failed: any[] } => {
    const success: Transaction[] = [];
    const failed: any[] = [];

    rawData.forEach((row, index) => {
        try {
            // 1. Extract raw values based on index
            const dateRaw = row[mapping.dateIndex];
            const descRaw = row[mapping.descriptionIndex];
            const amountRaw = row[mapping.amountIndex];
            
            // Optional columns
            const catRaw = mapping.categoryIndex >= 0 ? row[mapping.categoryIndex] : '';
            const typeRaw = mapping.typeIndex >= 0 ? row[mapping.typeIndex] : '';

            // 2. Parse Validations
            const date = parseDate(dateRaw, settings.dateFormat);
            const amount = parseAmount(amountRaw, settings.decimalSeparator);
            const description = descRaw ? String(descRaw).trim() : 'Unknown';

            if (!date || isNaN(amount)) {
                throw new Error("Invalid Date or Amount");
            }

            // 3. Logic for Type and Category
            let type = TransactionType.EXPENSE;
            // Infer type from column OR amount sign
            if (typeRaw) {
                const t = typeRaw.toLowerCase();
                if (t.includes('income') || t.includes('haben') || t.includes('gutschrift')) type = TransactionType.INCOME;
            } else {
                // Infer from sign
                if (amount > 0) {
                     // In some exports, positive is income, negative is expense.
                     // But sometimes Expense is positive in a "Debit" column.
                     // We assume standard banking export: - is expense, + is income.
                     type = TransactionType.INCOME;
                } else {
                     type = TransactionType.EXPENSE;
                }
            }

            // Force absolute amount for internal storage
            const finalAmount = Math.abs(amount);

            if (finalAmount === 0) throw new Error("Zero amount");

            success.push({
                id: `imp-${Date.now()}-${index}`,
                date,
                description,
                amount: finalAmount,
                type,
                category: catRaw || Category.UNCATEGORIZED
            });

        } catch (e) {
            failed.push({ row: index + 2, raw: row, reason: (e as Error).message }); // +2 for header and 0-index
        }
    });

    return { success, failed };
};

// Keep old function for legacy compatibility if needed, or remove.
// For safety, we keep it but wrap the new logic if called? 
// Actually, let's keep it as is to not break existing tests/code if any, 
// though the app will switch to readCsvPreview + parseMappedData.
export const parseFile = async (file: File, settings: ImportSettings): Promise<Transaction[]> => {
    // This function is effectively deprecated by SmartImportModal but kept for fallback
    const { rows, headers } = await readCsvPreview(file, settings.delimiter);
    // Naive mapping
    const mapping: ColumnMapping = {
        dateIndex: headers.findIndex(h => h.toLowerCase().includes('date') || h.toLowerCase().includes('datum')),
        descriptionIndex: headers.findIndex(h => h.toLowerCase().includes('desc') || h.toLowerCase().includes('text') || h.toLowerCase().includes('verwendungszweck')),
        amountIndex: headers.findIndex(h => h.toLowerCase().includes('amount') || h.toLowerCase().includes('betrag')),
        categoryIndex: headers.findIndex(h => h.toLowerCase().includes('category') || h.toLowerCase().includes('kategorie')),
        typeIndex: -1
    };
    
    // Fallback indices if not found
    if(mapping.dateIndex === -1) mapping.dateIndex = 0;
    if(mapping.descriptionIndex === -1) mapping.descriptionIndex = 1;
    if(mapping.amountIndex === -1) mapping.amountIndex = 2;

    const { success } = parseMappedData(rows, mapping, settings);
    return success;
};
