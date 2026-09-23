import { useEffect, useRef, useState, type FormEvent } from "react";
import {
  FaPlus,
  FaTrashAlt,
  FaUserPlus,
  FaSearch,
  FaStore,
  FaCheckCircle,
} from "react-icons/fa";
import { customerMoney, readFileData } from "../../api/customer";
import {
  pressRequest,
  type PressCustomer,
  type PressOrder,
  type PressProduct,
} from "../../api/press";
import "../../style/PressWorkspace.css";
import { CounterCatalog } from "./catalog/CounterCatalog";

interface Line {
  id: string;
  product: string;
  name: string;
  quantity: number;
  price: string;
  specifications: string;
}
const newLine = (): Line => ({
  id: crypto.randomUUID(),
  product: "",
  name: "",
  quantity: 1,
  price: "",
  specifications: "",
});
const blankCustomer = { full_name: "", phone: "", email: "", address: "" };

export function WalkInOrder({
  onCreated,
  onCancel,
}: {
  onCreated: (order: PressOrder) => void;
  onCancel: () => void;
}) {
  const [mode, setMode] = useState<"new" | "existing">("new");
  const [customer, setCustomer] = useState(blankCustomer);
  const [selected, setSelected] = useState<PressCustomer | null>(null);
  const [contactPhone, setContactPhone] = useState("");
  const [query, setQuery] = useState("");
  const [matches, setMatches] = useState<PressCustomer[]>([]);
  const [completedSearch, setCompletedSearch] = useState<string | null>(null);
  const [products, setProducts] = useState<PressProduct[]>([]);
  const [completedCatalog, setCompletedCatalog] = useState<string | null>(null);
  const [catalogError, setCatalogError] = useState("");
  const [searchError, setSearchError] = useState("");
  const [refresh, setRefresh] = useState(0);
  const [lines, setLines] = useState<Line[]>([]);
  const [note, setNote] = useState("");
  const [files, setFiles] = useState<{ name: string; data_url: string }[]>([]);
  const [method, setMethod] = useState<"cash" | "whish_money">("cash");
  const [payment, setPayment] = useState<"unpaid" | "full" | "partial">(
    "unpaid",
  );
  const [paid, setPaid] = useState("");
  const [reference, setReference] = useState("");
  const [saving, setSaving] = useState(false);
  const [reading, setReading] = useState(false);
  const [error, setError] = useState("");
  const submission = useRef({ signature: "", key: "" });
  const accountId =
    mode === "existing" && selected?.kind === "account"
      ? selected.id
      : undefined;
  const catalogKey = `${accountId ?? "standard"}:${refresh}`;
  const loading = completedCatalog !== catalogKey;
  const searching = completedSearch !== query;

  useEffect(() => {
    const controller = new AbortController();
    pressRequest<PressProduct[]>(
      `/catalog${accountId ? `?customer_id=${accountId}` : ""}`,
      { signal: controller.signal },
    )
      .then((items) => {
        if (controller.signal.aborted) return;
        setProducts(items);
        setCatalogError("");
      })
      .catch((failure: Error) => {
        if (!controller.signal.aborted) setCatalogError(failure.message);
      })
      .finally(() => {
        if (!controller.signal.aborted) setCompletedCatalog(catalogKey);
      });
    return () => controller.abort();
  }, [accountId, catalogKey]);

  useEffect(() => {
    if (mode !== "existing") return;
    const controller = new AbortController();
    const timer = setTimeout(() => {
      pressRequest<PressCustomer[]>(
        `/customers?q=${encodeURIComponent(query)}`,
        { signal: controller.signal },
      )
        .then((people) => {
          if (controller.signal.aborted) return;
          setMatches(people);
          setSearchError("");
        })
        .catch((failure: Error) => {
          if (!controller.signal.aborted) setSearchError(failure.message);
        })
        .finally(() => {
          if (!controller.signal.aborted) setCompletedSearch(query);
        });
    }, 250);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [query, mode]);

  const canCustomize = (line: Line) => line.product === 'custom' || !!products.find(product => String(product.product_id) === line.product)?.is_customizable;
  const hasCustomization = lines.some(canCustomize);
  const unitPrice = (line: Line) =>
    line.price !== ""
      ? Math.round(Number(line.price || 0) * 100)
      : (products.find((product) => String(product.product_id) === line.product)
          ?.price ?? 0);
  const total = lines.reduce(
    (sum, line) => sum + unitPrice(line) * line.quantity,
    0,
  );
  const amountPaid =
    payment === "full"
      ? total
      : payment === "partial"
        ? Math.round(Number(paid || 0) * 100)
        : 0;
  const updateLine = (id: string, changes: Partial<Line>) =>
    setLines((current) =>
      current.map((line) => (line.id === id ? { ...line, ...changes } : line)),
    );

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (saving || reading || loading || catalogError) return;
    setError("");
    if (mode === "existing" && !selected) {
      setError("Select a saved customer first.");
      return;
    }
    if (
      amountPaid > total ||
      (payment === "partial" && (amountPaid <= 0 || amountPaid >= total))
    ) {
      setError(
        "A partial payment must be greater than zero and less than the total.",
      );
      return;
    }
    if (!lines.length || lines.some(line => line.product !== 'custom' && !products.some(product => String(product.product_id) === line.product)) || lines.some(line => line.price === '' && (line.product === 'custom' || products.find(product => String(product.product_id) === line.product)?.price == null))) {
      setError('Choose an item and enter a unit price for any item without a catalog price.'); return;
    }
    const payload = {
      ...(mode === "new"
        ? { customer }
        : selected?.kind === "account"
          ? { customer_id: selected.id }
          : { walk_in_customer_id: selected!.id }),
      contact_phone: mode === "new" ? customer.phone : contactPhone,
      items: lines.map((line) => ({
        ...(line.product === "custom"
          ? { name: line.name, unit_price: unitPrice(line) }
          : { product_id: Number(line.product), ...(line.price !== "" ? { unit_price: unitPrice(line) } : {}) }),
        quantity: line.quantity,
        specifications: canCustomize(line) ? line.specifications : '',
      })),
      files: hasCustomization ? files : [],
      design_request_note: hasCustomization ? note : '',
      expected_total: total,
      amount_paid: amountPaid,
      payment_method: method,
      payment_reference:
        method === "whish_money" && amountPaid ? reference : "",
    };
    const signature = JSON.stringify(payload);
    if (submission.current.signature !== signature)
      submission.current = { signature, key: crypto.randomUUID() };
    setSaving(true);
    try {
      const order = await pressRequest<PressOrder>("/orders", {
        method: "POST",
        body: JSON.stringify({
          ...payload,
          request_key: submission.current.key,
        }),
      });
      onCreated(order);
    } catch (failure) {
      setError(
        failure instanceof Error ? failure.message : "Unable to create order.",
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="counter-page">
      <header className="counter-hero">
        <div>
          <span className="press-kicker">AT THE COUNTER</span>
          <h2>A new job starts here.</h2>
          <p>
            Save the customer, capture the details, and send it to the press.
          </p>
        </div>
        <FaStore aria-hidden="true" />
      </header>
      <form onSubmit={(event) => void submit(event)}>
        <fieldset disabled={saving || reading} className="counter-layout">
          <div className="counter-main">
            <section className="counter-panel">
              <h3>
                <b>01</b> Customer
              </h3>
              <div className="counter-tabs" aria-label="Customer selection">
                <button
                  type="button"
                  aria-pressed={mode === "new"}
                  onClick={() => { setMode("new"); setLines(current => current.map(line => line.product === "custom" ? line : { ...line, price: "" })); }}
                >
                  <FaUserPlus /> New customer
                </button>
                <button
                  type="button"
                  aria-pressed={mode === "existing"}
                  onClick={() => { setMode("existing"); setLines(current => current.map(line => line.product === "custom" ? line : { ...line, price: "" })); }}
                >
                  <FaSearch /> Find existing
                </button>
              </div>
              {mode === "new" ? (
                <>
                  <p className="press-muted">
                    Their details are saved for future visits. No login account
                    is needed.
                  </p>
                  <div className="counter-fields">
                    <label>
                      Full name
                      <input
                        className="form-control"
                        required
                        maxLength={255}
                        value={customer.full_name}
                        onChange={(e) =>
                          setCustomer({
                            ...customer,
                            full_name: e.target.value,
                          })
                        }
                      />
                    </label>
                    <label>
                      Phone
                      <input
                        className="form-control"
                        type="tel"
                        required
                        minLength={3}
                        maxLength={50}
                        value={customer.phone}
                        onChange={(e) =>
                          setCustomer({ ...customer, phone: e.target.value })
                        }
                      />
                    </label>
                    <label>
                      Email <small>optional</small>
                      <input
                        className="form-control"
                        type="email"
                        maxLength={255}
                        value={customer.email}
                        onChange={(e) =>
                          setCustomer({ ...customer, email: e.target.value })
                        }
                      />
                    </label>
                    <label>
                      Address <small>optional</small>
                      <input
                        className="form-control"
                        maxLength={500}
                        value={customer.address}
                        onChange={(e) =>
                          setCustomer({ ...customer, address: e.target.value })
                        }
                      />
                    </label>
                  </div>
                </>
              ) : (
                <>
                  <label className="w-100">
                    Search customers
                    <input
                      className="form-control"
                      type="search"
                      placeholder="Name, phone, or email…"
                      value={query}
                      onChange={(e) => setQuery(e.target.value)}
                    />
                  </label>
                  {searchError && (
                    <p className="text-danger" role="alert">
                      {searchError}
                    </p>
                  )}
                  <div className="counter-customer-results">
                    {searching ? (
                      <p role="status">Finding customers…</p>
                    ) : (
                      matches.map((person) => (
                        <button
                          type="button"
                          key={`${person.kind}-${person.id}`}
                          aria-pressed={
                            selected?.id === person.id &&
                            selected.kind === person.kind
                          }
                          onClick={() => {
                            setSelected(person);
                            setLines(current => current.map(line => line.product === "custom" ? line : { ...line, price: "" }));
                            setContactPhone(person.phone);
                          }}
                        >
                          <span>
                            <strong>{person.full_name}</strong>
                            <small>
                              {person.phone ||
                                person.email ||
                                "No contact details"}
                            </small>
                          </span>
                          <small>
                            {person.role === "wholesaler" ? "Wholesale buyer" : person.kind === "account" ? "Account" : "Walk-in"}
                          </small>
                        </button>
                      ))
                    )}
                    {!searching && !searchError && !matches.length && (
                      <p>
                        No customers found. Use “New customer” to save their
                        details.
                      </p>
                    )}
                  </div>
                  {selected && (
                    <div className="counter-selected">
                      <FaCheckCircle />
                      <span>
                        <strong>{selected.full_name} {selected.role === "wholesaler" && <span className="badge text-bg-warning">Wholesale</span>}</strong>
                        <small>
                          {selected.email || "No email"}
                          {selected.address ? ` · ${selected.address}` : ""}
                        </small>
                      </span>
                    </div>
                  )}
                  {selected && (
                    <label className="w-100 mt-3">
                      Contact phone for this order
                      <input
                        type="tel"
                        className="form-control"
                        required
                        minLength={3}
                        maxLength={50}
                        value={contactPhone}
                        onChange={(e) => setContactPhone(e.target.value)}
                      />
                    </label>
                  )}
                </>
              )}
            </section>
            <section className="counter-panel">
              <div className="counter-section-heading">
                <h3>
                  <b>02</b> The print job
                </h3>
                <button
                  type="button"
                  className="btn btn-sm btn-outline-secondary"
                  onClick={() => setRefresh((value) => value + 1)}
                  disabled={loading}
                >
                  Refresh prices
                </button>
              </div>
              {loading && <p role="status">Loading current prices…</p>}
              {catalogError && (
                <p className="text-danger" role="alert">
                  {catalogError}
                </p>
              )}
              <CounterCatalog key={catalogKey} products={products} disabled={loading || !!catalogError || lines.length >= 30} wholesale={mode === 'existing' && selected?.role === 'wholesaler'} onAdd={(product, quantity, specifications, price) => setLines(current => [...current, { ...newLine(), product: String(product.product_id), quantity, specifications, price }])} />
              <p className="press-muted mt-3">Selected items · Customer changes refresh catalog prices and clear item price overrides.</p>
              {lines.map((line, index) => (
                <div className="counter-line" key={line.id}>
                  <div className="counter-line-heading">
                    <strong>Item {index + 1}</strong>
                    <button
                      type="button"
                      className="btn btn-sm"
                      aria-label={`Remove item ${index + 1}`}
                      disabled={false}
                      onClick={() =>
                        setLines((current) =>
                          current.filter((item) => item.id !== line.id),
                        )
                      }
                    >
                      <FaTrashAlt />
                    </button>
                  </div>
                  <div className="counter-picked-name"><strong>{line.product === 'custom' ? 'Custom service' : products.find(product => String(product.product_id) === line.product)?.name || 'Product unavailable'}</strong>{line.product !== 'custom' && <small>{loading ? 'Updating price…' : products.find(product => String(product.product_id) === line.product)?.price == null ? 'Wholesale price not set — enter an agreed price below' : `Catalog unit price: ${customerMoney(products.find(product => String(product.product_id) === line.product)!.price!)}${line.price !== '' ? ' · Price adjusted for this order' : ''}`}</small>}</div>
                  {line.product === "custom" && (
                    <label className="w-100 mt-3">
                      Service name
                      <input
                        className="form-control"
                        required
                        maxLength={255}
                        placeholder="e.g. Cutting customer-supplied acrylic"
                        value={line.name}
                        onChange={(e) =>
                          updateLine(line.id, { name: e.target.value })
                        }
                      />
                    </label>
                  )}
                  <div className="counter-fields mt-3">
                    <label>
                      Quantity
                      <input
                        className="form-control"
                        type="number"
                        min={1}
                        max={100000}
                        step={1}
                        required
                        value={line.quantity || ""}
                        onChange={(e) =>
                          updateLine(line.id, {
                            quantity: Number(e.target.value),
                          })
                        }
                      />
                    </label>
                    {line.product === "custom" ? (
                      <label>
                        Unit price (USD)
                        <input
                          className="form-control"
                          type="number"
                          min={0}
                          max={999999.99}
                          step="0.01"
                          required
                          value={line.price}
                          onChange={(e) =>
                            updateLine(line.id, { price: e.target.value })
                          }
                        />
                      </label>
                    ) : (
                      <div className="counter-line-price">
                        <small>Line total</small>
                        <strong>
                          {customerMoney(unitPrice(line) * line.quantity)}
                        </strong>
                      </div>
                    )}
                  </div>
                  {line.product !== 'custom' && <label className="w-100 mt-3">Edit unit price (USD) <small>optional — blank uses catalog price</small><input className="form-control" aria-label={`Edit unit price for item ${index + 1}`} type="number" min="0" max="999999.99" step="0.01" value={line.price} onChange={event => updateLine(line.id, { price: event.target.value })} placeholder="Use customer catalog price" /></label>}
                  {canCustomize(line) && <label className="w-100 mt-3">
                    Specifications <small>optional</small>
                    <input
                      className="form-control"
                      maxLength={2000}
                      placeholder="Size, color, material, finishing…"
                      value={line.specifications}
                      onChange={(e) =>
                        updateLine(line.id, { specifications: e.target.value })
                      }
                    />
                  </label>}
                </div>
              ))}
              <button
                type="button"
                className="counter-add"
                disabled={lines.length >= 30}
                onClick={() => setLines((current) => [...current, { ...newLine(), product: "custom" }])}
              >
                <FaPlus /> Add custom service
              </button>
            </section>
            {hasCustomization && <section className="counter-panel">
              <h3>
                <b>03</b> Design &amp; instructions
              </h3>
              <label className="w-100">
                Job brief{" "}
                {files.length > 0 && <small>optional with artwork</small>}
                <textarea
                  className="form-control"
                  rows={4}
                  required={!files.length}
                  maxLength={4000}
                  placeholder="Describe what needs to be produced, including any design work…"
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                />
              </label>
              <label className="counter-upload">
                Attach artwork{" "}
                <small>
                  PDF, PNG, or JPEG · 3 files · 10 MB each / 20 MB total
                </small>
                <input
                  className="form-control mt-2"
                  type="file"
                  multiple
                  accept="application/pdf,image/png,image/jpeg"
                  onChange={async (e) => {
                    const chosen = Array.from(e.target.files ?? []);
                    e.target.value = "";
                    if (!chosen.length) return;
                    if (
                      chosen.length > 3 ||
                      chosen.some(
                        (file) =>
                          ![
                            "application/pdf",
                            "image/png",
                            "image/jpeg",
                          ].includes(file.type) || file.size > 10 * 1024 * 1024,
                      ) ||
                      chosen.reduce((sum, file) => sum + file.size, 0) >
                        20 * 1024 * 1024
                    ) {
                      setError(
                        "Choose up to 3 PDF/PNG/JPEG files, at most 10 MB each and 20 MB total.",
                      );
                      return;
                    }
                    setReading(true);
                    setError("");
                    try {
                      setFiles(
                        await Promise.all(
                          chosen.map(async (file) => ({
                            name: file.name,
                            data_url: await readFileData(file),
                          })),
                        ),
                      );
                    } catch {
                      setError("Unable to read the selected files.");
                    } finally {
                      setReading(false);
                    }
                  }}
                />
              </label>
              {files.map((file, index) => (
                <div className="counter-attachment" key={index}>
                  <span>{file.name}</span>
                  <button
                    type="button"
                    className="btn btn-sm"
                    aria-label={`Remove ${file.name}`}
                    onClick={() =>
                      setFiles((current) =>
                        current.filter((_, i) => i !== index),
                      )
                    }
                  >
                    Remove
                  </button>
                </div>
              ))}
            </section>}
          </div>
          <aside className="counter-summary counter-panel">
            <span className="press-kicker">ORDER SUMMARY</span>
            <h3>Ready for the press.</h3>
            <div className="counter-total">
              <span>Total · USD</span>
              <strong>{customerMoney(total)}</strong>
              <small>
                {lines.length} line item{lines.length === 1 ? "" : "s"}
              </small>
            </div>
            <label className="w-100">
              Payment method
              <select
                className="form-select"
                value={method}
                onChange={(e) => setMethod(e.target.value as typeof method)}
              >
                <option value="cash">Cash at the counter</option>
                <option value="whish_money">Whish Money</option>
              </select>
            </label>
            <label className="w-100 mt-3">
              Payment received
              <select
                className="form-select"
                value={payment}
                onChange={(e) => setPayment(e.target.value as typeof payment)}
              >
                <option value="unpaid">Not received — balance due</option>
                <option value="full">Full payment received</option>
                <option value="partial">Partial payment received</option>
              </select>
            </label>
            {payment === "partial" && (
              <label className="w-100 mt-3">
                Amount received (USD)
                <input
                  className="form-control"
                  type="number"
                  min="0.01"
                  max={total / 100}
                  step="0.01"
                  required
                  value={paid}
                  onChange={(e) => setPaid(e.target.value)}
                />
              </label>
            )}
            {method === "whish_money" && amountPaid > 0 && (
              <label className="w-100 mt-3">
                Transfer reference
                <input
                  className="form-control"
                  required
                  minLength={3}
                  maxLength={100}
                  value={reference}
                  onChange={(e) => setReference(e.target.value)}
                />
              </label>
            )}
            <div className="counter-balance">
              <span>
                Received<strong>{customerMoney(amountPaid)}</strong>
              </span>
              <span>
                Balance due<strong>{customerMoney(total - amountPaid)}</strong>
              </span>
            </div>
            <p className="press-muted">
              Only record money you have actually received. Artwork and design
              briefs are reviewed before production.
            </p>
            {error && (
              <div className="alert alert-danger" role="alert">
                {error}
              </div>
            )}
            <button
              className="btn press-primary w-100"
              type="submit"
              disabled={saving || reading || loading || !!catalogError || !lines.length}
            >
              {saving
                ? "Creating order…"
                : reading
                  ? "Reading artwork…"
                  : "Create walk-in order"}
            </button>
            <button
              className="btn btn-light w-100 mt-2"
              type="button"
              onClick={onCancel}
            >
              Cancel
            </button>
          </aside>
        </fieldset>
      </form>
    </section>
  );
}
