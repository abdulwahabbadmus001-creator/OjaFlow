import type { LanguagePreference, StoreData } from '../types';
import { t } from './language';

const money = (n: number) => new Intl.NumberFormat('en-NG', {
  style: 'currency',
  currency: 'NGN',
  maximumFractionDigits: 0
}).format(n);

function dayKey(date: Date) {
  return date.toISOString().slice(0, 10);
}

function salesForDay(data: StoreData, date: Date) {
  const key = dayKey(date);
  return data.sales.filter(sale => sale.createdAt.slice(0, 10) === key);
}

function expensesForDay(data: StoreData, date: Date) {
  const key = dayKey(date);
  return data.expenses.filter(expense => expense.createdAt.slice(0, 10) === key);
}

export function businessSnapshot(data: StoreData) {
  const today = new Date();
  const yesterday = new Date(Date.now() - 86_400_000);
  const todaysSales = salesForDay(data, today);
  const todaysExpenses = expensesForDay(data, today);
  const yesterdaySales = salesForDay(data, yesterday);
  const revenue = todaysSales.reduce((sum, sale) => sum + sale.total, 0);
  const yesterdayRevenue = yesterdaySales.reduce((sum, sale) => sum + sale.total, 0);
  const expenses = todaysExpenses.reduce((sum, expense) => sum + expense.amount, 0);
  const outstandingCustomerDebt = data.debts
    .filter(debt => debt.type === 'customer')
    .reduce((sum, debt) => sum + Math.max(0, debt.amount - debt.paid), 0);
  const outstandingSupplierDebt = data.debts
    .filter(debt => debt.type === 'supplier')
    .reduce((sum, debt) => sum + Math.max(0, debt.amount - debt.paid), 0);
  const lowStock = data.products.filter(product => product.stock <= product.reorderLevel);
  const estimatedGrossProfit = todaysSales.reduce((sum, sale) => {
    const product = data.products.find(item => item.name.toLowerCase() === sale.itemName.toLowerCase());
    return sum + (product ? (sale.unitPrice - product.costPrice) * sale.quantity : 0);
  }, 0);
  const productTotals = new Map<string, number>();
  data.sales.forEach(sale => {
    productTotals.set(sale.itemName, (productTotals.get(sale.itemName) || 0) + sale.quantity);
  });
  const topProduct = [...productTotals.entries()].sort((a, b) => b[1] - a[1])[0] || null;
  const inventoryRetailValue = data.products.reduce((sum, product) => sum + product.sellingPrice * product.stock, 0);
  const invoiceOutstanding = data.invoices.filter(invoice => invoice.status !== 'paid').reduce((sum, invoice) => sum + invoice.total, 0);
  const customerTotals = new Map<string, number>();
  data.sales.forEach(sale => {
    if (sale.customer?.trim()) customerTotals.set(sale.customer, (customerTotals.get(sale.customer) || 0) + sale.total);
  });
  const topCustomer = [...customerTotals.entries()].sort((a, b) => b[1] - a[1])[0] || null;

  return {
    revenue,
    yesterdayRevenue,
    expenses,
    estimatedGrossProfit,
    cashMovement: revenue - expenses,
    outstandingCustomerDebt,
    outstandingSupplierDebt,
    lowStock: lowStock.map(product => ({
      name: product.name,
      stock: product.stock,
      reorderLevel: product.reorderLevel
    })),
    topProduct: topProduct ? { name: topProduct[0], unitsSold: topProduct[1] } : null,
    inventoryRetailValue,
    productCount: data.products.length,
    customerCount: data.customers.length,
    invoiceCount: data.invoices.length,
    invoiceOutstanding,
    topCustomer: topCustomer ? { name: topCustomer[0], value: topCustomer[1] } : null,
    saleCount: data.sales.length,
    expenseCount: data.expenses.length
  };
}

export function localAnswer(question: string, data: StoreData, language: LanguagePreference = 'en'): string | null {
  const q = question.toLowerCase().trim();
  const snapshot = businessSnapshot(data);
  const tr = (key: string, vars?: Record<string, string | number>) => t(language, key, vars);

  if (/how much.*sell|sales today|sell today|how market today|revenue today/.test(q)) {
    return tr("Today's recorded sales are {amount}.", { amount: money(snapshot.revenue) });
  }

  if (/profit today|today.*profit|how much.*profit/.test(q)) {
    return tr("Today's estimated gross profit is {profit}. Recorded expenses today are {expenses}.", { profit: money(snapshot.estimatedGrossProfit), expenses: money(snapshot.expenses) });
  }

  if (/spend|expense today|expenses today/.test(q)) {
    return tr("Today's recorded expenses are {amount}.", { amount: money(snapshot.expenses) });
  }

  if (/compare.*yesterday|today.*yesterday|yesterday.*today/.test(q)) {
    const difference = snapshot.revenue - snapshot.yesterdayRevenue;
    const direction = difference === 0 ? 'the same as' : difference > 0 ? 'higher than' : 'lower than';
    return tr("Today's sales are {today}, {direction} yesterday's {yesterday} by {difference}.", { today: money(snapshot.revenue), direction: tr(direction), yesterday: money(snapshot.yesterdayRevenue), difference: money(Math.abs(difference)) });
  }

  if (/who.*owe|customer.*debt|who dey owe|money.*owe me/.test(q)) {
    const open = data.debts.filter(debt => debt.type === 'customer' && debt.amount > debt.paid);
    if (!open.length) return tr('You currently have no recorded customer debt.');
    return tr('Customers with outstanding balances: {list}. Total customer debt is {total}.', { list: open.slice(0, 5).map(debt => `${debt.name} (${money(debt.amount - debt.paid)})`).join(', '), total: money(snapshot.outstandingCustomerDebt) });
  }

  if (/what.*owe supplier|supplier debt|owe.*supplier/.test(q)) {
    return tr('Your recorded outstanding supplier debt is {amount}.', { amount: money(snapshot.outstandingSupplierDebt) });
  }

  if (/low stock|restock|goods dey finish|stock.*low/.test(q)) {
    if (!snapshot.lowStock.length) return tr('No product is currently at or below its reorder level.');
    return tr('Low-stock items: {list}.', { list: snapshot.lowStock.map(product => `${product.name} (${product.stock} ${tr('left')})`).join(', ') });
  }

  if (/top.*product|best.*selling|sell.*most/.test(q)) {
    if (!snapshot.topProduct) return tr('There is not enough sales history yet to identify a top-selling product.');
    return tr('{product} is currently your top-selling recorded product with {count} units sold.', { product: snapshot.topProduct.name, count: snapshot.topProduct.unitsSold });
  }


  if (/top.*customer|best.*customer|customer.*spend.*most/.test(q)) {
    if (!snapshot.topCustomer) return tr('There is not enough linked customer sales history yet to identify a top customer.');
    return tr('{customer} is currently your highest-value recorded customer with {amount} in linked sales.', { customer: snapshot.topCustomer.name, amount: money(snapshot.topCustomer.value) });
  }

  if (/invoice|unpaid invoice|outstanding invoice/.test(q)) {
    const open = data.invoices.filter(invoice => invoice.status !== 'paid');
    if (!open.length) return tr('You currently have no unpaid recorded invoices.');
    return tr('You have {count} unpaid invoices worth {amount} in total.', { count: open.length, amount: money(snapshot.invoiceOutstanding) });
  }

  if (/how many.*product|inventory count/.test(q)) {
    return tr('You currently have {count} products in your inventory list.', { count: snapshot.productCount });
  }

  if (/stock value|inventory value/.test(q)) {
    return tr('The current retail value of your recorded stock is about {amount}.', { amount: money(snapshot.inventoryRetailValue) });
  }

  return null;
}