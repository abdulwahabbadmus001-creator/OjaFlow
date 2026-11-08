import { useState } from 'react';
import { Plus, Search, WalletCards } from 'lucide-react';
import type { Expense, StoreData } from '../types';
import { money, todayISO, uid } from '../lib/format';
import Modal from '../components/Modal';
import { useI18n } from '../lib/i18n';

export function ExpensesTable({
  expenses,
  query = ''
}: {
  expenses: Expense[];
  query?: string;
}) {
  const { tr, locale } = useI18n();
  const lower = query.toLowerCase();
  const filtered = expenses.filter(item =>
    `${item.description} ${item.category}`.toLowerCase().includes(lower)
  );

  return (
    <div className="data-table">
      <div className="table-head">
        <span>{tr('Description')}</span>
        <span>{tr('Category')}</span>
        <span>{tr('Date')}</span>
        <span className="right">{tr('Amount')}</span>
      </div>
      {filtered.map(expense => (
        <div className="table-row" key={expense.id}>
          <span>
            <strong>{expense.description}</strong>
          </span>
          <span>{tr(expense.category)}</span>
          <span>{new Date(expense.createdAt).toLocaleDateString(locale)}</span>
          <strong className="right negative">−{money(expense.amount)}</strong>
        </div>
      ))}
      {!filtered.length && (
        <div className="empty-state">
          {tr('No expenses recorded yet.')}
        </div>
      )}
    </div>
  );
}

export default function ExpensesPage({
  data,
  addExpense,
  embedded = false,
  query: externalQuery
}: {
  data: StoreData;
  addExpense: (item: Expense) => void;
  embedded?: boolean;
  query?: string;
}) {
  const { tr } = useI18n();
  const [open, setOpen] = useState(false);
  const [internalQuery, setInternalQuery] = useState('');

  if (embedded) {
    return <ExpensesTable expenses={data.expenses} query={externalQuery || ''} />;
  }

  return (
    <>
      <header className="page-head">
        <div>
          <span className="eyebrow">{tr('COST TRACKING')}</span>
          <h1>{tr('Expenses')}</h1>
          <p>{tr('Track shop operating costs, transport, supplies and utilities.')}</p>
        </div>
        <button className="primary-btn" onClick={() => setOpen(true)}>
          <Plus size={18} />
          {tr('Add expense')}
        </button>
      </header>

      <div className="panel">
        <div className="table-toolbar">
          <div className="search">
            <Search size={18} />
            <input
              placeholder={tr('Search records')}
              value={internalQuery}
              onChange={event => setInternalQuery(event.target.value)}
            />
          </div>
        </div>
        <ExpensesTable expenses={data.expenses} query={internalQuery} />
      </div>

      {open && (
        <Modal title={tr('Record an expense')} onClose={() => setOpen(false)}>
          <form
            className="form-stack"
            onSubmit={event => {
              event.preventDefault();
              const form = new FormData(event.currentTarget);
              addExpense({
                id: uid(),
                category: String(form.get('category')),
                description: String(form.get('description')),
                amount: Number(form.get('amount')),
                createdAt: todayISO()
              });
              setOpen(false);
            }}
          >
            <label>
              {tr('Description')}
              <input name="description" required />
            </label>
            <label>
              {tr('Category')}
              <select name="category">
                <option value="Transport">{tr('Transport')}</option>
                <option value="Supplies">{tr('Supplies')}</option>
                <option value="Rent">{tr('Rent')}</option>
                <option value="Utilities">{tr('Utilities')}</option>
                <option value="Salary">{tr('Salary')}</option>
                <option value="Other">{tr('Other')}</option>
              </select>
            </label>
            <label>
              {tr('Amount')}
              <input name="amount" type="number" min="0" required />
            </label>
            <button className="primary-btn full">
              <WalletCards size={16} />
              {tr('Save expense')}
            </button>
          </form>
        </Modal>
      )}
    </>
  );
}
