import type { BusinessProfile, Invoice, LanguagePreference, Sale } from '../types';
import { money } from './format';
import { whatsappUrl } from './customerCrm';
import { localeForLanguage, t } from './language';

function escapeHtml(value: string | number | undefined | null) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

function baseStyles() {
  return `
    :root{font-family:Inter,Arial,sans-serif;color:#17231d;background:#fff}
    *{box-sizing:border-box}body{margin:0;padding:34px;background:#f5f7f6}.sheet{max-width:820px;margin:auto;background:#fff;border:1px solid #dfe7e2;border-radius:18px;padding:34px;box-shadow:0 18px 55px rgba(9,44,28,.08)}
    .brand{display:flex;align-items:center;gap:12px}.logo{width:46px;height:46px;border-radius:14px;background:#0b6b45;color:white;display:grid;place-items:center;font-weight:900;font-size:24px}.brand b{font-size:22px}.muted{color:#6b7a72}.top{display:flex;justify-content:space-between;gap:24px;align-items:flex-start;border-bottom:1px solid #e3e9e5;padding-bottom:22px}.doc-title{text-align:right}.doc-title h1{margin:0;font-size:28px}.doc-title span{color:#0b6b45;font-weight:700}.meta{display:grid;grid-template-columns:1fr 1fr;gap:24px;margin:26px 0}.box{background:#f8faf9;border:1px solid #e1e8e4;border-radius:14px;padding:16px}.box h3{margin:0 0 8px;font-size:12px;letter-spacing:.08em;color:#718078;text-transform:uppercase}.box p{margin:3px 0}.table{width:100%;border-collapse:collapse;margin-top:20px}.table th{background:#0b6b45;color:white;text-align:left;padding:12px;font-size:12px}.table td{padding:13px 12px;border-bottom:1px solid #e8eeea}.right{text-align:right}.totals{margin-left:auto;width:min(360px,100%);margin-top:22px}.total-row{display:flex;justify-content:space-between;padding:8px 0}.grand{border-top:2px solid #17231d;margin-top:8px;padding-top:13px;font-size:20px;font-weight:800}.foot{margin-top:34px;padding-top:18px;border-top:1px solid #e3e9e5;font-size:12px;color:#6d7c74;display:flex;justify-content:space-between;gap:20px}.status{display:inline-block;padding:6px 10px;border-radius:999px;background:#e6f5ec;color:#075338;font-weight:700;text-transform:capitalize}.actions{max-width:820px;margin:16px auto;display:flex;gap:10px;justify-content:flex-end}.actions button{border:0;border-radius:10px;padding:11px 16px;font-weight:700;cursor:pointer}.primary{background:#0b6b45;color:white}.secondary{background:white;border:1px solid #dfe7e2!important;color:#17231d}@media print{body{padding:0;background:#fff}.sheet{border:0;box-shadow:none;padding:10px}.actions{display:none}}
  `;
}

function shell(title: string, content: string, language: LanguagePreference) {
  const tr = (key: string) => t(language, key);
  return `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${escapeHtml(title)}</title><style>${baseStyles()}</style></head><body>${content}<div class="actions"><button class="secondary" onclick="window.close()">${escapeHtml(tr('Close'))}</button><button class="primary" onclick="window.print()">${escapeHtml(tr('Print / Save PDF'))}</button></div></body></html>`;
}

function businessHeader(business: BusinessProfile) {
  return `<div class="brand"><div class="logo">O</div><div><b>OjaFlow</b><div class="muted">${escapeHtml(business.businessName)}</div></div></div>`;
}

export function receiptHtml(business: BusinessProfile, sale: Sale, language: LanguagePreference = 'en') {
  const tr = (key: string) => t(language, key);
  const locale = localeForLanguage(language);
  const receiptNo = `RCPT-${sale.id.slice(0, 8).toUpperCase()}`;
  const content = `<main class="sheet">
    <div class="top">${businessHeader(business)}<div class="doc-title"><h1>${escapeHtml(tr('Sales Receipt'))}</h1><span>${escapeHtml(receiptNo)}</span></div></div>
    <div class="meta">
      <div class="box"><h3>${escapeHtml(tr('Business'))}</h3><p><strong>${escapeHtml(business.businessName)}</strong></p><p>${escapeHtml(business.address)}</p><p>${escapeHtml(business.phone)}</p></div>
      <div class="box"><h3>${escapeHtml(tr('Receipt details'))}</h3><p>${escapeHtml(tr('Date'))}: ${escapeHtml(new Date(sale.createdAt).toLocaleString(locale))}</p><p>${escapeHtml(tr('Payment'))}: ${escapeHtml(sale.paymentMethod)}</p><p>${escapeHtml(tr('Customer'))}: ${escapeHtml(sale.customer || tr('Walk-in customer'))}</p></div>
    </div>
    <table class="table"><thead><tr><th>${escapeHtml(tr('Item'))}</th><th>${escapeHtml(tr('Qty'))}</th><th class="right">${escapeHtml(tr('Unit price'))}</th><th class="right">${escapeHtml(tr('Amount'))}</th></tr></thead><tbody><tr><td>${escapeHtml(sale.itemName)}</td><td>${sale.quantity}</td><td class="right">${escapeHtml(money(sale.unitPrice))}</td><td class="right">${escapeHtml(money(sale.total))}</td></tr></tbody></table>
    <div class="totals"><div class="total-row grand"><span>${escapeHtml(tr('Total paid'))}</span><span>${escapeHtml(money(sale.total))}</span></div></div>
    <div class="foot"><span>${escapeHtml(tr('Thank you for your business.'))}</span><span>${escapeHtml(tr('Generated with OjaFlow'))}</span></div>
  </main>`;
  return shell(`${business.businessName} ${tr('Receipt')}`, content, language);
}

export function invoiceHtml(business: BusinessProfile, invoice: Invoice, language: LanguagePreference = 'en') {
  const tr = (key: string) => t(language, key);
  const locale = localeForLanguage(language);
  const rows = invoice.items.map(item => `<tr><td>${escapeHtml(item.description)}</td><td>${item.quantity}</td><td class="right">${escapeHtml(money(item.unitPrice))}</td><td class="right">${escapeHtml(money(item.quantity * item.unitPrice))}</td></tr>`).join('');
  const content = `<main class="sheet">
    <div class="top">${businessHeader(business)}<div class="doc-title"><h1>${escapeHtml(tr('Invoice'))}</h1><span>${escapeHtml(invoice.invoiceNumber)}</span><div style="margin-top:8px"><span class="status">${escapeHtml(tr(invoice.status))}</span></div></div></div>
    <div class="meta">
      <div class="box"><h3>${escapeHtml(tr('From'))}</h3><p><strong>${escapeHtml(business.businessName)}</strong></p><p>${escapeHtml(business.address)}</p><p>${escapeHtml(business.phone)}</p></div>
      <div class="box"><h3>${escapeHtml(tr('Bill to'))}</h3><p><strong>${escapeHtml(invoice.customerName)}</strong></p><p>${escapeHtml(invoice.customerPhone || '')}</p><p>${escapeHtml(tr('Issued'))}: ${escapeHtml(new Date(invoice.createdAt).toLocaleDateString(locale))}</p><p>${escapeHtml(tr('Due'))}: ${escapeHtml(invoice.dueDate ? new Date(`${invoice.dueDate}T00:00:00`).toLocaleDateString(locale) : tr('On receipt'))}</p></div>
    </div>
    <table class="table"><thead><tr><th>${escapeHtml(tr('Description'))}</th><th>${escapeHtml(tr('Qty'))}</th><th class="right">${escapeHtml(tr('Unit price'))}</th><th class="right">${escapeHtml(tr('Amount'))}</th></tr></thead><tbody>${rows}</tbody></table>
    <div class="totals"><div class="total-row"><span>${escapeHtml(tr('Subtotal'))}</span><span>${escapeHtml(money(invoice.subtotal))}</span></div><div class="total-row grand"><span>${escapeHtml(tr('Total'))}</span><span>${escapeHtml(money(invoice.total))}</span></div></div>
    ${invoice.note ? `<div class="box" style="margin-top:24px"><h3>${escapeHtml(tr('Note'))}</h3><p>${escapeHtml(invoice.note)}</p></div>` : ''}
    <div class="foot"><span>${escapeHtml(tr('Thank you for your business.'))}</span><span>${escapeHtml(tr('Generated with OjaFlow'))}</span></div>
  </main>`;
  return shell(`${invoice.invoiceNumber} - ${business.businessName}`, content, language);
}

function openDocument(html: string) {
  const popup = window.open('', '_blank');
  if (!popup) throw new Error('Your browser blocked the document window. Allow pop-ups for OjaFlow and try again.');
  popup.opener = null;
  popup.document.open();
  popup.document.write(html);
  popup.document.close();
}

function downloadHtml(filename: string, html: string) {
  const blob = new Blob([html], { type: 'text/html;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function printReceipt(business: BusinessProfile, sale: Sale, language: LanguagePreference = 'en') {
  openDocument(receiptHtml(business, sale, language));
}

export function downloadReceipt(business: BusinessProfile, sale: Sale, language: LanguagePreference = 'en') {
  downloadHtml(`receipt-${sale.id.slice(0, 8)}.html`, receiptHtml(business, sale, language));
}

export function printInvoice(business: BusinessProfile, invoice: Invoice, language: LanguagePreference = 'en') {
  openDocument(invoiceHtml(business, invoice, language));
}

export function downloadInvoice(business: BusinessProfile, invoice: Invoice, language: LanguagePreference = 'en') {
  downloadHtml(`${invoice.invoiceNumber}.html`, invoiceHtml(business, invoice, language));
}

export function invoiceWhatsAppUrl(invoice: Invoice, business: BusinessProfile, language: LanguagePreference = 'en') {
  if (!invoice.customerPhone) throw new Error(t(language, 'Add a phone number for this customer before sharing on WhatsApp.'));
  const locale = localeForLanguage(language);
  const message = t(
    language,
    'Hello {customer}, {business} has prepared invoice {invoice} for {amount}{due}. Thank you.',
    {
      customer: invoice.customerName,
      business: business.businessName,
      invoice: invoice.invoiceNumber,
      amount: money(invoice.total),
      due: invoice.dueDate ? `, ${t(language, 'due')} ${new Date(`${invoice.dueDate}T00:00:00`).toLocaleDateString(locale)}` : ''
    }
  );
  return whatsappUrl(invoice.customerPhone, message);
}
