import React, { useState } from 'react';
import { X, BookOpen, LayoutDashboard, List, Wallet, Target, Settings, MessageSquareText, ShieldCheck, Upload, BrainCircuit } from 'lucide-react';

interface DocumentationModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const DocumentationModal: React.FC<DocumentationModalProps> = ({ isOpen, onClose }) => {
  const [activeSection, setActiveSection] = useState<string>('intro');

  if (!isOpen) return null;

  const sections = [
    { id: 'intro', label: 'Introduction', icon: ShieldCheck },
    { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { id: 'transactions', label: 'Transactions', icon: List },
    { id: 'budgets', label: 'Budgets', icon: Wallet },
    { id: 'goals', label: 'Goals', icon: Target },
    { id: 'ai', label: 'AI Consultant', icon: MessageSquareText },
    { id: 'settings', label: 'Settings & Sync', icon: Settings },
  ];

  const renderContent = () => {
    switch (activeSection) {
      case 'intro':
        return (
          <div className="space-y-4 animate-fade-in">
            <h3 className="text-xl font-bold text-textMain">Welcome to FinSight AI</h3>
            <p className="text-textMuted leading-relaxed">
              FinSight AI is a smart, privacy-focused personal finance dashboard. It helps you track your wealth, manage spending, set budgets, and achieve your financial goals with the power of Artificial Intelligence.
            </p>
            <div className="bg-surfaceHighlight p-4 rounded-xl border border-border mt-4">
              <h4 className="font-semibold text-textMain mb-2">Key Concepts</h4>
              <ul className="list-disc list-inside text-sm text-textMuted space-y-2">
                <li><strong>Sessions:</strong> Your data is organized into "Sessions". You can have multiple sessions (e.g., Personal, Business) and switch between them.</li>
                <li><strong>Local-First:</strong> By default, all your data stays on your device. You can optionally sync it to your personal Google Drive.</li>
                <li><strong>AI-Powered:</strong> Use the built-in AI to categorize transactions, generate budgets, and get financial advice.</li>
                <li><strong>PWA Support:</strong> You can install FinSight AI on your device for a native app-like experience.</li>
              </ul>
            </div>
          </div>
        );
      case 'dashboard':
        return (
          <div className="space-y-4 animate-fade-in">
            <h3 className="text-xl font-bold text-textMain flex items-center gap-2">
              <LayoutDashboard className="text-primary" size={24} /> Dashboard
            </h3>
            <p className="text-textMuted leading-relaxed">
              The Dashboard provides a high-level overview of your financial health.
            </p>
            <ul className="space-y-3 text-sm text-textMuted">
              <li className="flex items-start gap-2">
                <div className="mt-1 w-1.5 h-1.5 rounded-full bg-primary shrink-0" />
                <span><strong>Net Worth:</strong> Calculates your total assets minus any liabilities based on your transaction history and manually added assets.</span>
              </li>
              <li className="flex items-start gap-2">
                <div className="mt-1 w-1.5 h-1.5 rounded-full bg-primary shrink-0" />
                <span><strong>Asset Allocation:</strong> Manually add and track your assets (e.g., Cash, Stocks, Real Estate) to see your portfolio distribution.</span>
              </li>
              <li className="flex items-start gap-2">
                <div className="mt-1 w-1.5 h-1.5 rounded-full bg-primary shrink-0" />
                <span><strong>Income vs Expenses:</strong> Visualizes your cash flow over time using interactive charts.</span>
              </li>
              <li className="flex items-start gap-2">
                <div className="mt-1 w-1.5 h-1.5 rounded-full bg-primary shrink-0" />
                <span><strong>Recurring Expenses:</strong> AI automatically detects subscriptions and recurring bills from your transaction history.</span>
              </li>
            </ul>
          </div>
        );
      case 'transactions':
        return (
          <div className="space-y-4 animate-fade-in">
            <h3 className="text-xl font-bold text-textMain flex items-center gap-2">
              <List className="text-primary" size={24} /> Transactions
            </h3>
            <p className="text-textMuted leading-relaxed">
              Manage all your financial records in one place.
            </p>
            <div className="space-y-4">
              <div className="bg-surfaceHighlight p-4 rounded-xl border border-border">
                <h4 className="font-semibold text-textMain flex items-center gap-2 mb-2">
                  <Upload size={16} className="text-primary" /> Importing Data
                </h4>
                <p className="text-sm text-textMuted">
                  Click the "Import" button in the sidebar or top menu to upload CSV or Excel files from your bank. The Smart Import tool will automatically map columns (Date, Amount, Description) and allow you to review before importing.
                </p>
              </div>
              <div className="bg-surfaceHighlight p-4 rounded-xl border border-border">
                <h4 className="font-semibold text-textMain flex items-center gap-2 mb-2">
                  <BrainCircuit size={16} className="text-primary" /> AI Auto-Categorize
                </h4>
                <p className="text-sm text-textMuted">
                  Click the "AI Auto-Categorize" button to let the AI analyze uncategorized transactions and assign them to the most appropriate category based on the description.
                </p>
              </div>
              <div className="bg-surfaceHighlight p-4 rounded-xl border border-border">
                <h4 className="font-semibold text-textMain mb-2">Rules & Bulk Updates</h4>
                <p className="text-sm text-textMuted">
                  Click on any transaction to open its details. From there, you can change its category, apply the change to all similar transactions, and create a <strong>Rule</strong> (exact match or Regex) so future imports are categorized automatically.
                </p>
              </div>
            </div>
          </div>
        );
      case 'budgets':
        return (
          <div className="space-y-4 animate-fade-in">
            <h3 className="text-xl font-bold text-textMain flex items-center gap-2">
              <Wallet className="text-primary" size={24} /> Budgets
            </h3>
            <p className="text-textMuted leading-relaxed">
              Set spending limits for different categories to keep your finances on track.
            </p>
            <ul className="space-y-3 text-sm text-textMuted">
              <li className="flex items-start gap-2">
                <div className="mt-1 w-1.5 h-1.5 rounded-full bg-primary shrink-0" />
                <span><strong>Create Budgets:</strong> Add a budget for any category (e.g., Groceries, Entertainment) and set a monthly limit.</span>
              </li>
              <li className="flex items-start gap-2">
                <div className="mt-1 w-1.5 h-1.5 rounded-full bg-primary shrink-0" />
                <span><strong>Track Progress:</strong> Visual progress bars show how much you've spent versus your limit. Colors change to warn you as you approach or exceed the limit.</span>
              </li>
              <li className="flex items-start gap-2">
                <div className="mt-1 w-1.5 h-1.5 rounded-full bg-primary shrink-0" />
                <span><strong>AI Recommendations:</strong> The AI can analyze your past spending and suggest realistic budget limits for your categories.</span>
              </li>
            </ul>
          </div>
        );
      case 'goals':
        return (
          <div className="space-y-4 animate-fade-in">
            <h3 className="text-xl font-bold text-textMain flex items-center gap-2">
              <Target className="text-primary" size={24} /> Goals
            </h3>
            <p className="text-textMuted leading-relaxed">
              Define your financial goals and track your progress towards achieving them.
            </p>
            <ul className="space-y-3 text-sm text-textMuted">
              <li className="flex items-start gap-2">
                <div className="mt-1 w-1.5 h-1.5 rounded-full bg-primary shrink-0" />
                <span><strong>Set Goals:</strong> Create goals like "Emergency Fund", "New Car", or "Vacation" with a target amount and deadline.</span>
              </li>
              <li className="flex items-start gap-2">
                <div className="mt-1 w-1.5 h-1.5 rounded-full bg-primary shrink-0" />
                <span><strong>Allocate Assets:</strong> Link specific assets (e.g., a Savings Account) to a goal to track its funding progress.</span>
              </li>
              <li className="flex items-start gap-2">
                <div className="mt-1 w-1.5 h-1.5 rounded-full bg-primary shrink-0" />
                <span><strong>Projections:</strong> See how much you need to save monthly to reach your goal by the deadline.</span>
              </li>
            </ul>
          </div>
        );
      case 'ai':
        return (
          <div className="space-y-4 animate-fade-in">
            <h3 className="text-xl font-bold text-textMain flex items-center gap-2">
              <MessageSquareText className="text-primary" size={24} /> AI Consultant
            </h3>
            <p className="text-textMuted leading-relaxed">
              Your personal financial advisor, powered by AI.
            </p>
            <div className="bg-surfaceHighlight p-4 rounded-xl border border-border">
              <h4 className="font-semibold text-textMain mb-2">Capabilities</h4>
              <ul className="list-disc list-inside text-sm text-textMuted space-y-2">
                <li><strong>Ask Questions:</strong> "How much did I spend on food last month?", "What is my biggest expense?"</li>
                <li><strong>Get Advice:</strong> "How can I reduce my subscription costs?", "Am I on track for my savings goal?"</li>
                <li><strong>Take Action:</strong> The AI can automatically create budgets, add goals, or generate categorization rules based on your conversation.</li>
                <li><strong>Deep Reasoning:</strong> Enable "Deep Reasoning" in the chat for complex financial analysis.</li>
              </ul>
            </div>
          </div>
        );
      case 'settings':
        return (
          <div className="space-y-4 animate-fade-in">
            <h3 className="text-xl font-bold text-textMain flex items-center gap-2">
              <Settings className="text-primary" size={24} /> Settings & Sync
            </h3>
            <p className="text-textMuted leading-relaxed">
              Configure the app to suit your needs and manage your data.
            </p>
            <ul className="space-y-3 text-sm text-textMuted">
              <li className="flex items-start gap-2">
                <div className="mt-1 w-1.5 h-1.5 rounded-full bg-primary shrink-0" />
                <span><strong>Categories & Rules:</strong> Add, edit, or delete transaction categories. View and manage your automated categorization rules.</span>
              </li>
              <li className="flex items-start gap-2">
                <div className="mt-1 w-1.5 h-1.5 rounded-full bg-primary shrink-0" />
                <span><strong>AI Configuration:</strong> Choose between Google's Gemini API (default) or connect to your own Local LLM (e.g., via Ollama) for maximum privacy.</span>
              </li>
              <li className="flex items-start gap-2">
                <div className="mt-1 w-1.5 h-1.5 rounded-full bg-primary shrink-0" />
                <span><strong>Cloud Sync:</strong> Sign in with Google to securely backup and sync your sessions across devices using your personal Google Drive.</span>
              </li>
              <li className="flex items-start gap-2">
                <div className="mt-1 w-1.5 h-1.5 rounded-full bg-primary shrink-0" />
                <span><strong>Export/Import:</strong> Download your session data as a JSON file for manual backup, or import a previously exported session.</span>
              </li>
            </ul>
          </div>
        );
      default:
        return null;
    }
  };

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
      <div className="bg-surface border border-border rounded-2xl shadow-2xl w-full max-w-4xl max-h-[90vh] flex flex-col overflow-hidden">
        
        {/* Header */}
        <div className="p-4 md:p-6 border-b border-border flex justify-between items-center bg-surfaceHighlight/50">
          <h2 className="text-xl md:text-2xl font-bold text-textMain flex items-center gap-2">
            <BookOpen className="text-primary" size={24} />
            Documentation Manual
          </h2>
          <button onClick={onClose} className="text-textMuted hover:text-textMain transition-colors p-1 rounded-lg hover:bg-surfaceHighlight">
            <X size={24} />
          </button>
        </div>

        <div className="flex flex-col md:flex-row flex-1 overflow-hidden">
          {/* Sidebar Navigation */}
          <div className="w-full md:w-64 border-b md:border-b-0 md:border-r border-border bg-surfaceHighlight/30 overflow-x-auto md:overflow-y-auto flex md:flex-col p-2 md:p-4 gap-1 shrink-0">
            {sections.map((section) => {
              const Icon = section.icon;
              const isActive = activeSection === section.id;
              return (
                <button
                  key={section.id}
                  onClick={() => setActiveSection(section.id)}
                  className={`flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all whitespace-nowrap md:whitespace-normal text-left ${
                    isActive 
                      ? 'bg-primary text-white shadow-md shadow-primary/20' 
                      : 'text-textMuted hover:bg-surfaceHighlight hover:text-textMain'
                  }`}
                >
                  <Icon size={18} className={isActive ? 'text-white' : 'text-textMuted'} />
                  <span className="font-medium text-sm">{section.label}</span>
                </button>
              );
            })}
          </div>

          {/* Content Area */}
          <div className="flex-1 overflow-y-auto p-4 md:p-8 custom-scrollbar">
            {renderContent()}
          </div>
        </div>

      </div>
    </div>
  );
};
