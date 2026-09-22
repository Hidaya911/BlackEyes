import { useEffect, useRef, useState, type FormEvent } from "react";
import { Modal } from "react-bootstrap";
import { FaDownload, FaReceipt, FaSyncAlt } from "react-icons/fa";
import { customerMoney } from "../../api/customer";
import type { PressOrder } from "../../api/press";
import "../../style/OrderManager.css";
import { DocumentPreview } from './documents/DocumentPreview';
import { OrderDesignSummary } from '../shared/OrderDesignSummary';
import { ProductionBoard } from './production/ProductionBoard';
import { OrderFilters } from './OrderFilters';
import { emptyOrderFilters, filterOrders, orderDate } from '../../utils/orderFilters';

async function request<T>(path = "", options?: RequestInit): Promise<T> {
  const response = await fetch(`/api/press/orders${path}`, options);
  if (!response.ok) {
    const body = await response.json().catch(() => ({}));
    throw new Error(
      typeof body.detail === "string"
        ? body.detail
        : "Unable to load or update orders.",
    );
  }
  return response.json();
}

function ReviewOrder({
  order,
  onClose,
  onSaved,
}: {
  order: PressOrder;
  onClose: () => void;
  onSaved: (order: PressOrder) => void;
}) {
  const [stage, setStage] = useState(order.production_stage);
  const [approve, setApprove] = useState(false);
  const [confirm, setConfirm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (saving) return;
    setSaving(true);
    setError("");
    try {
      onSaved(
        await request<PressOrder>(`/${order.order_id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            production_stage: stage,
            approve_artwork: approve,
            confirm_payment: confirm,
            expected_stage: order.production_stage,
          }),
        }),
      );
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : "Unable to save.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal
      show
      centered
      size="xl"
      scrollable
      dialogClassName="press-review-dialog"
      contentClassName="press-review-modal"
      onHide={() => !saving && onClose()}
      backdrop={saving ? "static" : true}
      keyboard={!saving}
      aria-labelledby="press-order-title"
    >
      <Modal.Header closeButton={!saving}>
        <div>
          <span className="press-review-eyebrow">ORDER REVIEW</span>
          <Modal.Title id="press-order-title">
            Review order #{order.order_id}
          </Modal.Title>
          <p className="press-review-subtitle">
            Check the details and update production.
          </p>
        </div>
      </Modal.Header>
      <form
        className="press-review-form"
        onSubmit={(event) => void save(event)}
      >
        <Modal.Body>
          <div className="press-review-grid">
            <div className="press-review-column">
              <section
                className="press-review-section"
                aria-labelledby="press-customer-heading"
              >
                <h3 id="press-customer-heading">Customer details</h3>
                <p className="press-review-customer">{order.customer_name}</p>
                <div className="press-review-contact">
                  {order.customer_email && <span>{order.customer_email}</span>}
                  <span>{order.contact_phone}</span>
                  {order.customer_address && (
                    <span>{order.customer_address}</span>
                  )}
                </div>
              </section>
              <section
                className="press-review-section"
                aria-labelledby="press-items-heading"
              >
                <h3 id="press-items-heading">
                  Order items <span>{order.items.length}</span>
                </h3>
                <ul className="press-order-items">
                  {order.items.map((item) => (
                    <li key={item.order_item_id}>
                      <strong>
                        {item.quantity} × {item.name}
                      </strong>
                      <span>{customerMoney(item.subtotal)}</span>
                      <small>{item.specifications}</small>
                    </li>
                  ))}
                </ul>
              </section>
              <section
                className="press-review-section"
                aria-labelledby="press-artwork-heading"
              >
                <h3 id="press-artwork-heading">Design &amp; artwork</h3>
                <OrderDesignSummary order={order} audience="press" />
                <p className="press-design-note">
                  {order.design_request_note || (order.items.some(item => item.designs?.length) ? '' : "See attached artwork.")}
                </p>
                {order.files.filter(file => !file.design_id).map((file) => (
                  <a
                    className="press-file-link"
                    key={file.file_id}
                    href={`/api/press/orders/${order.order_id}/files/${file.file_id}`}
                  >
                    <FaDownload />
                    <span className="press-file-name">{file.name}</span>
                    <small>{file.verification_status}</small>
                  </a>
                ))}
                {!order.files.length && (
                  <p className="press-review-hint">
                    No artwork files attached.
                  </p>
                )}
              </section>
            </div>
            <div className="press-review-column">
              <section
                className="press-review-section"
                aria-labelledby="press-payment-heading"
              >
                <h3 id="press-payment-heading">Payment summary</h3>
                <div className="press-payment-summary">
                  <span>Order total</span>
                  <strong>{customerMoney(order.total)}</strong>
                  <span>
                    {order.payment_method === "cash"
                      ? "Cash at the press"
                      : "Whish Money"}{" "}
                    ·{" "}
                    {order.payment_timing === "on_order"
                      ? "Pay when ordering"
                      : "Pay after collection"}
                  </span>
                  <small>
                    {order.payment_status.replaceAll("_", " ")}
                    {order.payment_reference
                      ? ` · Reference: ${order.payment_reference}`
                      : ""}
                  </small>
                </div>
              </section>
              <p className="press-review-hint">
                Received: {customerMoney(order.amount_paid)} · Balance due:{" "}
                {customerMoney(order.amount_due)}
              </p>
              <fieldset
                className="press-review-section press-review-controls"
                disabled={saving}
              >
                <legend>Review &amp; production</legend>
                {!!order.files.some(
                  (file) => file.verification_status !== "verified",
                ) && (
                  <label className="press-review-check">
                    <input
                      type="checkbox"
                      checked={approve}
                      onChange={(event) => setApprove(event.target.checked)}
                    />
                    <span>
                      <strong>Approve artwork</strong>
                      <small>
                        I reviewed the attached artwork and approve it for
                        production.
                      </small>
                    </span>
                  </label>
                )}
                {order.payment_status !== "paid" && (
                  <label className="press-review-check">
                    <input
                      type="checkbox"
                      checked={confirm}
                      onChange={(event) => setConfirm(event.target.checked)}
                    />
                    <span>
                      <strong>Confirm payment</strong>
                      <small>I confirm the full payment was received.</small>
                    </span>
                  </label>
                )}
                <label className="d-block">
                  Production stage
                  <select
                    className="form-select mt-2"
                    value={stage}
                    onChange={(event) => setStage(event.target.value)}
                  >
                    {[
                      "Awaiting review",
                      "Queued",
                      "In Prepress",
                      "Printing",
                      "Finishing",
                      "Ready for Pickup",
                    ].map((value) => (
                      <option key={value}>{value}</option>
                    ))}
                  </select>
                </label>
                <small className="d-block text-secondary mt-2">
                  For design-brief orders, prepare and review the design before
                  moving into production. Payment may be collected after pickup.
                </small>
              </fieldset>
            </div>
          </div>
          {error && (
            <div className="alert alert-danger mt-3" role="alert">
              {error}
            </div>
          )}
        </Modal.Body>
        <Modal.Footer>
          <button
            type="button"
            className="btn btn-light"
            disabled={saving}
            onClick={onClose}
          >
            Cancel
          </button>
          <button type="submit" className="btn btn-dark" disabled={saving}>
            {saving ? "Saving…" : "Save order review"}
          </button>
        </Modal.Footer>
      </form>
    </Modal>
  );
}

export function OrderManager({ onCreate }: { onCreate?: () => void }) {
  const [document, setDocument] = useState<{ id: number; kind: 'invoice' | 'receipt' } | null>(null);
  const [orders, setOrders] = useState<PressOrder[]>([]);
  const [selected, setSelected] = useState<PressOrder | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [reload, setReload] = useState(0);
  const [query, setQuery] = useState("");
  const [filters, setFilters] = useState(emptyOrderFilters);
  const [view, setView] = useState<'board' | 'review'>('board');
  const [moving, setMoving] = useState(false);
  const moveLock = useRef(false);
  const [moveError, setMoveError] = useState('');
  const [notice, setNotice] = useState('');

  async function moveOrder(order: PressOrder, stage: string) {
    if (moveLock.current || stage === order.production_stage) return;
    moveLock.current = true; setMoving(true); setMoveError(''); setNotice('');
    try {
      const saved = await request<PressOrder>(`/${order.order_id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ production_stage: stage, expected_stage: order.production_stage }) });
      setOrders(current => current.map(row => row.order_id === saved.order_id ? saved : row));
      setNotice(`Order #${saved.order_id} moved to ${saved.production_stage}.`);
    } catch (failure) {
      setMoveError(failure instanceof Error ? failure.message : 'Unable to move order.');
      setReload(value => value + 1);
    } finally { moveLock.current = false; setMoving(false); }
  }

  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    setError("");
    request<PressOrder[]>("", { signal: controller.signal })
      .then(setOrders)
      .catch((failure: Error) => {
        if (!controller.signal.aborted) setError(failure.message);
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, [reload]);

  const visible = filterOrders(orders, query, filters);
  return (
    <section className="press-orders">
      <header>
        <div>
          <small>THE PRINT QUEUE</small>
          <h2>Orders, ready for your attention.</h2>
          <p>
            Review artwork, follow production, and confirm received payments.
          </p>
        </div>
        <div className="d-flex flex-wrap gap-2">
          {onCreate && (
            <button className="btn btn-light" onClick={onCreate}>
              + New walk-in order
            </button>
          )}
          <button
            className="btn btn-outline-light"
            disabled={loading || moving}
            onClick={() => setReload((value) => value + 1)}
          >
            <FaSyncAlt className="me-2" />
            Refresh
          </button>
        </div>
      </header>
      <div className="production-view-switch" aria-label="Order views"><button aria-pressed={view === 'board'} onClick={() => setView('board')}>Production board</button><button aria-pressed={view === 'review'} onClick={() => setView('review')}>Order review</button></div>
      {moveError && <div className="alert alert-danger" role="alert">{moveError}</div>}
      {notice && <div className="alert alert-success" role="status">{notice}</div>}
      <input
        className="form-control mb-4"
        type="search"
        placeholder="Search customer, email, phone, or order number…"
        aria-label="Search orders"
        value={query}
        onChange={(event) => setQuery(event.target.value)}
      />
      <OrderFilters value={filters} onChange={setFilters} onReset={() => { setFilters(emptyOrderFilters); setQuery(''); }} count={visible.length} total={orders.length} loading={loading} />
      {error && (
        <div className="alert alert-danger" role="alert">
          {error}
        </div>
      )}
      {loading ? (
        <p role="status">Loading orders…</p>
      ) : view === 'board' ? (
        <ProductionBoard orders={visible} busy={moving} onReview={setSelected} onMove={(order, stage) => void moveOrder(order, stage)} />
      ) : (
        <div className="press-orders-grid">
          {visible.map((order) => (
            <article key={order.order_id}>
              <div className="press-order-card-header">
                <FaReceipt />
                <span>ORDER #{order.order_id}</span>
                <b>{customerMoney(order.total)}</b>
              </div>
              <h3>{order.customer_name}</h3>
              <time className="order-review-date" dateTime={order.created_at}>{orderDate(order.created_at).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' })}</time>
              <p>
                {order.items
                  .map((item) => `${item.quantity} × ${item.name}`)
                  .join(", ")}
              </p>
              <div className="press-order-labels">
                <span>
                  {order.order_type === "walk_in" ? "Walk-in" : "Online"}
                </span>
                <span>{order.production_stage}</span>
                <span>{order.payment_status.replaceAll("_", " ")}</span>
              </div>
              <button
                className="btn btn-dark"
                onClick={() => setSelected(order)}
              >
                Review order
              </button>
              <div className="order-document-actions"><button onClick={() => setDocument({ id: order.order_id, kind: 'invoice' })}>Invoice</button><button disabled={order.amount_paid <= 0} title={order.amount_paid <= 0 ? 'Verify a received payment to enable receipts' : 'View receipt'} onClick={() => setDocument({ id: order.order_id, kind: 'receipt' })}>Receipt</button></div>
            </article>
          ))}
        </div>
      )}
      {!loading && !error && !visible.length && (
        <p className="text-secondary">No orders match. Try changing the search or clearing the filters.</p>
      )}
      {document && <DocumentPreview key={`${document.id}-${document.kind}`} orderId={document.id} kind={document.kind} onClose={() => setDocument(null)} />}
      {selected && (
        <ReviewOrder
          order={selected}
          onClose={() => setSelected(null)}
          onSaved={(saved) => {
            setOrders((current) =>
              current.map((order) =>
                order.order_id === saved.order_id ? saved : order,
              ),
            );
            setSelected(null);
          }}
        />
      )}
    </section>
  );
}
