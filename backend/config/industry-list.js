/**
 * User-Selectable Industry List
 * Used in signup form and account settings
 * Organized by category for better UX
 */

const INDUSTRY_CATEGORIES = [
  {
    category: 'Marketing & Advertising',
    industries: [
      'Marketing Agency',
      'MarTech / Marketing Technology',
      'Media & Advertising',
      'Public Relations',
      'Content Marketing'
    ]
  },
  {
    category: 'Sales & Customer',
    industries: [
      'Sales Technology / CRM',
      'Customer Support',
      'Customer Success Platform'
    ]
  },
  {
    category: 'Finance & Banking',
    industries: [
      'Finance',
      'FinTech / Financial Technology',
      'Banking',
      'Insurance',
      'InsurTech / Insurance Technology',
      'Accounting',
      'Accounting Software',
      'Wealth Management'
    ]
  },
  {
    category: 'Technology & Software',
    industries: [
      'SaaS / Cloud Software',
      'AI / Machine Learning',
      'Cybersecurity',
      'Developer Tools / DevOps',
      'Data & Analytics',
      'IT Services',
      'Computer Hardware & Software'
    ]
  },
  {
    category: 'Infrastructure & Cloud',
    industries: [
      'Data Infrastructure',
      'Digital Infrastructure',
      'Cloud Infrastructure',
      'Network Infrastructure'
    ]
  },
  {
    category: 'Telecommunications',
    industries: [
      'Telecommunications',
      'Telecom Software',
      'Unified Communications',
      'VoIP / Cloud Communications'
    ]
  },
  {
    category: 'Hardware & Equipment',
    industries: [
      'ICT Hardware',
      'Computer Hardware',
      'Networking Equipment',
      'Enterprise Hardware'
    ]
  },
  {
    category: 'Healthcare',
    industries: [
      'Healthcare / Medical Services',
      'HealthTech / Healthcare Technology',
      'Telemedicine',
      'Medical Devices'
    ]
  },
  {
    category: 'Ecommerce & Retail',
    industries: [
      'Ecommerce',
      'Retail',
      'Marketplace Platform'
    ]
  },
  {
    category: 'Real Estate & Construction',
    industries: [
      'Real Estate',
      'PropTech / Property Technology',
      'Construction',
      'Construction Technology'
    ]
  },
  {
    category: 'Education',
    industries: [
      'Education / Training',
      'EdTech / Education Technology',
      'Corporate Training'
    ]
  },
  {
    category: 'Professional Services',
    industries: [
      'Legal / Law Firm',
      'LegalTech / Legal Technology',
      'Consulting',
      'Accounting Services',
      'HR / Recruiting',
      'HR Technology / HCM'
    ]
  },
  {
    category: 'Operations & Logistics',
    industries: [
      'Manufacturing',
      'Logistics / Supply Chain',
      'Transportation',
      'Warehouse Management'
    ]
  },
  {
    category: 'Utilities & Energy',
    industries: [
      'Utilities',
      'Energy',
      'Water & Wastewater',
      'Power & Electric'
    ]
  },
  {
    category: 'Nonprofit & Government',
    industries: [
      'Nonprofit Organization',
      'Government / Public Sector'
    ]
  }
];

// Flat list for backend validation
const ALL_INDUSTRIES = INDUSTRY_CATEGORIES.flatMap(cat => cat.industries);

// Add "Other" option
ALL_INDUSTRIES.push('Other');

/**
 * Normalize industry name for matching with auto-detection
 * Maps user-selected industry to auto-detection keywords
 */
const INDUSTRY_MAPPING = {
  // Marketing
  'Marketing Agency': 'Agency',
  'MarTech / Marketing Technology': 'Marketing Technology',
  'Media & Advertising': 'Marketing',

  // Sales
  'Sales Technology / CRM': 'Sales Technology',
  'Customer Support': 'Customer Support',

  // Finance
  'FinTech / Financial Technology': 'FinTech',
  'Banking': 'Financial',
  'InsurTech / Insurance Technology': 'Insurance Technology',
  'Accounting Software': 'Accounting Software',

  // Tech
  'SaaS / Cloud Software': 'SaaS',
  'AI / Machine Learning': 'AI',
  'Developer Tools / DevOps': 'DevOps',
  'Data & Analytics': 'Data Analytics',

  // Healthcare
  'Healthcare / Medical Services': 'Healthcare',
  'HealthTech / Healthcare Technology': 'HealthTech',

  // Ecommerce
  'Ecommerce': 'E-commerce',
  'Marketplace Platform': 'E-commerce',

  // Real Estate
  'PropTech / Property Technology': 'PropTech',
  'Construction Technology': 'Construction',

  // Education
  'EdTech / Education Technology': 'EdTech',

  // Legal
  'LegalTech / Legal Technology': 'LegalTech',

  // Telecom
  'Telecom Software': 'Telecommunications',
  'VoIP / Cloud Communications': 'Telecommunications'
};

/**
 * Get normalized industry for recommendation engine
 */
function getNormalizedIndustry(userSelectedIndustry) {
  if (!userSelectedIndustry) return null;

  // Return mapped value if exists, otherwise return as-is
  return INDUSTRY_MAPPING[userSelectedIndustry] || userSelectedIndustry;
}

module.exports = {
  INDUSTRY_CATEGORIES,
  ALL_INDUSTRIES,
  INDUSTRY_MAPPING,
  getNormalizedIndustry
};
