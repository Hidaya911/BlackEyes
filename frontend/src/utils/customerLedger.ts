import type { CustomerStatement } from '../api/customerLedger';

export const ledgerDate = (value: string) => new Date(value).toLocaleString('en-GB', {
  day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit', timeZone: 'UTC',
});
export const paymentLabel = (value: string | null) => value === 'cash' ? 'Cash' : value === 'whish_money' ? 'Whish Money' : value || '—';

export function exportStatement(statement: CustomerStatement) {
  const rows = [
    ['Customer', statement.customer.name, 'Type', statement.customer.kind],
    ['Generated (UTC)', statement.generated_at],
    ['Date (UTC)', 'Order', 'Entry', 'Charge USD', 'Payment USD', 'Balance USD', 'Method', 'Reference', 'Recorded by', 'Note'],
    ...statement.entries.map(entry => [entry.date, entry.order_id, entry.description,
      (entry.charge / 100).toFixed(2), (entry.payment / 100).toFixed(2), (entry.balance / 100).toFixed(2),
      paymentLabel(entry.method), entry.reference || '', entry.recorded_by || '', entry.note || '']),
  ];
  const csv = rows.map(row => row.map(value => {
    const text = String(value);
    return `"${(/^[=+@\-\t\r]/.test(text) ? "'" : '') + text.replace(/"/g, '""')}"`;
  }).join(',')).join('\r\n');
  const url = URL.createObjectURL(new Blob(['\uFEFF', csv], { type: 'text/csv;charset=utf-8' }));
  const link = document.createElement('a'); link.href = url;
  link.download = `customer-statement-${statement.customer.kind}-${statement.customer.id}.csv`;
  link.click(); window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}
