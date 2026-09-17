import type { ReactNode } from 'react';
import type { PaymentMethod } from '../../api/vendorLedger';

export { money } from '../../utils/vendorMoney';

export const today = () => {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
};

export const paymentMethods: { value: PaymentMethod; label: string }[] = [
  { value: 'cash', label: 'Cash' },
  { value: 'bank_transfer', label: 'Bank transfer' },
  { value: 'whish_money', label: 'Whish Money' },
  { value: 'other', label: 'Other' },
];

export function LedgerField({ label, children, wide = false }: {
  label: string;
  children: ReactNode;
  wide?: boolean;
}) {
  return (
    <label className={wide ? 'ledger-field ledger-field-wide' : 'ledger-field'}>
      <span>{label}</span>
      {children}
    </label>
  );
}

export function MethodSelect({ value, onChange }: {
  value: PaymentMethod;
  onChange: (method: PaymentMethod) => void;
}) {
  return (
    <select className="form-select" value={value} onChange={event => onChange(event.target.value as PaymentMethod)}>
      {paymentMethods.map(method => (
        <option key={method.value} value={method.value}>{method.label}</option>
      ))}
    </select>
  );
}
