import type { BusinessProfile, LanguagePreference, StoreData, UserProfile } from '../types';
import { localeForLanguage, t } from './language';

function downloadBlob(filename: string, content: string, type: string) {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 0);
}

function csvCell(value: unknown) {
  const text = String(value ?? '');
  return `"${text.replace(/"/g, '""')}"`;
}

function stamp() {
  return new Date().toISOString().slice(0, 10);
}

export function exportAllAsJson(profile: UserProfile, business: BusinessProfile, data: StoreData) {
  const payload = {
    exportedAt: new Date().toISOString(),
    app: 'OjaFlow',
    profile: {
      firstName: profile.firstName,
      lastName: profile.lastName,
      otherName: profile.otherName,
      phoneNumber: profile.phoneNumber,
      preferredLanguage: profile.preferredLanguage
    },
    business,
    data
  };

  downloadBlob(
    `ojaflow-backup-${stamp()}.json`,
    JSON.stringify(payload, null, 2),
    'application/json;charset=utf-8'
  );
}

export function exportAllAsCsv(data: StoreData) {
  const rows: Record<string, unknown>[] = [
    ...data.sales.map(record => ({ recordType: 'sale', ...record })),
    ...data.expenses.map(record => ({ recordType: 'expense', ...record })),
    ...data.products.map(record => ({ recordType: 'product', ...record })),
    ...data.debts.map(record => ({ recordType: 'debt', ...record })),
    ...data.customers.map(record => ({ recordType: 'customer', ...record })),
    ...data.invoices.map(record => ({ recordType: 'invoice', ...record, items: JSON.stringify(record.items) }))
  ];

  const columns = Array.from(new Set(rows.flatMap(row => Object.keys(row))));
  const csv = rows.length
    ? [
        columns.map(csvCell).join(','),
        ...rows.map(row => columns.map(column => csvCell(row[column])).join(','))
      ].join('\n')
    : 'recordType\n';

  downloadBlob(`ojaflow-data-${stamp()}.csv`, csv, 'text/csv;charset=utf-8');
}

export function createBusinessSummaryText(business: BusinessProfile, data: StoreData, language: LanguagePreference = 'en') {
  const sales = data.sales.reduce((total, sale) => total + sale.total, 0);
  const expenses = data.expenses.reduce((total, expense) => total + expense.amount, 0);
  const debts = data.debts.reduce((total, debt) => total + Math.max(0, debt.amount - debt.paid), 0);
  const lowStock = data.products.filter(product => product.stock <= product.reorderLevel);
  const tr = (key: string, vars?: Record<string, string | number>) => t(language, key, vars);
  const locale = localeForLanguage(language);

  return [
    tr('OJAFLOW BUSINESS SUMMARY'),
    tr('Business: {business}', { business: business.businessName }),
    tr('Generated: {date}', { date: new Date().toLocaleString(locale) }),
    '',
    tr('Recorded sales: {amount}', { amount: `₦${sales.toLocaleString(locale)}` }),
    tr('Recorded expenses: {amount}', { amount: `₦${expenses.toLocaleString(locale)}` }),
    tr('Outstanding debt: {amount}', { amount: `₦${debts.toLocaleString(locale)}` }),
    tr('Products: {count}', { count: data.products.length }),
    tr('Customers: {count}', { count: data.customers.length }),
    tr('Invoices: {count}', { count: data.invoices.length }),
    tr('Low-stock items: {items}', { items: lowStock.length ? lowStock.map(item => item.name).join(', ') : tr('None') })
  ].join('\n');
}

export function exportSummary(business: BusinessProfile, data: StoreData, language: LanguagePreference = 'en') {
  downloadBlob(
    `ojaflow-business-summary-${stamp()}.txt`,
    createBusinessSummaryText(business, data, language),
    'text/plain;charset=utf-8'
  );
}