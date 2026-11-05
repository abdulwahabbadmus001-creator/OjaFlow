import type { Debt, Expense, Product, Sale } from '../types';
import { money, todayISO, uid } from './format';

export type ParsedVoiceAction =
  | {
      kind: 'sale';
      itemName: string;
      quantity: number;
      unitPrice: number;
      total: number;
      paymentMethod: Sale['paymentMethod'];
      customer?: string;
      summary: string;
    }
  | {
      kind: 'expense';
      description: string;
      category: string;
      amount: number;
      summary: string;
    }
  | {
      kind: 'debt';
      debtType: Debt['type'];
      name: string;
      amount: number;
      summary: string;
    };

function parseAmountToken(raw: string): number {
  const cleaned = raw.replace(/[₦,\s]/g, '').toLowerCase();
  const match = cleaned.match(/^(\d+(?:\.\d+)?)(k|m)?$/);
  if (!match) return 0;
  const base = Number(match[1]);
  if (!Number.isFinite(base) || base <= 0) return 0;
  if (match[2] === 'k') return Math.round(base * 1000);
  if (match[2] === 'm') return Math.round(base * 1000000);
  return Math.round(base);
}

function detectPaymentMethod(text: string): Sale['paymentMethod'] {
  const lower = text.toLowerCase();
  if (/\b(transfer|bank|opay|palmpay|moniepoint|kuda)\b/.test(lower)) {
    return 'Transfer';
  }
  if (/\b(pos|card|atm)\b/.test(lower)) {
    return 'POS';
  }
  if (/\b(credit|owe|later)\b/.test(lower)) {
    return 'Credit';
  }
  return 'Cash';
}

function inferExpenseCategory(text: string): string {
  const lower = text.toLowerCase();
  if (/\b(fuel|diesel|petrol|gen|generator|nepa|light|power)\b/.test(lower)) {
    return 'Power & Fuel';
  }
  if (/\b(transport|bus|keke|okada|delivery|waybill|carriage|load)\b/.test(lower)) {
    return 'Transport';
  }
  if (/\b(rent|shop|stall|market fee|ticket|union|levy)\b/.test(lower)) {
    return 'Shop & Market Levy';
  }
  if (/\b(nylon|packaging|bag|carton|wrap)\b/.test(lower)) {
    return 'Packaging';
  }
  return 'General';
}

export function parseVoiceAction(
  rawText: string,
  products: Product[] = []
): ParsedVoiceAction | null {
  const text = rawText
    .trim()
    .replace(/\s+/g, ' ')
    .replace(/[.!]+$/, '')
    .trim();
  if (
    !text ||
    rawText.trim().endsWith('?') ||
    /^(how|what|why|when|where|who|which|can|could|should|tell|show|give|check|calculate|explain|help)\b/i.test(
      text
    )
  ) {
    return null;
  }

  // 1. Check for EXPENSE command:
  // Pattern A: "Add expense 3000 for transport", "I spent 2500 on fuel", "Paid 1500 market ticket"
  const expenseMatchA = text.match(
    /^(?:please\s+)?(?:record\s+expense|add\s+expense|log\s+expense|i\s+spent|we\s+spent|spent|i\s+pay|i\s+paid|paid|expense)\s+(?:of\s+)?₦?\s*(\d[\d,]*(?:\.\d+)?[km]?)\s*(?:naira\s*)?(?:for|on|to)?\s+(.+)$/i
  );
  // Pattern B: "Add expense for transport 3000", "Spent on fuel 4500"
  const expenseMatchB = text.match(
    /^(?:please\s+)?(?:record\s+expense|add\s+expense|log\s+expense|i\s+spent|we\s+spent|spent|expense)\s+(?:for|on)?\s*([a-zA-Z][a-zA-Z\s-]{2,35}?)\s+₦?\s*(\d[\d,]*(?:\.\d+)?[km]?)(?:\s*naira)?$/i
  );

  if (expenseMatchA || expenseMatchB) {
    const amount = expenseMatchA
      ? parseAmountToken(expenseMatchA[1])
      : parseAmountToken(expenseMatchB![2]);
    const description = (
      expenseMatchA ? expenseMatchA[2] : expenseMatchB![1]
    )
      .trim()
      .replace(/\s+naira$/i, '')
      .trim();

    if (amount > 0 && description.length >= 2) {
      const category = inferExpenseCategory(description);
      const cleanDesc =
        description.charAt(0).toUpperCase() + description.slice(1);
      return {
        kind: 'expense',
        description: cleanDesc,
        category,
        amount,
        summary: `Expense: ${cleanDesc} (${category}) — ${money(amount)}`
      };
    }
  }

  // 2. Check for DEBT command:
  // e.g. "Add debt Mama T owes 15000", "Record debt Chinedu owe me 8500", "Mama T owes me 15000"
  const debtMatch = text.match(
    /^(?:(?:add\s+debt|record\s+debt|log\s+debt|customer|debt)\s+)?([a-zA-Z][a-zA-Z0-9\s.'-]{1,32}?)\s+(?:owes?(?:\s+me)?|is\s+owing(?:\s+me)?|dey\s+owe(?:\s+me)?)\s+₦?\s*(\d[\d,]*(?:\.\d+)?[km]?)(?:\s*naira)?$/i
  );
  if (debtMatch) {
    const name = debtMatch[1]
      .replace(/^(?:add\s+debt|record\s+debt|log\s+debt|customer|debt)\s+/i, '')
      .trim();
    const amount = parseAmountToken(debtMatch[2]);
    if (name && !/^(i|we|who|what)$/i.test(name) && amount > 0) {
      return {
        kind: 'debt',
        debtType: 'customer',
        name,
        amount,
        summary: `Customer Debt: ${name} owes ${money(amount)}`
      };
    }
  }

  // 3. Check for SALE command:
  // Pattern A: "Record sale 3 bags of rice for 45000 cash", "I sold 2 cartons of Indomie 18000 transfer"
  // Pattern B: "3 bags of rice for 45000 cash"
  const saleMatch =
    text.match(
      /^(?:please\s+)?(?:record\s+sale|add\s+sale|log\s+sale|i\s+sold|we\s+sold|i\s+don\s+sell|i\s+sell|sell|sold|sale)\s+(?:(\d+)\s+)?(.+?)\s+(?:for|at|₦)?\s*₦?\s*(\d[\d,]*(?:\.\d+)?[km]?)(?:\s*naira)?(?:\s+(.*))?$/i
    ) ||
    text.match(
      /^(\d+)\s+([a-zA-Z][a-zA-Z0-9\s-]{2,40}?)\s+(?:for|at)\s+₦?\s*(\d[\d,]*(?:\.\d+)?[km]?)(?:\s*naira)?(?:\s+(.*))?$/i
    );

  if (saleMatch) {
    const quantity = Math.max(1, Number(saleMatch[1] || '1'));
    let rawItem = saleMatch[2]
      .trim()
      .replace(/\b(cash|transfer|pos|credit|for|at|naira)\b/gi, '')
      .replace(/\s+/g, ' ')
      .trim();
    const amount = parseAmountToken(saleMatch[3]);
    const tail = saleMatch[4] || '';

    if (amount > 0 && rawItem.length >= 2) {
      // Match against existing inventory product name if possible
      const matchedProduct = products.find(
        p =>
          p.name.toLowerCase() === rawItem.toLowerCase() ||
          rawItem.toLowerCase().includes(p.name.toLowerCase())
      );
      if (matchedProduct) {
        rawItem = matchedProduct.name;
      } else {
        rawItem = rawItem.charAt(0).toUpperCase() + rawItem.slice(1);
      }

      const paymentMethod = detectPaymentMethod(`${text} ${tail}`);
      const total = amount;
      const unitPrice = Math.max(1, Math.round(total / quantity));

      return {
        kind: 'sale',
        itemName: rawItem,
        quantity,
        unitPrice,
        total,
        paymentMethod,
        summary: `Sale: ${quantity} × ${rawItem} (${paymentMethod.toUpperCase()}) — ${money(total)}`
      };
    }
  }

  return null;
}

export function materializeSale(action: Extract<ParsedVoiceAction, { kind: 'sale' }>): Sale {
  return {
    id: uid(),
    itemName: action.itemName,
    quantity: action.quantity,
    unitPrice: action.unitPrice,
    total: action.total,
    paymentMethod: action.paymentMethod,
    customer: action.customer || 'Walk-in',
    createdAt: todayISO()
  };
}

export function materializeExpense(
  action: Extract<ParsedVoiceAction, { kind: 'expense' }>
): Expense {
  return {
    id: uid(),
    description: action.description,
    category: action.category,
    amount: action.amount,
    createdAt: todayISO()
  };
}

export function materializeDebt(
  action: Extract<ParsedVoiceAction, { kind: 'debt' }>
): Debt {
  return {
    id: uid(),
    type: action.debtType,
    name: action.name,
    phone: '',
    amount: action.amount,
    paid: 0,
    dueDate: '',
    createdAt: todayISO()
  };
}
