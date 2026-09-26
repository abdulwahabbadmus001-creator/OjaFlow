import { useState } from 'react';
import { Package, Plus, Search, TriangleAlert } from 'lucide-react';
import type { Product, StoreData } from '../types';
import { money, todayISO, uid } from '../lib/format';
import Modal from '../components/Modal';
import { useI18n } from '../lib/i18n';

export default function InventoryPage({
  data,
  addProduct
}: {
  data: StoreData;
  addProduct: (product: Product) => void;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const { tr } = useI18n();

  const filtered = data.products.filter(product =>
    (product.name + product.category).toLowerCase().includes(query.toLowerCase())
  );

  return (
    <>
      <header className="page-head">
        <div>
          <span className="eyebrow">{tr('STOCK CONTROL')}</span>
          <h1>{tr('Inventory')}</h1>
          <p>{tr('Know what you have, what it is worth and what needs restocking.')}</p>
        </div>
        <button className="primary-btn" onClick={() => setOpen(true)}>
          <Plus size={18} /> {tr('Add product')}
        </button>
      </header>

      <section className="mini-stat-row">
        <div><Package /><span><small>{tr('Products')}</small><strong>{data.products.length}</strong></span></div>
        <div><TriangleAlert /><span><small>{tr('Low stock')}</small><strong>{data.products.filter(product => product.stock <= product.reorderLevel).length}</strong></span></div>
        <div><span><small>{tr('Retail stock value')}</small><strong>{money(data.products.reduce((total, product) => total + product.sellingPrice * product.stock, 0))}</strong></span></div>
      </section>

      <div className="panel">
        <div className="table-toolbar">
          <div className="search">
            <Search size={18} />
            <input placeholder={tr('Search inventory')} value={query} onChange={event => setQuery(event.target.value)} />
          </div>
        </div>

        <div className="data-table inventory">
          <div className="table-head">
            <span>{tr('Product')}</span>
            <span>{tr('Stock')}</span>
            <span>{tr('Cost')}</span>
            <span>{tr('Sell')}</span>
            <span className="right">{tr('Margin/unit')}</span>
          </div>
          {filtered.map(product => (
            <div className="table-row" key={product.id}>
              <span><strong>{product.name}</strong><small>{product.category}</small></span>
              <span><span className={product.stock <= product.reorderLevel ? 'status-badge amber' : 'status-badge'}>{product.stock} {tr('units')}</span></span>
              <span>{money(product.costPrice)}</span>
              <span>{money(product.sellingPrice)}</span>
              <strong className="right positive">{money(product.sellingPrice - product.costPrice)}</strong>
            </div>
          ))}
        </div>
      </div>

      {open && (
        <Modal title={tr('Add product')} onClose={() => setOpen(false)}>
          <form
            className="form-stack"
            onSubmit={event => {
              event.preventDefault();
              const form = new FormData(event.currentTarget);
              addProduct({
                id: uid(),
                name: String(form.get('name')),
                category: String(form.get('category')),
                costPrice: Number(form.get('costPrice')),
                sellingPrice: Number(form.get('sellingPrice')),
                stock: Number(form.get('stock')),
                reorderLevel: Number(form.get('reorderLevel')),
                createdAt: todayISO()
              });
              setOpen(false);
            }}
          >
            <label>{tr('Product name')}<input name="name" required /></label>
            <label>{tr('Category')}<input name="category" required /></label>
            <div className="two-col">
              <label>{tr('Cost price')}<input name="costPrice" type="number" min="0" required /></label>
              <label>{tr('Selling price')}<input name="sellingPrice" type="number" min="0" required /></label>
            </div>
            <div className="two-col">
              <label>{tr('Current stock')}<input name="stock" type="number" min="0" required /></label>
              <label>{tr('Low-stock level')}<input name="reorderLevel" type="number" min="0" defaultValue="5" required /></label>
            </div>
            <button className="primary-btn full">{tr('Save product')}</button>
          </form>
        </Modal>
      )}
    </>
  );
}
