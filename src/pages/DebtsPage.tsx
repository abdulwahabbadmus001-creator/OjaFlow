import { useState } from 'react';
import { HandCoins, Plus, Phone, Building2, UserRound } from 'lucide-react';
import type { Debt, StoreData } from '../types';
import { money, todayISO, uid } from '../lib/format';
import Modal from '../components/Modal';
import { useI18n } from '../lib/i18n';

export default function DebtsPage({
  data,
  addDebt,
  updateDebtPaid
}: {
  data: StoreData;
  addDebt: (debt: Debt) => void;
  updateDebtPaid: (id: string, paid: number) => void;
}) {
  const [open, setOpen] = useState(false);
  const { tr } = useI18n();
  const outstanding = data.debts.reduce((total, debt) => total + Math.max(0, debt.amount - debt.paid), 0);
  const openCount = data.debts.filter(debt => debt.amount > debt.paid).length;

  return (
    <>
      <header className="page-head">
        <div>
          <span className="eyebrow">{tr('CREDIT CONTROL')}</span>
          <h1>{tr('Debts & credit')}</h1>
          <p>{tr('Track who owes you and what you owe suppliers.')}</p>
        </div>
        <button className="primary-btn" onClick={() => setOpen(true)}>
          <Plus size={18} /> {tr('Add debt')}
        </button>
      </header>

      <section className="hero-stat">
        <div>
          <span className="eyebrow light">{tr('TOTAL OPEN BALANCE')}</span>
          <strong>{money(outstanding)}</strong>
          <small>{tr('Across {count} open records', { count: openCount })}</small>
        </div>
        <HandCoins size={52} />
      </section>

      <div className="card-grid">
        {data.debts.map(debt => {
          const remaining = Math.max(0, debt.amount - debt.paid);
          return (
            <article className="debt-card" key={debt.id}>
              <div className="debt-head">
                <div className="list-icon">{debt.type === 'customer' ? <UserRound /> : <Building2 />}</div>
                <div className="grow">
                  <strong>{debt.name}</strong>
                  <span>{debt.type === 'customer' ? tr('Customer owes you') : tr('You owe supplier')}</span>
                </div>
                <span className={`status-badge ${remaining ? 'amber' : ''}`}>{remaining ? tr('Open') : tr('Paid')}</span>
              </div>

              <div className="debt-money"><span>{tr('Remaining')}</span><strong>{money(remaining)}</strong></div>
              <div className="progress"><span style={{ width: `${Math.min(100, (debt.paid / debt.amount) * 100) || 0}%` }} /></div>
              <div className="debt-foot">
                <small>{tr('{paid} paid of {total}', { paid: money(debt.paid), total: money(debt.amount) })}</small>
                {debt.phone && <a href={`tel:${debt.phone}`}><Phone size={15} /> {tr('Call')}</a>}
              </div>

              {remaining > 0 && (
                <button
                  className="secondary-btn full"
                  onClick={() => {
                    const value = prompt(tr('Total amount paid so far'), String(debt.paid));
                    if (value !== null) updateDebtPaid(debt.id, Number(value) || 0);
                  }}
                >
                  {tr('Record payment')}
                </button>
              )}
            </article>
          );
        })}
      </div>

      {open && (
        <Modal title={tr('Add debt or credit')} onClose={() => setOpen(false)}>
          <form
            className="form-stack"
            onSubmit={event => {
              event.preventDefault();
              const form = new FormData(event.currentTarget);
              addDebt({
                id: uid(),
                type: String(form.get('type')) as Debt['type'],
                name: String(form.get('name')),
                phone: String(form.get('phone') || ''),
                amount: Number(form.get('amount')),
                paid: Number(form.get('paid') || 0),
                dueDate: String(form.get('dueDate') || ''),
                createdAt: todayISO()
              });
              setOpen(false);
            }}
          >
            <label>
              {tr('Type')}
              <select name="type">
                <option value="customer">{tr('Customer owes me')}</option>
                <option value="supplier">{tr('I owe a supplier')}</option>
              </select>
            </label>
            <label>{tr('Name')}<input name="name" required /></label>
            <label>{tr('Phone')} <span className="optional">{tr('Optional')}</span><input name="phone" /></label>
            <div className="two-col">
              <label>{tr('Total amount')}<input name="amount" type="number" min="0" required /></label>
              <label>{tr('Already paid')}<input name="paid" type="number" min="0" defaultValue="0" /></label>
            </div>
            <label>{tr('Due date')} <span className="optional">{tr('Optional')}</span><input name="dueDate" type="date" /></label>
            <button className="primary-btn full">{tr('Save debt')}</button>
          </form>
        </Modal>
      )}
    </>
  );
}
