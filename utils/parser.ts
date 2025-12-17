import { Transaction, TransactionType, Category, ImportSettings } from "../types";
import * as XLSX from 'xlsx';

// Helper to parse date string based on format
const parseDate = (dateStr: string, format: string): string => {
  if (!dateStr) return new Date().toISOString().split('T')[0];
  
  let day, month, year;
  const cleanStr = dateStr.trim();

  if (format === 'DD.MM.YYYY') {
    const parts = cleanStr.split('.');
    if (parts.length === 3) {
      day = parts[0];
      month = parts[1];
      year = parts[2];
      return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
    }
  } else if (format === 'MM/DD/YYYY') {
    const parts = cleanStr.split('/');
    if (parts.length === 3) {
      month = parts[0];
      day = parts[1];
      year = parts[2];
      return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
    }
  }
  
  // Default/Fallback: assume ISO or try standard parsing
  return cleanStr;
};

// Helper to parse number based on separator
const parseAmount = (amountStr: string | number, decimalSeparator: '.' | ','): number => {
  if (typeof amountStr === 'number') return amountStr;
  if (!amountStr) return 0;
  
  let cleanStr = amountStr.toString().trim();
  
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

export const parseFile = async (file: File, settings: ImportSettings): Promise<Transaction[]> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = (e) => {
      try {
        const data = e.target?.result;
        let jsonData: any[] = [];

        // Check file type for specific parsing strategy
        if (file.name.endsWith('.csv') || file.name.endsWith('.txt')) {
          // Manual CSV parsing to strictly respect settings
          const text = data as string;
          const lines = text.split(/\r\n|\n/).filter(line => line.trim() !== '');
          
          if (lines.length > 0) {
            const headers = lines[0].split(settings.delimiter).map(h => h.trim().replace(/^"|"$/g, ''));
            
            jsonData = lines.slice(1).map(line => {
              // Simple split by delimiter (ignoring quotes for MVP complexity, assumes simple CSV)
              // For robust CSV parsing with quotes containing delimiters, a regex or state machine is needed.
              // Given the example, a split is likely sufficient or we can use a simple regex.
              const values = line.split(settings.delimiter).map(v => v.trim().replace(/^"|"$/g, ''));
              const row: any = {};
              headers.forEach((h, i) => {
                row[h] = values[i];
              });
              return row;
            });
          }
        } else {
          // Fallback to XLSX for .xlsx files
          const workbook = XLSX.read(data, { type: 'binary' });
          const firstSheetName = workbook.SheetNames[0];
          const worksheet = workbook.Sheets[firstSheetName];
          jsonData = XLSX.utils.sheet_to_json(worksheet);
        }

        const transactions: Transaction[] = jsonData.map((row, index) => {
          // 1. Resolve Date
          // Mappings: Standard, German (Buchungstag)
          const dateRaw = row['Date'] || row['date'] || row['Buchungstag'] || row['Valutadatum'];
          const date = parseDate(String(dateRaw || ''), settings.dateFormat);

          // 2. Resolve Description
          // Mappings: Standard, German (Buchungstext, Verwendungszweck)
          const description = row['Description'] || row['description'] || row['Desc'] || row['Buchungstext'] || row['Verwendungszweck'] || 'Unknown Transaction';

          // 3. Resolve Amount
          // Mappings: Standard, German (Betrag, Umsatz)
          const amountRaw = row['Amount'] || row['amount'] || row['Betrag'] || row['Umsatz'] || '0';
          let amount = parseAmount(amountRaw, settings.decimalSeparator);

          // 4. Resolve Type & Category
          let type = TransactionType.EXPENSE;
          // Heuristics
          const typeRaw = (row['Type'] || row['Umsatzart'] || '').toString().toLowerCase();
          const categoryRaw = (row['Category'] || row['Kategorie'] || '').toString();

          if (typeRaw.includes('income') || typeRaw.includes('einnahmen') || typeRaw.includes('gutschrift')) {
            type = TransactionType.INCOME;
          } else if (typeRaw.includes('expense') || typeRaw.includes('ausgabe') || typeRaw.includes('lastschrift')) {
            type = TransactionType.EXPENSE;
          } else {
            // Amount based heuristic
            if (amount > 0 && (categoryRaw.toLowerCase().includes('income') || categoryRaw.toLowerCase().includes('einnahmen'))) {
               type = TransactionType.INCOME;
            } else if (amount < 0) {
               type = TransactionType.EXPENSE;
            }
          }

          // Normalize amount to positive for the system, strictly handle type
          if (amount < 0) amount = Math.abs(amount);

          // Category mapping
          let category: string = Category.UNCATEGORIZED;
          if (categoryRaw) {
             category = String(categoryRaw);
          } else {
             // Simple keyword mapping if no category provided
             const descLower = description.toLowerCase();
             if (descLower.includes('supermarkt') || descLower.includes('rewe') || descLower.includes('lidl') || descLower.includes('grocery')) category = Category.FOOD;
             else if (descLower.includes('tankstelle') || descLower.includes('uber') || descLower.includes('bahn')) category = Category.TRANSPORT;
             else if (descLower.includes('miete') || descLower.includes('rent')) category = Category.HOUSING;
          }

          return {
            id: `imported-${index}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
            date,
            description,
            amount,
            type,
            category,
          };
        }).filter(t => t.amount !== 0); // Filter out empty rows or zero amounts

        resolve(transactions);
      } catch (error) {
        console.error("Parse error details:", error);
        reject(error);
      }
    };

    reader.onerror = (error) => reject(error);

    if (file.name.endsWith('.csv') || file.name.endsWith('.txt')) {
      reader.readAsText(file, 'ISO-8859-1'); // Common encoding for Western Europe/German CSVs
    } else {
      reader.readAsBinaryString(file);
    }
  });
};