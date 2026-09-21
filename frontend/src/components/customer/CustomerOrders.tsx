import { useState } from "react";
import { Modal } from "react-bootstrap";
import {
  FaArrowRight,
  FaCheck,
  FaDownload,
  FaReceipt,
  FaSearch,
  FaSyncAlt,
} from "react-icons/fa";
import {
  customerMoney,
  type CustomerOrder,
} from "../../api/customer";
import { OrderDesignSummary } from '../shared/OrderDesignSummary';

const stages = [
  "Awaiting review",
  "Queued",
  "In Prepress",
  "Printing",
  "Finishing",
  "Ready for Pickup",
];
const paymentLabels: Record<string, string> = {
  awaiting_payment: "Payment due",
  pending_verification: "Awaiting payment verification",
  paid: "Paid",
  partially_paid: "Partially paid",
};
const dateLabel = (value: string) =>
  new Date(
    value.endsWith("Z") || /[+-]\d\d:\d\d$/.test(value) ? value : `${value}Z`,
  ).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });

interface Props {
  orders: CustomerOrder[];
  onRefresh: () => Promise<void>;
  onBrowse: () => void;
}

export function CustomerOrders({
  orders,
  onRefresh,
  onBrowse,
}: Props) {
  const [search, setSearch] = useState("");
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");
  const selected = orders.find((order) => order.order_id === selectedId);
  const filtered = orders.filter((order) =>
    `${order.order_id} ${order.items.map((item) => item.name).join(" ")}`
      .toLowerCase()
      .includes(search.toLowerCase()),
  );

  return (
    <section className="customer-orders">
      <div className="customer-section-heading">
        <div>
          <span className="customer-kicker">FROM IDEA TO PICKUP</span>
          <h2>Your print journey.</h2>
          <p>Every project, every detail, in one place.</p>
        </div>
        <button
          className="customer-button customer-button-outline"
          disabled={refreshing}
          onClick={async () => {
            setRefreshing(true);
            setError("");
            try {
              await onRefresh();
            } catch (failure) {
              setError(
                failure instanceof Error
                  ? failure.message
                  : "Unable to refresh orders.",
              );
            } finally {
              setRefreshing(false);
            }
          }}
        >
          <FaSyncAlt />
          {refreshing ? "Refreshing…" : "Refresh orders"}
        </button>
      </div>
      {error && !selected && (
        <div className="alert alert-danger" role="alert">
          {error}
        </div>
      )}
      <label className="customer-search mb-4">
        <FaSearch />
        <input
          type="search"
          aria-label="Search your orders"
          placeholder="Search by order number or product…"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
        />
      </label>
      <div className="customer-order-grid">
        {filtered.map((order) => (
          <article className="customer-order-card" key={order.order_id}>
            <div className="customer-order-card-top">
              <span>ORDER #{String(order.order_id).padStart(4, "0")}</span>
              <small>{dateLabel(order.created_at)}</small>
            </div>
            <div className="customer-order-card-body">
              <div className="customer-order-icon">
                <FaReceipt />
              </div>
              <div>
                <h3>{order.items.map((item) => item.name).join(" + ")}</h3>
                <p>
                  {order.items.reduce((sum, item) => sum + item.quantity, 0)}{" "}
                  units · {order.files.length} design files
                </p>
              </div>
            </div>
            <div className="customer-order-badges">
              <span className="customer-status">{order.production_stage}</span>
              <span
                className={`customer-status payment-${order.payment_status}`}
              >
                {paymentLabels[order.payment_status] || order.payment_status}
              </span>
            </div>
            <div className="customer-order-bottom">
              <strong>{customerMoney(order.total)}</strong>
              <button
                onClick={() => {
                  setSelectedId(order.order_id);
                  setError("");
                }}
              >
                View order <FaArrowRight />
              </button>
            </div>
          </article>
        ))}
      </div>
      {!filtered.length && (
        <div className="customer-empty">
          <FaReceipt />
          <h3>
            {orders.length
              ? "No matching orders"
              : "Your next project starts here"}
          </h3>
          <p>
            {orders.length
              ? "Try another order number or product."
              : "Find a product you love, add your design, and we’ll take it from there."}
          </p>
          <button className="customer-button" onClick={onBrowse}>
            Explore products <FaArrowRight />
          </button>
        </div>
      )}
      <Modal
        show={!!selected}
        onHide={() => setSelectedId(null)}
        centered
        size="lg"
        scrollable
        contentClassName="customer-modal"
        aria-labelledby="customer-order-title"
      >
        <Modal.Header closeButton>
          <Modal.Title id="customer-order-title">
            Order #{selected?.order_id}
          </Modal.Title>
        </Modal.Header>
        <Modal.Body>
          {selected && (
            <>
              <p className="customer-form-hint">
                Placed {dateLabel(selected.created_at)} · Collection at the
                press
              </p>
              <ol className="customer-order-timeline">
                {stages.map((stage, index) => (
                  <li
                    key={stage}
                    className={
                      index <= stages.indexOf(selected.production_stage)
                        ? "is-complete"
                        : ""
                    }
                  >
                    <b>
                      {index < stages.indexOf(selected.production_stage) ? (
                        <FaCheck />
                      ) : (
                        index + 1
                      )}
                    </b>
                    <span>{stage}</span>
                  </li>
                ))}
              </ol>
              <div className="customer-review">
                {selected.items.map((item) => (
                  <div className="customer-review-row" key={item.order_item_id}>
                    <span>
                      <strong>{item.name}</strong>
                      <small>
                        {item.quantity} × {customerMoney(item.unit_price)}
                        {item.specifications ? ` · ${item.specifications}` : ""}
                      </small>
                    </span>
                    <strong>{customerMoney(item.subtotal)}</strong>
                  </div>
                ))}
              </div>
              <div className="customer-checkout-total">
                <span>Order total</span>
                <strong>{customerMoney(selected.total)}</strong>
              </div>
              <div className="customer-order-detail-grid">
                <section>
                  <h3>Design & files</h3>
                  <OrderDesignSummary order={selected} audience="customer" />
                  <p className="customer-preserve-text">
                    {selected.design_request_note ||
                      (selected.items.some(item => item.designs?.length) ? '' : "Use the supplied artwork.")}
                  </p>
                  {selected.files.filter(file => !file.design_id).map((file) => (
                    <a
                      className="customer-file-download"
                      key={file.file_id}
                      href={`/api/customer/orders/${selected.order_id}/files/${file.file_id}`}
                    >
                      <FaDownload />
                      <span>
                        {file.name}
                        <small>
                          {file.verification_status === "pending"
                            ? "Awaiting artwork review"
                            : file.verification_status}
                        </small>
                      </span>
                    </a>
                  ))}
                </section>
                <section>
                  <h3>Payment details</h3>
                  <p>
                    {selected.payment_method === "cash"
                      ? "Cash at the press"
                      : "Whish Money"}{" "}
                    ·{" "}
                    {selected.payment_timing === "on_order"
                      ? "When ordering"
                      : "After collection"}
                  </p>
                  <span
                    className={`customer-status payment-${selected.payment_status}`}
                  >
                    {paymentLabels[selected.payment_status] ||
                      selected.payment_status}
                  </span>
                  <p className="mt-3">Contact: {selected.contact_phone}</p>
                  <p>Received: {customerMoney(selected.amount_paid)} · Balance due: {customerMoney(selected.amount_due)}</p>
                  {selected.payment_reference && (
                    <p>Transfer reference: {selected.payment_reference}</p>
                  )}
                </section>
              </div>
              {error && (
                <div className="alert alert-danger mt-3" role="alert">
                  {error}
                </div>
              )}
            </>
          )}
        </Modal.Body>
        <Modal.Footer>
          <button
            className="btn btn-light"
            onClick={() => setSelectedId(null)}
          >
            Close
          </button>
        </Modal.Footer>
      </Modal>
    </section>
  );
}
