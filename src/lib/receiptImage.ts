import type { BusinessProfile, Debt, Sale } from '../types';
import { money } from './format';

function drawRoundedRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  radius: number
) {
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.lineTo(x + width - radius, y);
  ctx.quadraticCurveTo(x + width, y, x + width, y + radius);
  ctx.lineTo(x + width, y + height - radius);
  ctx.quadraticCurveTo(x + width, y + height, x + width - radius, y + height);
  ctx.lineTo(x + radius, y + height);
  ctx.quadraticCurveTo(x, y + height, x, y + height - radius);
  ctx.lineTo(x, y + radius);
  ctx.quadraticCurveTo(x, y, x + radius, y);
  ctx.closePath();
}

async function shareOrDownloadCanvas(
  canvas: HTMLCanvasElement,
  filename: string,
  title: string,
  text: string
): Promise<void> {
  const blob = await new Promise<Blob | null>(resolve =>
    canvas.toBlob(b => resolve(b), 'image/png', 1.0)
  );
  if (!blob) return;

  const file = new File([blob], filename, { type: 'image/png' });
  const nav = navigator as Navigator & {
    canShare?: (data?: ShareData) => boolean;
  };

  if (typeof nav.share === 'function' && nav.canShare?.({ files: [file] })) {
    try {
      await nav.share({
        title,
        text,
        files: [file]
      });
      return;
    } catch {
      /* user cancelled or share failed; fall back to download */
    }
  }

  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  window.setTimeout(() => URL.revokeObjectURL(url), 4000);
}

export async function shareOrDownloadSaleReceiptImage(
  business: BusinessProfile,
  sale: Sale
): Promise<void> {
  const canvas = document.createElement('canvas');
  canvas.width = 800;
  canvas.height = 980;
  const ctx = canvas.getContext('2d');
  if (!ctx) return;

  // Outer background
  ctx.fillStyle = '#042f24';
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  // Inner receipt card
  drawRoundedRect(ctx, 40, 40, 720, 900, 28);
  ctx.fillStyle = '#ffffff';
  ctx.fill();

  // Top Royal Emerald Header
  drawRoundedRect(ctx, 40, 40, 720, 210, 28);
  ctx.fillStyle = '#065f46';
  ctx.fill();

  // Gold accent bar
  ctx.fillStyle = '#d4af37';
  ctx.fillRect(40, 244, 720, 6);

  // Brand badge & title
  ctx.fillStyle = '#d4af37';
  ctx.font = 'bold 20px Inter, system-ui, sans-serif';
  ctx.fillText('OFFICIAL PAYMENT RECEIPT', 84, 96);

  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 38px Inter, system-ui, sans-serif';
  ctx.fillText(business.businessName.slice(0, 32), 84, 150);

  ctx.fillStyle = '#d1fae5';
  ctx.font = '500 20px Inter, system-ui, sans-serif';
  ctx.fillText(
    `${business.category}  •  Tel: ${business.phone || 'N/A'}`,
    84,
    195
  );

  const refCode = `RCPT-${sale.id.slice(0, 8).toUpperCase()}`;
  const dateStr = new Date(sale.createdAt).toLocaleDateString('en-NG', {
    day: 'numeric',
    month: 'short',
    year: 'numeric'
  });

  // Metadata rows
  const drawRow = (label: string, value: string, y: number, bold = false) => {
    ctx.fillStyle = '#64748b';
    ctx.font = '600 21px Inter, system-ui, sans-serif';
    ctx.fillText(label, 84, y);

    ctx.fillStyle = '#0f172a';
    ctx.font = `${bold ? 'bold' : '600'} 22px Inter, system-ui, sans-serif`;
    ctx.textAlign = 'right';
    ctx.fillText(value, 716, y);
    ctx.textAlign = 'left';
  };

  drawRow('Receipt Reference', refCode, 315, true);
  drawRow('Date Issued', dateStr, 365);
  drawRow('Customer', sale.customer || 'Walk-in Customer', 415);
  drawRow('Payment Method', sale.paymentMethod.toUpperCase(), 465, true);

  // Divider
  ctx.strokeStyle = '#e2e8f0';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(84, 505);
  ctx.lineTo(716, 505);
  ctx.stroke();

  // Item breakdown box
  drawRoundedRect(ctx, 76, 535, 648, 155, 18);
  ctx.fillStyle = '#f8fafc';
  ctx.fill();

  ctx.fillStyle = '#475569';
  ctx.font = 'bold 18px Inter, system-ui, sans-serif';
  ctx.fillText('ITEM DESCRIPTION', 104, 575);

  ctx.fillStyle = '#0f172a';
  ctx.font = 'bold 28px Inter, system-ui, sans-serif';
  ctx.fillText(sale.itemName.slice(0, 36), 104, 620);

  ctx.fillStyle = '#475569';
  ctx.font = '600 21px Inter, system-ui, sans-serif';
  ctx.fillText(
    `Quantity: ${sale.quantity}   ×   Unit Price: ${money(sale.unitPrice)}`,
    104,
    662
  );

  // Total Paid highlight box
  drawRoundedRect(ctx, 76, 720, 648, 115, 18);
  ctx.fillStyle = '#ecfdf5';
  ctx.fill();

  ctx.fillStyle = '#065f46';
  ctx.font = 'bold 22px Inter, system-ui, sans-serif';
  ctx.fillText('TOTAL AMOUNT PAID', 106, 786);

  ctx.fillStyle = '#064e3b';
  ctx.font = 'bold 38px Inter, system-ui, sans-serif';
  ctx.textAlign = 'right';
  ctx.fillText(money(sale.total), 694, 790);
  ctx.textAlign = 'left';

  // Footer
  ctx.fillStyle = '#64748b';
  ctx.font = '600 18px Inter, system-ui, sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText(
    `Thank you for patronizing ${business.businessName} • Powered by OjaFlow`,
    400,
    895
  );
  ctx.textAlign = 'left';

  await shareOrDownloadCanvas(
    canvas,
    `${refCode}.png`,
    `${business.businessName} Receipt (${refCode})`,
    `Receipt ${refCode} from ${business.businessName}: ${sale.quantity} × ${sale.itemName} = ${money(sale.total)}`
  );
}

export async function shareOrDownloadDebtReminderImage(
  business: BusinessProfile,
  debt: Debt
): Promise<void> {
  const remaining = Math.max(0, debt.amount - debt.paid);
  const canvas = document.createElement('canvas');
  canvas.width = 800;
  canvas.height = 920;
  const ctx = canvas.getContext('2d');
  if (!ctx) return;

  ctx.fillStyle = '#1f2937';
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  drawRoundedRect(ctx, 40, 40, 720, 840, 28);
  ctx.fillStyle = '#ffffff';
  ctx.fill();

  drawRoundedRect(ctx, 40, 40, 720, 200, 28);
  ctx.fillStyle = '#7c2d12';
  ctx.fill();

  ctx.fillStyle = '#f59e0b';
  ctx.fillRect(40, 234, 720, 6);

  ctx.fillStyle = '#fde68a';
  ctx.font = 'bold 20px Inter, system-ui, sans-serif';
  ctx.fillText('FRIENDLY BALANCE REMINDER', 84, 94);

  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 36px Inter, system-ui, sans-serif';
  ctx.fillText(business.businessName.slice(0, 32), 84, 146);

  ctx.fillStyle = '#fed7aa';
  ctx.font = '500 20px Inter, system-ui, sans-serif';
  ctx.fillText(`Tel: ${business.phone || 'N/A'}`, 84, 188);

  const drawRow = (label: string, value: string, y: number, bold = false) => {
    ctx.fillStyle = '#64748b';
    ctx.font = '600 21px Inter, system-ui, sans-serif';
    ctx.fillText(label, 84, y);

    ctx.fillStyle = '#0f172a';
    ctx.font = `${bold ? 'bold' : '600'} 22px Inter, system-ui, sans-serif`;
    ctx.textAlign = 'right';
    ctx.fillText(value, 716, y);
    ctx.textAlign = 'left';
  };

  drawRow('Customer Name', debt.name, 315, true);
  drawRow('Total Credit Amount', money(debt.amount), 375);
  drawRow('Amount Paid So Far', money(debt.paid), 435);
  drawRow(
    'Due Date',
    debt.dueDate
      ? new Date(debt.dueDate).toLocaleDateString('en-NG')
      : 'Upon Request',
    495
  );

  drawRoundedRect(ctx, 76, 555, 648, 130, 18);
  ctx.fillStyle = '#fffbeb';
  ctx.fill();

  ctx.fillStyle = '#92400e';
  ctx.font = 'bold 22px Inter, system-ui, sans-serif';
  ctx.fillText('OUTSTANDING BALANCE DUE', 106, 630);

  ctx.fillStyle = '#b45309';
  ctx.font = 'bold 38px Inter, system-ui, sans-serif';
  ctx.textAlign = 'right';
  ctx.fillText(money(remaining), 694, 634);
  ctx.textAlign = 'left';

  ctx.fillStyle = '#64748b';
  ctx.font = '600 18px Inter, system-ui, sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText(
    `Kindly settle at your earliest convenience • ${business.businessName}`,
    400,
    830
  );
  ctx.textAlign = 'left';

  const safeSlug = debt.name.replace(/[^a-zA-Z0-9]/g, '-').slice(0, 16);
  await shareOrDownloadCanvas(
    canvas,
    `Balance-Reminder-${safeSlug}.png`,
    `Balance Reminder from ${business.businessName}`,
    `Hello ${debt.name}, this is a friendly reminder of your outstanding balance of ${money(remaining)} with ${business.businessName}.`
  );
}

