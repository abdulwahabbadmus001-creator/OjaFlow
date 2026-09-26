import { useMemo, useState } from 'react';
import type { LanguagePreference, StoreData } from '../types';
import { money } from '../lib/format';
import { t } from '../lib/language';

type Period = 'weekly' | 'monthly' | 'yearly';

type Point = {
  label: string;
  sales: number;
  expenses: number;
  profit: number;
};

function dayKey(date: Date) {
  return date.toISOString().slice(0, 10);
}

function startOfDay(date: Date) {
  const copy = new Date(date);
  copy.setHours(0, 0, 0, 0);
  return copy;
}

function buildWeekly(data: StoreData): Point[] {
  const today = startOfDay(new Date());
  return Array.from({ length: 7 }, (_, index) => {
    const date = new Date(today);
    date.setDate(today.getDate() - (6 - index));
    const key = dayKey(date);
    const sales = data.sales
      .filter(item => item.createdAt.slice(0, 10) === key)
      .reduce((sum, item) => sum + item.total, 0);
    const expenses = data.expenses
      .filter(item => item.createdAt.slice(0, 10) === key)
      .reduce((sum, item) => sum + item.amount, 0);
    return {
      label: new Intl.DateTimeFormat('en-NG', { weekday: 'short' }).format(date),
      sales,
      expenses,
      profit: sales - expenses
    };
  });
}

function buildMonthly(data: StoreData): Point[] {
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const groups = [
    { from: 1, to: 7, label: 'Week 1' },
    { from: 8, to: 14, label: 'Week 2' },
    { from: 15, to: 21, label: 'Week 3' },
    { from: 22, to: 28, label: 'Week 4' },
    { from: 29, to: daysInMonth, label: 'Week 5' }
  ].filter(group => group.from <= daysInMonth);

  return groups.map(group => {
    const matches = (iso: string) => {
      const date = new Date(iso);
      return date.getFullYear() === year && date.getMonth() === month && date.getDate() >= group.from && date.getDate() <= group.to;
    };
    const sales = data.sales.filter(item => matches(item.createdAt)).reduce((sum, item) => sum + item.total, 0);
    const expenses = data.expenses.filter(item => matches(item.createdAt)).reduce((sum, item) => sum + item.amount, 0);
    return { label: group.label, sales, expenses, profit: sales - expenses };
  });
}

function buildYearly(data: StoreData): Point[] {
  const year = new Date().getFullYear();
  return Array.from({ length: 12 }, (_, month) => {
    const matches = (iso: string) => {
      const date = new Date(iso);
      return date.getFullYear() === year && date.getMonth() === month;
    };
    const sales = data.sales.filter(item => matches(item.createdAt)).reduce((sum, item) => sum + item.total, 0);
    const expenses = data.expenses.filter(item => matches(item.createdAt)).reduce((sum, item) => sum + item.amount, 0);
    return {
      label: new Intl.DateTimeFormat('en-NG', { month: 'short' }).format(new Date(year, month, 1)),
      sales,
      expenses,
      profit: sales - expenses
    };
  });
}

function buildSeries(data: StoreData, period: Period) {
  if (period === 'monthly') return buildMonthly(data);
  if (period === 'yearly') return buildYearly(data);
  return buildWeekly(data);
}

function points(values: number[], width: number, height: number, max: number) {
  const horizontalPadding = 24;
  const verticalPadding = 20;
  const usableWidth = width - horizontalPadding * 2;
  const usableHeight = height - verticalPadding * 2;
  return values.map((value, index) => {
    const x = horizontalPadding + (values.length === 1 ? usableWidth / 2 : (index / (values.length - 1)) * usableWidth);
    const y = verticalPadding + usableHeight - (value / max) * usableHeight;
    return `${x},${y}`;
  }).join(' ');
}

export default function BusinessTrendChart({ data, language = 'en' }: { data: StoreData; language?: LanguagePreference }) {
  const [period, setPeriod] = useState<Period>('weekly');
  const series = useMemo(() => buildSeries(data, period), [data, period]);
  const totals = useMemo(() => ({
    sales: series.reduce((sum, point) => sum + point.sales, 0),
    expenses: series.reduce((sum, point) => sum + point.expenses, 0),
    profit: series.reduce((sum, point) => sum + point.profit, 0)
  }), [series]);

  const max = Math.max(1, ...series.flatMap(point => [point.sales, point.expenses, Math.max(0, point.profit)]));
  const width = 760;
  const height = 250;
  const salesPoints = points(series.map(point => point.sales), width, height, max);
  const expensePoints = points(series.map(point => point.expenses), width, height, max);
  const profitPoints = points(series.map(point => Math.max(0, point.profit)), width, height, max);

  return (
    <article className="panel trend-panel">
      <div className="panel-head trend-head">
        <div>
          <span className="eyebrow">PERFORMANCE</span>
          <h2>{t(language, 'dashboard.chartTitle')}</h2>
          <p>{t(language, 'dashboard.chartSubtitle')}</p>
        </div>
        <div className="trend-periods" aria-label="Chart period">
          {(['weekly', 'monthly', 'yearly'] as Period[]).map(item => (
            <button key={item} className={period === item ? 'active' : ''} onClick={() => setPeriod(item)}>
              {t(language, `period.${item}` as 'period.weekly' | 'period.monthly' | 'period.yearly')}
            </button>
          ))}
        </div>
      </div>

      <div className="trend-summary">
        <div><span>{t(language, 'dashboard.sales')}</span><strong>{money(totals.sales)}</strong></div>
        <div><span>{t(language, 'dashboard.expenses')}</span><strong>{money(totals.expenses)}</strong></div>
        <div><span>{t(language, 'dashboard.profit')}</span><strong>{money(totals.profit)}</strong></div>
      </div>

      <div className="trend-chart-wrap">
        <svg className="trend-chart" viewBox={`0 0 ${width} ${height}`} role="img" aria-label="Sales, expenses and profit chart">
          {[0.25, 0.5, 0.75, 1].map(level => (
            <line key={level} x1="24" x2={width - 24} y1={20 + (height - 40) * (1 - level)} y2={20 + (height - 40) * (1 - level)} className="chart-grid-line" />
          ))}
          <polyline points={salesPoints} className="chart-line sales-line" />
          <polyline points={expensePoints} className="chart-line expense-line" />
          <polyline points={profitPoints} className="chart-line profit-line" />
          {series.map((point, index) => {
            const x = 24 + (series.length === 1 ? (width - 48) / 2 : (index / (series.length - 1)) * (width - 48));
            return <text key={point.label} x={x} y={height - 2} textAnchor="middle" className="chart-label">{point.label}</text>;
          })}
        </svg>
      </div>

      <div className="trend-legend">
        <span><i className="legend-dot sales-dot" /> {t(language, 'dashboard.sales')}</span>
        <span><i className="legend-dot expense-dot" /> {t(language, 'dashboard.expenses')}</span>
        <span><i className="legend-dot profit-dot" /> {t(language, 'dashboard.profit')}</span>
      </div>
    </article>
  );
}