import { useEffect, useState } from 'react';
import { adminRequest } from '../../api/admin';

export function StockAlerts({ section, onManage }: { section: string; onManage: () => void }) {
  const [items, setItems] = useState<{ item_id: number; name: string; quantity: number; unit: string }[]>([]);
  const [error, setError] = useState('');
  useEffect(() => {
    let active = true;
    const refresh = async () => {
      try {
        const result = await adminRequest<typeof items>('/inventory/alerts');
        if (active) { setItems(result); setError(''); }
      } catch { if (active) setError('Stock alerts could not be refreshed.'); }
    };
    void refresh();
    const timer = window.setInterval(refresh, 30000);
    window.addEventListener('focus', refresh);
    return () => { active = false; window.clearInterval(timer); window.removeEventListener('focus', refresh); };
  }, [section]);
  if (error) return <div className="alert alert-warning" role="status">{error}</div>;
  if (!items.length) return null;
  return <div className="alert alert-warning d-flex flex-wrap align-items-center gap-2" role="status"><strong>Low stock:</strong><span>{items.map(i => `${i.name}: ${i.quantity} ${i.unit}`).join(' · ')}</span><button className="btn btn-sm btn-outline-dark ms-auto" onClick={onManage}>View inventory</button></div>;
}
