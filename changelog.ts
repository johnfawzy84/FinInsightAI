export interface Release {
  version: string;
  date: string;
  features: string[];
  bugFixes: string[];
  improvements?: string[];
}

export const changelog: Release[] = [
  {
    version: "1.3.0",
    date: "2026-03-08",
    features: [
      "Added theme-aware color variables to all UI elements.",
      "Added a new Danger Zone section in settings.",
      "Added possibility to add your own local LLM",
      "Full Progressive Web App (PWA) support with offline capabilities and install prompt."
    ],
    bugFixes: [
      "Fixed the Add button in categories being cut-off in mobile view.",
      "Fixed the tutorial walk-through overlay on mobile devices.",
      "Fixed the 'Income to Expense Flow' diagram name visibility in light mode.",
      "Fixed dark elements appearing in the transaction section in light mode.",
      "Fixed readability issues in Spendings, Budgets, and Goals & Allocations sections in light mode."
    ],
    improvements: [
      "Improved the settings UI for better consistency and user experience.",
      "Refactored categorization rules to use theme-aware colors."
    ]
  },
  {
    version: "1.2.0",
    date: "2024-05-21",
    features: [
      "Introduced comprehensive Dark/Light mode theming.",
      "Added 'What's New' modal to highlight updates.",
      "Enhanced AI Consultant with Deep Reasoning capabilities.",
      "New Dashboard Widgets: Net Worth, Asset Allocation, and Recurring Expenses."
    ],
    bugFixes: [
      "Fixed layout issues in the sidebar on smaller screens.",
      "Resolved chart rendering inconsistencies."
    ],
    improvements: [
      "Improved performance of transaction filtering.",
      "Refined UI for Settings and Profile management."
    ]
  }
];

export const currentVersion = changelog[0].version;
