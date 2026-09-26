import { useState } from 'react';
import { ArrowRight, Store } from 'lucide-react';
import type { BusinessProfile } from '../types';
import { useI18n } from '../lib/i18n';

export default function BusinessSetup({ phone, onComplete }: { phone: string; onComplete: (business: BusinessProfile) => void }) {
  const [busy, setBusy] = useState(false);
  const { tr } = useI18n();

  return (
    <div className="setup-page">
      <div className="setup-card">
        <div className="round-icon"><Store /></div>
        <span className="eyebrow">{tr('BUSINESS SETUP')}</span>
        <h1>{tr('Tell us about your business')}</h1>
        <p className="muted">{tr('This helps OjaFlow personalize your workspace.')}</p>

        <form
          className="form-stack"
          onSubmit={event => {
            event.preventDefault();
            setBusy(true);
            const form = new FormData(event.currentTarget);
            onComplete({
              businessName: String(form.get('businessName')),
              category: String(form.get('category')),
              phone: String(form.get('phone')),
              address: String(form.get('address')),
              currency: 'NGN'
            });
          }}
        >
          <label>{tr('Business name')}<input name="businessName" placeholder="e.g. Wahab Stores" required /></label>
          <label>
            {tr('Business category')}
            <select name="category" required defaultValue="">
              <option value="" disabled>{tr('Select category')}</option>
              <option value="General Trading">{tr('General Trading')}</option>
              <option value="Food & Groceries">{tr('Food & Groceries')}</option>
              <option value="Fashion">{tr('Fashion')}</option>
              <option value="Electronics">{tr('Electronics')}</option>
              <option value="Beauty & Personal Care">{tr('Beauty & Personal Care')}</option>
              <option value="Pharmacy / Health Retail">{tr('Pharmacy / Health Retail')}</option>
              <option value="Other">{tr('Other')}</option>
            </select>
          </label>
          <label>{tr('Business phone')}<input name="phone" defaultValue={phone} /></label>
          <label>{tr('Business address')}<input name="address" placeholder={tr('Market, town or city')} required /></label>
          <button className="primary-btn full" disabled={busy}>
            {busy ? tr('Saving…') : tr('Finish setup')} <ArrowRight size={18} />
          </button>
        </form>
      </div>
    </div>
  );
}
