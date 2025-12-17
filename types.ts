export enum TransactionType {
  INCOME = 'INCOME',
  EXPENSE = 'EXPENSE',
}

export enum Category {
  FOOD = 'Food & Dining',
  TRANSPORT = 'Transportation',
  UTILITIES = 'Utilities',
  HOUSING = 'Housing',
  ENTERTAINMENT = 'Entertainment',
  SHOPPING = 'Shopping',
  HEALTH = 'Health & Fitness',
  INCOME = 'Income',
  BANKING = 'Banking & Loans',
  UNCATEGORIZED = 'Uncategorized',
  OTHER = 'Other',
}

export const DEFAULT_CATEGORIES = [
  'Food & Dining',
  'Transportation',
  'Utilities',
  'Housing',
  'Entertainment',
  'Shopping',
  'Health & Fitness',
  'Income',
  'Banking & Loans',
  'Uncategorized',
  'Other',
];

export interface Transaction {
  id: string;
  date: string;
  description: string;
  amount: number;
  type: TransactionType;
  category: string; // String to allow AI flexibility, but roughly maps to Category enum
}

export interface ChartData {
  name: string;
  value: number;
  color?: string;
}

export interface AIAnalysisResult {
  summary: string;
  recommendations: string[];
  savingsPotential: number;
}

export interface ImportSettings {
  delimiter: string; // ',' or ';'
  dateFormat: 'YYYY-MM-DD' | 'DD.MM.YYYY' | 'MM/DD/YYYY';
  decimalSeparator: '.' | ',';
}

export interface Session {
  id: string;
  name: string;
  transactions: Transaction[];
  categories: string[];
  createdAt: number;
  importSettings: ImportSettings;
}