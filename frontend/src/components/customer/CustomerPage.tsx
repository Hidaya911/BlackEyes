import { useEffect, useState } from "react";
import type { AuthUser } from "../../api/auth";
import {
  getCustomerOrders,
  getCustomerProducts,
  getCustomerProfile,
  type CartLine,
  type CustomerOrder,
  type CustomerProduct,
  type DesignDraft,
} from "../../api/customer";
import {
  CustomerLayout,
  type CustomerSection,
} from "./CustomerLayout";
import { ProductCatalog } from "./ProductCatalog";
import { CustomerCheckout } from "./CustomerCheckout";
import { CustomerOrders } from "./CustomerOrders";
import { CustomerProfile } from "./CustomerProfile";
import "../../style/CustomerPortal.css";
import { attachmentError } from '../../utils/customerDesigns';

interface Props {
  onLogout: () => void;
  onProfileSaved: (user: AuthUser) => void;
}

function loadBasket(userId: number): CartLine[] {
  try {
    const value: unknown = JSON.parse(
      sessionStorage.getItem(`blackeyes:basket:${userId}`) || "[]",
    );
    if (!Array.isArray(value)) return [];
    return value
      .filter(
        (item) =>
          Number.isInteger(item.product_id) &&
          Number.isInteger(item.quantity) &&
          item.quantity > 0 &&
          item.quantity <= 100000 &&
          typeof item.specifications === "string",
      )
      .slice(0, 30)
      .map(item => ({ product_id: item.product_id, quantity: item.quantity, specifications: item.specifications,
        designs: Array.isArray(item.designs) ? item.designs.slice(0, 30).filter((d: DesignDraft) => Number.isInteger(d.quantity) && d.quantity > 0 && typeof d.brief === 'string').map((d: DesignDraft) => ({ quantity: d.quantity, brief: d.brief, upload_name: typeof d.upload_name === 'string' ? d.upload_name : undefined })) : undefined }));
  } catch {
    return [];
  }
}

export function CustomerPage({ onLogout, onProfileSaved }: Props) {
  const [profile, setProfile] = useState<AuthUser | null>(null);
  const [products, setProducts] = useState<CustomerProduct[]>([]);
  const [orders, setOrders] = useState<CustomerOrder[]>([]);
  const [cart, setCart] = useState<CartLine[]>([]);
  const [section, setSection] = useState<CustomerSection>("Explore");
  const [checkout, setCheckout] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [reload, setReload] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    setError("");
    Promise.all([
      getCustomerProfile(controller.signal),
      getCustomerProducts(controller.signal),
      getCustomerOrders(controller.signal),
    ])
      .then(([user, catalog, history]) => {
        if (controller.signal.aborted) return;
        setProfile(user);
        setProducts(catalog);
        setOrders(history);
        setCart(loadBasket(user.user_id));
      })
      .catch((failure: Error) => {
        if (!controller.signal.aborted) setError(failure.message);
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, [reload]);

  function updateCart(next: CartLine[]) {
    setCart(next);
    if (profile)
      sessionStorage.setItem(
        `blackeyes:basket:${profile.user_id}`,
        JSON.stringify(next.map(line => ({ ...line, designs: line.designs?.map(({ file, ...design }) => ({ ...design, upload_name: file?.name || design.upload_name })) }))),
      );
  }

  function addToCart(
    productId: number,
    quantity: number,
    specifications: string,
    designs: DesignDraft[],
  ) {
    const exists = cart.find((line) => line.product_id === productId);
    if (exists && exists.quantity + quantity > 100000) return 'Maximum quantity per product is 100,000.';
    if (!exists && cart.length >= 30) return 'A basket can contain at most 30 different products.';
    if (exists && (exists.designs?.length ?? 1) + designs.length > 30) return 'Use at most 30 design groups per product.';
    const next = exists
        ? cart.map((line) =>
            line.product_id === productId
              ? {
                  ...line,
                  quantity: line.quantity + quantity,
                  specifications: specifications || line.specifications,
                  designs: [...(line.designs?.length ? line.designs : [{ quantity: line.quantity, brief: '' }]), ...designs],
                }
              : line,
          )
        : [...cart, { product_id: productId, quantity, specifications, designs }];
    const failure = attachmentError(next);
    if (failure) return failure;
    updateCart(next);
  }

  async function refreshCatalog() {
    setProducts(await getCustomerProducts());
  }

  if (loading)
    return (
      <main className="customer-loading" role="status">
        <div className="spinner-border" />
        <h2>Opening your creative space…</h2>
      </main>
    );
  if (error || !profile)
    return (
      <main className="customer-loading">
        <h2>Let’s get you back to your studio.</h2>
        <p role="alert">{error || "Please sign in to continue."}</p>
        <div className="d-flex gap-2">
          <button
            className="customer-button"
            onClick={() => setReload((value) => value + 1)}
          >
            Try again
          </button>
          <button className="btn btn-light" onClick={onLogout}>
            Return to sign in
          </button>
        </div>
      </main>
    );

  return (
    <CustomerLayout
      user={profile}
      section={section}
      onNavigate={(next) => {
        setSection(next);
        setSuccess("");
      }}
      onLogout={onLogout}
      cartCount={cart.reduce((sum, line) => sum + line.quantity, 0)}
      onCart={() => setCheckout(true)}
    >
      {success && (
        <div className="customer-notice mb-4" role="status">
          {success}
        </div>
      )}
      {section === "Explore" && (
        <ProductCatalog
          products={products}
          orders={orders}
          firstName={profile.full_name.split(" ")[0]}
          onAdd={addToCart}
          onOrders={() => setSection("My orders")}
        />
      )}
      {section === "My orders" && (
        <CustomerOrders
          orders={orders}
          onBrowse={() => setSection("Explore")}
          onRefresh={async () => setOrders(await getCustomerOrders())}
        />
      )}
      {section === "Profile settings" && (
        <CustomerProfile
          user={profile}
          onLogout={onLogout}
          onSaved={(saved) => {
            setProfile(saved);
            onProfileSaved(saved);
          }}
        />
      )}
      {checkout && (
        <CustomerCheckout
          cart={cart}
          products={products}
          phone={profile.phone ?? ""}
          onChange={updateCart}
          onClose={() => setCheckout(false)}
          onRefresh={refreshCatalog}
          onPlaced={(order) => {
            setOrders((current) => [
              order,
              ...current.filter((item) => item.order_id !== order.order_id),
            ]);
            updateCart([]);
            setCheckout(false);
            setSection("My orders");
            setSuccess(
              `Order #${order.order_id} is placed. The press will review your design and print details.`,
            );
          }}
        />
      )}
    </CustomerLayout>
  );
}
