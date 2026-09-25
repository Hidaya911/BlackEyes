import { useEffect, useRef, useState } from 'react';
import { FaSearch, FaMagic } from 'react-icons/fa';
import '../../style/SmartSearch.css';

interface Result { record_type: 'product' | 'customer_invoice' | 'vendor_invoice'; id: number; title: string; description: string; amount: number; status: string; date: string | null; similarity_score: number | null; tags: string[] }
interface Response { query: string; results: Result[]; searched_count: number; limit: number; matched_count?: number; has_more?: boolean; filters?: string[]; ordering?: string }
const labels = { product: 'Product', customer_invoice: 'Customer invoice', vendor_invoice: 'Vendor invoice' };
const examples = ['Cards for a new business', 'Personalized gifts for an event', 'Printed brochures and flyers'];
const money = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' });

export function SmartSearch({ isAdmin = false }: { isAdmin?: boolean }) {
  const [query, setQuery] = useState('');
  const [type, setType] = useState('all');
  const [data, setData] = useState<Response | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [tag, setTag] = useState('');
  const request = useRef<AbortController | null>(null);
  useEffect(() => () => request.current?.abort(), []);
  async function search(text = query, scope = type, append = false) {
    if (text.trim().length < 2) { setError('Enter at least two characters.'); return; }
    request.current?.abort();
    const controller = new AbortController(); request.current = controller;
    const offset = append ? data?.results.length ?? 0 : 0;
    setQuery(text); setLoading(true); setError(''); if (!append) { setData(null); setTag(''); }
    try {
      const response = await fetch(`/api/search/semantic?${new URLSearchParams({ q: text.trim(), record_type: scope, offset: String(offset) })}`, { signal: controller.signal, credentials: 'same-origin' });
      const body = await response.json();
      if (!response.ok) throw new Error(typeof body.detail === 'string' ? body.detail : 'Search could not be completed. Please retry.');
      if (!controller.signal.aborted) setData(previous => append && previous ? { ...body, results: [...previous.results, ...body.results] } : body);
    } catch (failure) {
      if (!controller.signal.aborted) setError(failure instanceof Error ? failure.message : 'Search failed. Please retry.');
    } finally { if (!controller.signal.aborted) setLoading(false); }
  }
  const tags = [...new Set(data?.results.flatMap(result => result.tags) ?? [])];
  const results = data?.results.filter(result => !tag || result.tags.includes(tag)) ?? [];
  return <div className="smart-search">
    <section className="smart-hero">
      <span className="smart-eyebrow"><FaMagic /> A LITTLE LESS SEARCHING. A LOT MORE FINDING.</span>
      <h2>Find the thought.<br /><span>Discover the record.</span></h2>
      <p>Describe what you have in mind. Explore products and past invoices by meaning, even when the words are different.</p>
      <form role="search" onSubmit={event => { event.preventDefault(); void search(); }}>
        <label className="visually-hidden" htmlFor="smart-query">Describe what you are looking for</label><FaSearch aria-hidden="true" />
        <input id="smart-query" type="search" placeholder="Try ‘print materials for a restaurant opening’" value={query} maxLength={500} onChange={event => setQuery(event.target.value)} />
        <button disabled={loading || query.trim().length < 2}>{loading ? 'Searching…' : 'Find matches →'}</button>
      </form>
      <div className="smart-examples"><span>Try an idea</span>{examples.map(example => <button key={example} disabled={loading} onClick={() => void search(example)}>{example}</button>)}</div>
    </section>
    <section className="smart-results" aria-busy={loading}>
      <div className="smart-toolbar"><div><h3>Your discoveries</h3><p aria-live="polite">{data ? `${results.length} shown of ${data.matched_count ?? data.results.length} matches · ${data.searched_count} records searched for “${data.query}”` : 'One search across your workspace'}</p>{!!data?.filters?.length && <p>Applied filters: {data.filters.join(' · ')}</p>}</div>
        <label>Search in <select value={type} onChange={event => { const next = event.target.value; setType(next); if (data || loading) void search(query, next); }}><option value="all">All records</option><option value="product">Products</option><option value="customer_invoice">Customer invoices</option>{isAdmin && <option value="vendor_invoice">Vendor invoices</option>}</select></label>
      </div>
      {tags.length > 0 && <div className="smart-tags"><span>Suggested topics</span><button aria-pressed={!tag} onClick={() => setTag('')}>All topics</button>{tags.map(topic => <button key={topic} aria-pressed={tag === topic} onClick={() => setTag(topic)}>{topic}</button>)}</div>}
      {error && <div className="smart-error" role="alert">{error} <button onClick={() => void search()}>Retry</button></div>}
      {loading ? <div className="smart-empty" role="status"><FaMagic /><h4>Finding connections…</h4><p>The first search may take longer while the local model loads.</p></div> : data && results.length ? <>
        <table className="smart-table"><caption className="visually-hidden">Search results</caption><thead><tr><th>Record</th><th>Suggested tags</th><th>Date</th><th>Amount</th><th>Match</th></tr></thead><tbody>
          {results.map(result => <tr key={`${result.record_type}-${result.id}`}>
            <td data-label="Record"><span className={`smart-kind ${result.record_type}`}>{labels[result.record_type]} · #{result.id}</span><strong>{result.title}</strong><small>{result.status.replaceAll('_', ' ')}</small><details><summary>View details</summary><p>{result.description}</p></details></td>
            <td data-label="Suggested tags"><div className="smart-row-tags">{result.tags.length ? result.tags.map(topic => <button key={topic} onClick={() => setTag(topic)}>{topic}</button>) : '—'}</div></td>
            <td data-label="Date">{result.date ? new Date(result.date.slice(0, 10) + 'T12:00:00').toLocaleDateString() : '—'}</td>
            <td data-label="Amount">{money.format(result.amount)}</td>
            <td data-label="Match">{result.similarity_score == null ? <span>Matches filters</span> : <><span className="smart-score" title="Semantic similarity, not a probability">{result.similarity_score.toFixed(2)}</span><small>similarity</small></>}</td>
          </tr>)}
        </tbody></table>
        <footer>{data.ordering === 'price_min' ? 'Only lowest-priced matches. Equal-price ties are included.' : data.ordering === 'price_max' ? 'Only highest-priced matches. Equal-price ties are included.' : data.ordering === 'date_desc' ? 'Ordered by date: newest first.' : 'Ordered by semantic similarity. Tags are automatic suggestions.'}
          {data.has_more && <button type="button" className="btn btn-outline-secondary btn-sm ms-3" disabled={loading} onClick={() => void search(data.query, type, true)}>Load more results</button>}
        </footer>
      </> : !error && <div className="smart-empty"><FaSearch /><h4>{data ? 'No close matches yet' : 'Start with an idea'}</h4><p>{data ? 'Try a different description or search across all record types.' : 'A product, a print job, an old invoice. Describe it in your own words.'}</p></div>}
    </section>
  </div>;
}
