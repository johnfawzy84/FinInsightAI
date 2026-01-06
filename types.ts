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
  category: string;
  source?: string;
}

export interface CategorizationRule {
  id: string;
  keyword: string;
  category: string;
  isRegex?: boolean;
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
  delimiter: string;
  dateFormat: 'YYYY-MM-DD' | 'DD.MM.YYYY' | 'MM/DD/YYYY';
  decimalSeparator: '.' | ',';
}

export interface Asset {
  id: string;
  name: string;
  value: number;
  type: 'Cash' | 'Stock' | 'Crypto' | 'Real Estate' | 'Other';
  color: string;
}

export interface SavingRule {
  amount: number;
  frequency: 'monthly' | 'once' | 'custom';
}

export interface Goal {
  id: string;
  type: 'GOAL' | 'POCKET';
  title: string;
  targetAmount: number;
  allocatedAmount: number;
  targetDate: string;
  priority: number;
  icon: string; 
  quickAdjustStep?: number;
  savingRule?: SavingRule;
  linkedPocketId?: string;
}

export interface Budget {
  id: string;
  category: string;
  limit: number;
  period: 'monthly' | 'yearly';
  linkedPocketId?: string;
}

export interface DashboardWidget {
  id: string;
  type: 'net-worth' | 'assets' | 'cash-flow' | 'spending' | 'sankey' | 'recurring' | 'custom';
  title: string;
  description?: string;
  query?: string;
  cachedConfig?: any;
  visible: boolean;
  width: 'full' | 'half';
  lastUpdated?: number;
}

export interface GoogleUser {
  id: string;
  email: string;
  name: string;
  picture: string;
  accessToken: string;
}

export interface Session {
  id: string;
  name: string;
  currency: string;
  transactions: Transaction[];
  categories: string[];
  rules: CategorizationRule[];
  assets: Asset[];
  goals: Goal[];
  budgets: Budget[];
  sources: string[];
  dashboardWidgets: DashboardWidget[];
  createdAt: number;
  importSettings: ImportSettings;
  lastSyncedAt?: number;
}

export interface ImportSelection {
  transactions: boolean;
  categories: boolean;
  rules: boolean;
  assets: boolean;
  dashboard: boolean;
  goals: boolean;
  budgets: boolean;
}

export interface ColumnMapping {
  dateIndex: number;
  descriptionIndex: number;
  amountIndex: number;
  categoryIndex: number;
  typeIndex: number;
}