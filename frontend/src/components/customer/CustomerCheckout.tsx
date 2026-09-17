import { useState, type FormEvent } from "react";
import { Modal } from "react-bootstrap";
import {
  FaArrowLeft,
  FaArrowRight,
  FaCheck,
  FaFileUpload,
  FaShoppingBag,
  FaTrash,
} from "react-icons/fa";
import {
  customerMoney,
  placeCustomerOrder,
  readFileData,
  type CartLine,
  type CustomerOrder,
  type CustomerProduct,
  type PortalConfig,
} from "../../api/customer";

interface Props {
  cart: CartLine[];
  products: CustomerProduct[];
  config: PortalConfig;
  phone: string;
  onChange: (cart: CartLine[]) => void;
  onClose: () => void;
  onPlaced: (order: CustomerOrder) => void;
  onRefresh: () => Promise<void>;
}

export function CustomerCheckout({
  cart,
  products,
  config,
  phone,
  onChange,
  onClose,
  onPlaced,
  onRefresh,
}: Props) {
  const [step, setStep] = useState(0);
  const [contactPhone, setContactPhone] = useState(phone);
  const [brief, setBrief] = useState("");
  const [files, setFiles] = useState<File[]>([]);
  const [method, setMethod] = useState<"cash" | "whish_money">("whish_money");
  const [timing, setTiming] = useState<"on_order" | "after_pickup">("on_order");
  const [requestKey] = useState(() => crypto.randomUUID());
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [fileError, setFileError] = useState("");
  const [copied, setCopied] = useState(false);
  const lines = cart.map((line) => ({
    ...line,
    product: products.find((product) => product.product_id === line.product_id),
  }));
  const total = lines.reduce(
    (sum, line) => sum + (line.product?.price ?? 0) * line.quantity,
    0,
  );
  const unavailable = lines.some((line) => !line.product);

  function chooseFiles(chosen: FileList | null) {
    if (!chosen) return;
    const next = [...files, ...Array.from(chosen)];
    setFileError("");
    if (
      next.length > 3 ||
      next.reduce((sum, file) => sum + file.size, 0) > 20 * 1024 * 1024
    ) {
      setFileError(
        "Choose up to 3 files, with a combined size of 20 MB or less.",
      );
      return;
    }
    if (
      next.some(
        (file) =>
          !["application/pdf", "image/png", "image/jpeg"].includes(file.type) ||
          file.size > 10 * 1024 * 1024 ||
          file.size === 0,
      )
    ) {
      setFileError("Use non-empty PDF, PNG, or JPEG files, up to 10 MB each.");
      return;
    }
    setFiles(next);
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    if (!cart.length || unavailable || busy) return;
    if (step === 1 && !files.length && !brief.trim()) {
      setError("Upload your artwork or tell us what you would like designed.");
      return;
    }
    if (step < 2) {
      setStep((value) => value + 1);
      return;
    }
    setBusy(true);
    try {
      const attachments = await Promise.all(
        files.map(async (file) => ({
          name: file.name,
          data_url: await readFileData(file),
        })),
      );
      const order = await placeCustomerOrder({
        request_key: requestKey,
        items: cart,
        files: attachments,
        design_request_note: brief,
        contact_phone: contactPhone,
        expected_total: total,
        payment_method: method,
        payment_timing: timing,
      });
      onPlaced(order);
    } catch (failure) {
      setError(
        failure instanceof Error
          ? failure.message
          : "Unable to place order. Your basket has been kept.",
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal
      show
      onHide={() => !busy && onClose()}
      size="lg"
      centered
      scrollable
      backdrop={busy ? "static" : true}
      keyboard={!busy}
      contentClassName="customer-modal"
      aria-labelledby="checkout-title"
    >
      <Modal.Header closeButton={!busy}>
        <Modal.Title id="checkout-title">Your next great print.</Modal.Title>
      </Modal.Header>
      <form onSubmit={(event) => void submit(event)}>
        <Modal.Body>
          <ol className="customer-checkout-steps">
            {["Your basket", "Design & payment", "Review"].map(
              (label, index) => (
                <li key={label} className={index <= step ? "is-active" : ""}>
                  <b>{index < step ? <FaCheck /> : index + 1}</b>
                  {label}
                </li>
              ),
            )}
          </ol>
          {!cart.length ? (
            <div className="customer-empty">
              <FaShoppingBag />
              <h3>A little space for big ideas</h3>
              <p>Add a product to start your print project.</p>
            </div>
          ) : (
            <fieldset disabled={busy}>
              {step === 0 && (
                <div className="customer-cart-lines">
                  {lines.map((line) => (
                    <article key={line.product_id}>
                      <div className="customer-cart-line-heading">
                        <div>
                          <h3>{line.product?.name || "Unavailable product"}</h3>
                          <small>
                            {line.product
                              ? `${customerMoney(line.product.price)} per unit`
                              : "Remove this item to continue."}
                          </small>
                        </div>
                        <button
                          className="customer-icon-button"
                          type="button"
                          aria-label={`Remove ${line.product?.name || "unavailable product"}`}
                          onClick={() =>
                            onChange(
                              cart.filter(
                                (item) => item.product_id !== line.product_id,
                              ),
                            )
                          }
                        >
                          <FaTrash />
                        </button>
                      </div>
                      <div className="customer-cart-line-fields">
                        <label className="customer-field">
                          <span>Quantity</span>
                          <input
                            className="form-control"
                            type="number"
                            min={1}
                            max={100000}
                            step={1}
                            required
                            value={line.quantity || ""}
                            onChange={(event) =>
                              onChange(
                                cart.map((item) =>
                                  item.product_id === line.product_id
                                    ? {
                                        ...item,
                                        quantity: Number(event.target.value),
                                      }
                                    : item,
                                ),
                              )
                            }
                          />
                        </label>
                        <label className="customer-field">
                          <span>Print details</span>
                          <input
                            className="form-control"
                            maxLength={2000}
                            value={line.specifications}
                            placeholder="Size, colour, finish…"
                            onChange={(event) =>
                              onChange(
                                cart.map((item) =>
                                  item.product_id === line.product_id
                                    ? {
                                        ...item,
                                        specifications: event.target.value,
                                      }
                                    : item,
                                ),
                              )
                            }
                          />
                        </label>
                        <strong>
                          {customerMoney(
                            (line.product?.price ?? 0) * line.quantity,
                          )}
                        </strong>
                      </div>
                    </article>
                  ))}
                </div>
              )}
              {step === 1 && (
                <div className="customer-checkout-details">
                  <h3>Let’s get your artwork ready.</h3>
                  <label className="customer-upload-zone">
                    <FaFileUpload />
                    <strong>Choose your design files</strong>
                    <span>
                      PDF, PNG or JPG · 10 MB each · Up to 3 files / 20 MB total
                    </span>
                    <input
                      aria-label="Design files"
                      type="file"
                      multiple
                      accept="application/pdf,image/png,image/jpeg"
                      onChange={(event) => {
                        chooseFiles(event.target.files);
                        event.target.value = "";
                      }}
                    />
                  </label>
                  {fileError && (
                    <div className="alert alert-danger" role="alert">
                      {fileError}
                    </div>
                  )}
                  <ul className="customer-file-list">
                    {files.map((file, index) => (
                      <li key={`${file.name}-${index}`}>
                        <span>
                          {file.name}{" "}
                          <small>({(file.size / 1024).toFixed(0)} KB)</small>
                        </span>
                        <button
                          type="button"
                          aria-label={`Remove file ${file.name}`}
                          onClick={() =>
                            setFiles(
                              files.filter((_, position) => position !== index),
                            )
                          }
                        >
                          <FaTrash />
                        </button>
                      </li>
                    ))}
                  </ul>
                  <label className="customer-field">
                    <span>
                      Design brief {files.length ? "(optional)" : "*"}
                    </span>
                    <textarea
                      className="form-control"
                      rows={3}
                      required={!files.length}
                      maxLength={4000}
                      value={brief}
                      placeholder="No artwork yet? Tell us the text, colours and look you have in mind. For multiple products, explain which file belongs to each."
                      onChange={(event) => setBrief(event.target.value)}
                    />
                  </label>
                  <label className="customer-field">
                    <span>Contact phone *</span>
                    <input
                      className="form-control"
                      type="tel"
                      required
                      minLength={3}
                      maxLength={50}
                      value={contactPhone}
                      onChange={(event) => setContactPhone(event.target.value)}
                    />
                  </label>
                  <h3>Pay your way.</h3>
                  <div className="customer-payment-choices">
                    <label
                      className={method === "whish_money" ? "is-selected" : ""}
                    >
                      <input
                        type="radio"
                        name="payment-method"
                        value="whish_money"
                        checked={method === "whish_money"}
                        onChange={() => setMethod("whish_money")}
                      />
                      <strong>Whish Money</strong>
                      <span>Transfer to the press</span>
                    </label>
                    <label className={method === "cash" ? "is-selected" : ""}>
                      <input
                        type="radio"
                        name="payment-method"
                        value="cash"
                        checked={method === "cash"}
                        onChange={() => {
                          setMethod("cash");
                          setTiming("after_pickup");
                        }}
                      />
                      <strong>Cash at the press</strong>
                      <span>Pay when you collect</span>
                    </label>
                  </div>
                  {method === "whish_money" && (
                    <>
                      <div className="customer-whish-number">
                        <span>
                          Send your transfer to{" "}
                          <strong>
                            {config.whish_phone ||
                              "Contact the press for the Whish number"}
                          </strong>
                        </span>
                        {config.whish_phone && (
                          <button
                            className="btn btn-sm btn-light"
                            type="button"
                            onClick={async () => {
                              try {
                                await navigator.clipboard.writeText(
                                  config.whish_phone,
                                );
                                setCopied(true);
                              } catch {
                                setError("Copy the Whish number shown above.");
                              }
                            }}
                          >
                            {copied ? "Copied" : "Copy number"}
                          </button>
                        )}
                      </div>
                      <label className="customer-field">
                        <span>When would you like to pay?</span>
                        <select
                          className="form-select"
                          value={timing}
                          onChange={(event) =>
                            setTiming(event.target.value as typeof timing)
                          }
                        >
                          <option value="on_order">
                            When I place my order
                          </option>
                          <option value="after_pickup">
                            After collecting from the press
                          </option>
                        </select>
                      </label>
                    </>
                  )}
                  <p className="customer-form-hint">
                    Choosing a method does not charge you. The press confirms
                    your payment after receiving it.
                  </p>
                </div>
              )}
              {step === 2 && (
                <div className="customer-review">
                  <h3>One last look.</h3>
                  <p>
                    We’ll review your artwork and print details before
                    production.
                  </p>
                  {lines.map((line) => (
                    <div className="customer-review-row" key={line.product_id}>
                      <span>
                        {line.quantity} × {line.product?.name}
                        <small>{line.specifications}</small>
                      </span>
                      <strong>
                        {customerMoney(
                          (line.product?.price ?? 0) * line.quantity,
                        )}
                      </strong>
                    </div>
                  ))}
                  <div className="customer-review-notes">
                    <strong>Design & contact</strong>
                    <p>{brief || "Use the attached artwork."}</p>
                    <p>
                      {files.length} design files attached · {contactPhone}
                    </p>
                    <strong>Payment & collection</strong>
                    <p>
                      {method === "cash"
                        ? "Cash at the press"
                        : `Whish Money to ${config.whish_phone}`}{" "}
                      ·{" "}
                      {timing === "on_order"
                        ? "Pay when ordering"
                        : "Pay after collection"}
                    </p>
                    <p>
                      Collection at the press. Standard digital prints usually
                      take around 24 hours; bulk/custom work may take 3–5
                      business days.
                    </p>
                  </div>
                </div>
              )}
              <div className="customer-checkout-total">
                <span>
                  Total <small>USD</small>
                </span>
                <strong>{customerMoney(total)}</strong>
              </div>
            </fieldset>
          )}
          {error && (
            <div className="alert alert-danger mt-3" role="alert">
              {error}
              <button
                type="button"
                className="btn btn-sm btn-outline-danger d-block mt-2"
                disabled={busy}
                onClick={async () => {
                  try {
                    await onRefresh();
                    setStep(0);
                    setError(
                      "Catalog refreshed. Please review your basket before submitting again.",
                    );
                  } catch (failure) {
                    setError(
                      failure instanceof Error
                        ? failure.message
                        : "Unable to refresh.",
                    );
                  }
                }}
              >
                Refresh catalog & review basket
              </button>
            </div>
          )}
        </Modal.Body>
        <Modal.Footer>
          <button
            type="button"
            className="btn btn-light"
            disabled={busy}
            onClick={() => (step ? setStep(step - 1) : onClose())}
          >
            <FaArrowLeft className="me-2" />
            {step ? "Back" : "Keep exploring"}
          </button>
          {!!cart.length && (
            <button
              type="submit"
              className="customer-button"
              disabled={busy || unavailable}
            >
              {busy
                ? "Saving your order…"
                : step === 2
                  ? "Place order"
                  : "Continue"}
              <FaArrowRight />
            </button>
          )}
        </Modal.Footer>
      </form>
    </Modal>
  );
}
