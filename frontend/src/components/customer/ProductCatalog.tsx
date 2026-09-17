import { useMemo, useState, type FormEvent } from "react";
import { Modal } from "react-bootstrap";
import {
  FaArrowRight,
  FaBoxOpen,
  FaCheck,
  FaPlus,
  FaSearch,
} from "react-icons/fa";
import {
  customerMoney,
  type CustomerOrder,
  type CustomerProduct,
} from "../../api/customer";

function ProductVisual({
  product,
  index,
}: {
  product: CustomerProduct;
  index: number;
}) {
  const [failed, setFailed] = useState(false);
  return (
    <div className={`customer-product-art art-${index % 4}`}>
      {product.image_url && !failed ? (
        <img
          src={product.image_url}
          alt={product.name}
          onError={() => setFailed(true)}
        />
      ) : (
        <div className="customer-paper-preview" aria-hidden="true">
          <span>
            BLACK<span className="customer-dot">●</span>EYES
          </span>
          <strong>{product.name}</strong>
          <div className="customer-paper-lines" />
          <small>YOUR NEXT GREAT IMPRESSION.</small>
        </div>
      )}
      {product.special_price && (
        <span className="customer-special-tag">Your exclusive price</span>
      )}
    </div>
  );
}

interface Props {
  products: CustomerProduct[];
  orders: CustomerOrder[];
  firstName: string;
  onAdd: (productId: number, quantity: number, specifications: string) => void;
  onOrders: () => void;
}

export function ProductCatalog({
  products,
  orders,
  firstName,
  onAdd,
  onOrders,
}: Props) {
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState("featured");
  const [selected, setSelected] = useState<CustomerProduct | null>(null);
  const [quantity, setQuantity] = useState(1);
  const [specifications, setSpecifications] = useState("");
  const [message, setMessage] = useState("");
  const filtered = useMemo(() => {
    const result = products.filter((product) =>
      `${product.name} ${product.description ?? ""}`
        .toLowerCase()
        .includes(query.toLowerCase()),
    );
    if (sort === "price") result.sort((a, b) => a.price - b.price);
    if (sort === "name") result.sort((a, b) => a.name.localeCompare(b.name));
    return result;
  }, [products, query, sort]);

  function add(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selected) return;
    onAdd(selected.product_id, quantity, specifications);
    setMessage(`${selected.name} added to your basket.`);
    setSelected(null);
  }

  return (
    <>
      <section className="customer-hero">
        <div className="customer-hero-copy">
          <span className="customer-kicker">
            HELLO, {firstName.toUpperCase()} · LET’S MAKE SOMETHING
          </span>
          <h2>
            Your ideas.
            <br />
            <em>In full colour.</em>
          </h2>
          <p>
            Thoughtful details. Beautiful finishes. Explore our print collection
            and bring your next project to life.
          </p>
          <a
            className="customer-button customer-button-light"
            href="#customer-collection"
          >
            Explore the collection <FaArrowRight />
          </a>
        </div>
        <div className="customer-hero-art" aria-hidden="true">
          <div className="customer-art-sheet sheet-back">
            <span>
              MAKE IT
              <br />
              MATTER.
            </span>
          </div>
          <div className="customer-art-sheet sheet-front">
            <small>THE PRINT EDIT / 01</small>
            <strong>
              Good
              <br />
              things
              <br />
              <em>in print.</em>
            </strong>
            <span>BLACKEYES STUDIO</span>
          </div>
          <div className="customer-art-seal">
            MADE
            <br />
            FOR YOU
          </div>
          <div className="customer-ink-dots">
            <i />
            <i />
            <i />
            <i />
          </div>
        </div>
      </section>
      <div className="customer-service-strip">
        <span>
          <b>01</b> Choose your print
        </span>
        <span>
          <b>02</b> Upload or brief us
        </span>
        <span>
          <b>03</b> Collect at the press
        </span>
        <button onClick={onOrders}>
          {orders.length} orders in your studio <FaArrowRight />
        </button>
      </div>
      <section id="customer-collection" className="customer-collection">
        <div className="customer-section-heading">
          <div>
            <span className="customer-kicker">THE COLLECTION</span>
            <h2>Made to leave an impression.</h2>
          </div>
          <span className="customer-count-pill">
            {products.length} products
          </span>
        </div>
        <div className="customer-catalog-toolbar">
          <label className="customer-search">
            <FaSearch />
            <input
              type="search"
              aria-label="Search products"
              placeholder="Find your next print project…"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
            />
          </label>
          <select
            className="form-select"
            aria-label="Sort products"
            value={sort}
            onChange={(event) => setSort(event.target.value)}
          >
            <option value="featured">Newest first</option>
            <option value="price">Price: low to high</option>
            <option value="name">Name: A to Z</option>
          </select>
        </div>
        {message && (
          <div className="customer-notice" role="status">
            <FaCheck />
            {message}
          </div>
        )}
        <div className="customer-product-grid">
          {filtered.map((product, index) => (
            <article className="customer-product-card" key={product.product_id}>
              <ProductVisual product={product} index={index} />
              <div className="customer-product-copy">
                <span className="customer-kicker">
                  PRINT COLLECTION /{" "}
                  {String(product.product_id).padStart(3, "0")}
                </span>
                <h3>{product.name}</h3>
                <p>
                  {product.description ||
                    "Carefully produced, with your design at the centre."}
                </p>
                <div className="customer-product-bottom">
                  <div>
                    <strong>{customerMoney(product.price)}</strong>
                    <small>per unit</small>
                  </div>
                  <button
                    className="customer-add-button"
                    aria-label={`Customize ${product.name}`}
                    onClick={() => {
                      setSelected(product);
                      setQuantity(1);
                      setSpecifications("");
                    }}
                  >
                    <FaPlus /> Customize
                  </button>
                </div>
              </div>
            </article>
          ))}
        </div>
        {!filtered.length && (
          <div className="customer-empty">
            <FaBoxOpen />
            <h3>
              {query ? "No prints found" : "A fresh collection is on its way"}
            </h3>
            <p>
              {query
                ? "Try a different product name."
                : "Products will appear here when the press adds them."}
            </p>
          </div>
        )}
      </section>
      <Modal
        show={!!selected}
        onHide={() => setSelected(null)}
        centered
        contentClassName="customer-modal"
        aria-labelledby="customize-title"
      >
        <Modal.Header closeButton>
          <Modal.Title id="customize-title">{selected?.name}</Modal.Title>
        </Modal.Header>
        <form onSubmit={add}>
          <Modal.Body>
            <p className="text-secondary">{selected?.description}</p>
            <label className="customer-field">
              <span>Quantity</span>
              <input
                className="form-control"
                type="number"
                min={1}
                max={100000}
                step={1}
                required
                value={quantity || ""}
                onChange={(event) => setQuantity(Number(event.target.value))}
              />
            </label>
            <label className="customer-field mt-3">
              <span>Print details / specifications</span>
              <textarea
                className="form-control"
                rows={3}
                maxLength={2000}
                placeholder="Size, colour, finish, or anything we should know…"
                value={specifications}
                onChange={(event) => setSpecifications(event.target.value)}
              />
            </label>
            <p className="customer-form-hint mt-2">
              Catalog pricing applies. The press will review your specifications
              before production.
            </p>
            <div className="customer-checkout-total">
              <span>Item total</span>
              <strong>
                {customerMoney((selected?.price ?? 0) * quantity)}
              </strong>
            </div>
          </Modal.Body>
          <Modal.Footer>
            <button
              type="button"
              className="btn btn-light"
              onClick={() => setSelected(null)}
            >
              Keep browsing
            </button>
            <button className="customer-button" type="submit">
              <FaPlus /> Add to basket
            </button>
          </Modal.Footer>
        </form>
      </Modal>
    </>
  );
}
