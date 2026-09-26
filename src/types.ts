export type PaymentMethod = 'Cash' | 'Transfer' | 'POS' | 'Credit';
export type DebtType = 'customer' | 'supplier';
export type SyncStatus = 'idle' | 'syncing' | 'synced' | 'offline' | 'error';
export type ThemePreference = 'light' | 'dark' | 'system';
export type LanguagePreference = 'en' | 'pcm' | 'yo' | 'ha' | 'ig';
export type InvoiceStatus = 'draft' | 'sent' | 'paid' | 'overdue';

export interface UserProfile {
  uid: string;
  phoneNumber: string;
  firstName: string;
  lastName: string;
  otherName?: string;
  preferredLanguage: LanguagePreference;
  onboardingCompleted: boolean;
  businessProfileCompleted: boolean;
}

export interface BusinessProfile {
  businessName: string;
  category: string;
  phone: string;
  address: string;
  currency: string;
}

export interface Product {
  id: string;
  name: string;
  category: string;
  costPrice: number;
  sellingPrice: number;
  stock: number;
  reorderLevel: number;
  createdAt: string;
}

export interface Sale {
  id: string;
  itemName: string;
  quantity: number;
  unitPrice: number;
  total: number;
  paymentMethod: PaymentMethod;
  customer?: string;
  customerId?: string;
  createdAt: string;
}

export interface Expense {
  id: string;
  category: string;
  description: string;
  amount: number;
  createdAt: string;
}

export interface Debt {
  id: string;
  type: DebtType;
  name: string;
  phone?: string;
  amount: number;
  paid: number;
  dueDate?: string;
  createdAt: string;
}

export interface Customer {
  id: string;
  name: string;
  phone: string;
  address?: string;
  notes?: string;
  tags?: string[];
  whatsappOptIn?: boolean;
  createdAt: string;
}

export interface InvoiceLine {
  id: string;
  description: string;
  quantity: number;
  unitPrice: number;
}

export interface Invoice {
  id: string;
  invoiceNumber: string;
  customerId?: string;
  customerName: string;
  customerPhone?: string;
  items: InvoiceLine[];
  subtotal: number;
  total: number;
  status: InvoiceStatus;
  dueDate?: string;
  note?: string;
  createdAt: string;
}

export interface StoreData {
  products: Product[];
  sales: Sale[];
  expenses: Expense[];
  debts: Debt[];
  customers: Customer[];
  invoices: Invoice[];
}

export interface NotificationPreferences {
  lowStock: boolean;
  debtReminders: boolean;
  dailySummary: boolean;
  syncProblems: boolean;
}

export type AppSection = 'home' | 'sales' | 'inventory' | 'debts' | 'more';