export interface Release {
  version: string;
  date: string;
  features: string[];
  bugFixes: string[];
  improvements?: string[];
}

export const changelog: Release[] = [
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
