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
  source?: string; // Identifier for the import source (e.g., "Chase Checking", "Manual")
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
  delimiter: string; // ',' or ';'
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
  frequency: 'monthly' | 'once' | 'custom'; // Simple rule
}

export interface Goal {
  id: string;
  type: 'GOAL' | 'POCKET'; // GOAL = Wishlist (Spend later), POCKET = Reserve (Hold indefinitely/Emergency)
  title: string;
  targetAmount: number;
  allocatedAmount: number;
  targetDate: string; // For POCKET, this might just be a "review date"
  priority: number; // 1 (Low) to 5 (Critical)
  icon: string; 
  quickAdjustStep?: number; // Configurable +/- amount (e.g., 100)
  savingRule?: SavingRule; // Defined saving strategy
}

export interface DashboardWidget {
  id: string;
  type: 'net-worth' | 'assets' | 'cash-flow' | 'spending' | 'sankey' | 'custom';
  title: string;
  description?: string; // For AI generation context
  query?: string; // The prompt used to generate it
  cachedConfig?: any; // The Recharts config and data
  visible: boolean;
  width: 'full' | 'half';
  lastUpdated?: number;
}

export interface Session {
  id: string;
  name: string;
  transactions: Transaction[];
  categories: string[];
  rules: CategorizationRule[];
  assets: Asset[];
  goals: Goal[];
  sources: string[]; // List of available import sources
  dashboardWidgets: DashboardWidget[];
  createdAt: number;
  importSettings: ImportSettings;
}

export interface ImportSelection {
  transactions: boolean;
  categories: boolean;
  rules: boolean;
  assets: boolean;
  dashboard: boolean;
  goals: boolean;
}

export interface ColumnMapping {
  dateIndex: number;
  descriptionIndex: number;
  amountIndex: number;
  categoryIndex: number; // -1 if not present
  typeIndex: number; // -1 if not present
}