import type { Customer, LanguagePreference, StoreData } from '../types';
import { t } from './language';
import { normalizeNigerianPhone } from './phone';

function sameName(a: string | undefined, b: string) {
  return (a || '').trim().toLowerCase() === b.trim().toLowerCase();
}

export function customerMetrics(customer: Customer, data: StoreData) {
  const sales = data.sales.filter(sale => sale.customerId === customer.id || sameName(sale.customer, customer.name));
  const totalSpent = sales.reduce((sum, sale) => sum + sale.total, 0);
  const lastPurchase = [...sales].sort((a, b) => b.createdAt.localeCompare(a.createdAt))[0]?.createdAt || null;
  const outstandingDebt = data.debts
    .filter(debt => debt.type === 'customer' && (sameName(debt.name, customer.name) || (!!debt.phone && debt.phone === customer.phone)))
    .reduce((sum, debt) => sum + Math.max(0, debt.amount - debt.paid), 0);
  return { salesCount: sales.length, totalSpent, lastPurchase, outstandingDebt };
}

export function whatsappUrl(phone: string, message: string) {
  const normalized = normalizeNigerianPhone(phone).replace('+', '');
  return `https://wa.me/${normalized}?text=${encodeURIComponent(message)}`;
}

export function openWhatsApp(phone: string, message: string) {
  window.open(whatsappUrl(phone, message), '_blank', 'noopener,noreferrer');
}

export function customerFollowUpMessage(customer: Customer, businessName: string, language: LanguagePreference = 'en') {
  return t(
    language,
    'Hello {customer}, thank you for choosing {business}. We appreciate your business. Please let us know if there is anything we can help you with.',
    { customer: customer.name, business: businessName }
  );
}