import { useMemo, useState } from 'react';
import {
  CircleAlert,
  Package,
  Plus,
  Search,
  TriangleAlert
} from 'lucide-react';
import type { Product, StoreData } from '../types';
import { money, todayISO, uid } from '../lib/format';
import Modal from '../components/Modal';

export default function InventoryPage({
  data,
  addProduct
}: {
  data: StoreData;
  addProduct: (product: Product) => void;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');

  const filtered = useMemo(
    () =>
      data.products.filter(product =>
        `${product.name} ${product.category}`
          .toLowerCase()
          .includes(query.toLowerCase())
      ),
    [data.products, query]
  );

  const lowStock = data.products.filter(
    product =>
      product.stock > 0 &&
      product.stock <= product.reorderLevel
  );

  const outOfStock = data.products.filter(
    product => product.stock <= 0
  );

  const attentionCount =
    lowStock.length + outOfStock.length;

  const retailValue = data.products.reduce(
    (total, product) =>
      total + product.sellingPrice * product.stock,
    0
  );

  return (
    <>
      <header className="page-head">
        <div>
          <span className="eyebrow">STOCK CONTROL</span>

          <h1>Inventory</h1>

          <p>
            Know what you have, what it is worth and what needs
            restocking.
          </p>
        </div>

        <button
          type="button"
          className="primary-btn"
          onClick={() => setOpen(true)}
        >
          <Plus size={18} />
          Add product
        </button>
      </header>

      {attentionCount > 0 && (
        <section className="panel attention-panel">
          <div className="panel-head">
            <div>
              <span className="eyebrow">
                INVENTORY ALERT
              </span>

              <h2>
                {attentionCount} product
                {attentionCount === 1 ? '' : 's'} need
                attention
              </h2>

              <p>
                {outOfStock.length > 0 &&
                  `${outOfStock.length} out of stock. `}
                {lowStock.length > 0 &&
                  `${lowStock.length} at or below their reorder level.`}
              </p>
            </div>

            <CircleAlert size={24} />
          </div>
        </section>
      )}

      <section className="mini-stat-row">
        <div>
          <Package />

          <span>
            <small>Products</small>
            <strong>{data.products.length}</strong>
          </span>
        </div>

        <div>
          <TriangleAlert />

          <span>
            <small>Low stock</small>
            <strong>{lowStock.length}</strong>
          </span>
        </div>

        <div>
          <CircleAlert />

          <span>
            <small>Out of stock</small>
            <strong>{outOfStock.length}</strong>
          </span>
        </div>

        <div>
          <span>
            <small>Retail stock value</small>
            <strong>{money(retailValue)}</strong>
          </span>
        </div>
      </section>

      <div className="panel">
        <div className="table-toolbar">
          <div className="search">
            <Search size={18} />

            <input
              placeholder="Search inventory"
              value={query}
              onChange={event =>
                setQuery(event.target.value)
              }
            />
          </div>
        </div>

        <div className="data-table inventory">
          <div className="table-head">
            <span>Product</span>
            <span>Stock</span>
            <span>Cost</span>
            <span>Sell</span>
            <span className="right">Margin/unit</span>
          </div>

          {filtered.map(product => {
            const isOut = product.stock <= 0;

            const isLow =
              !isOut &&
              product.stock <= product.reorderLevel;

            return (
              <div
                className="table-row"
                key={product.id}
              >
                <span>
                  <strong>{product.name}</strong>
                  <small>{product.category}</small>
                </span>

                <span>
                  {isOut ? (
                    <span className="status-badge amber">
                      Out of stock
                    </span>
                  ) : isLow ? (
                    <span className="status-badge amber">
                      Low stock · {product.stock}
                    </span>
                  ) : (
                    <span className="status-badge">
                      {product.stock} units
                    </span>
                  )}
                </span>

                <span>{money(product.costPrice)}</span>

                <span>{money(product.sellingPrice)}</span>

                <strong className="right positive">
                  {money(
                    product.sellingPrice -
                      product.costPrice
                  )}
                </strong>
              </div>
            );
          })}

          {!filtered.length && (
            <div className="empty-state">
              No inventory products match your search.
            </div>
          )}
        </div>
      </div>

      {open && (
        <Modal
          title="Add product"
          onClose={() => setOpen(false)}
        >
          <form
            className="form-stack"
            onSubmit={event => {
              event.preventDefault();

              const form = new FormData(
                event.currentTarget
              );

              addProduct({
                id: uid(),
                name: String(form.get('name') || '').trim(),
                category: String(
                  form.get('category') || ''
                ).trim(),
                costPrice: Number(
                  form.get('costPrice') || 0
                ),
                sellingPrice: Number(
                  form.get('sellingPrice') || 0
                ),
                stock: Number(form.get('stock') || 0),
                reorderLevel: Number(
                  form.get('reorderLevel') || 0
                ),
                createdAt: todayISO()
              });

              setOpen(false);
            }}
          >
            <label>
              Product name
              <input name="name" required />
            </label>

            <label>
              Category
              <input name="category" required />
            </label>

            <div className="two-col">
              <label>
                Cost price
                <input
                  name="costPrice"
                  type="number"
                  min="0"
                  step="0.01"
                  required
                />
              </label>

              <label>
                Selling price
                <input
                  name="sellingPrice"
                  type="number"
                  min="0"
                  step="0.01"
                  required
                />
              </label>
            </div>

            <div className="two-col">
              <label>
                Current stock
                <input
                  name="stock"
                  type="number"
                  min="0"
                  required
                />
              </label>

              <label>
                Low-stock level
                <input
                  name="reorderLevel"
                  type="number"
                  min="0"
                  defaultValue="5"
                  required
                />
              </label>
            </div>

            <button className="primary-btn full">
              Save product
            </button>
          </form>
        </Modal>
      )}
    </>
  );
}