// Keep arithmetic in integer cents, including fractional material quantities.
function scaled(value: string, places: number): bigint {
  const normalized = value.trim() || '0';
  if (!/^-?\d*(\.\d*)?$/.test(normalized)) return 0n;
  const negative = normalized.startsWith('-');
  const [whole, fraction = ''] = normalized.replace('-', '').split('.');
  const result = BigInt(whole || '0') * (10n ** BigInt(places))
    + BigInt(fraction.padEnd(places, '0').slice(0, places) || '0');
  return negative ? -result : result;
}

export const cents = (value: string) => scaled(value, 2);

export function purchaseTotalCents(quantity: string, unitPrice: string): bigint {
  // Quantity has 3 decimals and per-unit rates have 6; round the final amount to cents.
  return (scaled(quantity, 3) * scaled(unitPrice, 6) + 5_000_000n) / 10_000_000n;
}

export function formatCents(value: bigint): string {
  const absolute = value < 0n ? -value : value;
  const dollars = (absolute / 100n).toLocaleString('en-US');
  const fraction = String(absolute % 100n).padStart(2, '0');
  return `${value < 0n ? '-' : ''}$${dollars}.${fraction}`;
}

export const money = (value: string) => formatCents(cents(value));
export const unitPriceMoney = (value: string) => new Intl.NumberFormat('en-US', {
  style: 'currency', currency: 'USD', minimumFractionDigits: 2, maximumFractionDigits: 6,
}).format(Number(value));
