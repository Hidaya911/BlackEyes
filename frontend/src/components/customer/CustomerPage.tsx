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
import { Navbar } from '../home/Navbar';
import { Hero } from '../home/Hero';
import { FeaturesBar } from '../home/FeaturesBar';
import { Services } from '../home/Services';
import { WholesaleRegistration } from '../home/WholesaleRegistration';
import { AboutSection } from '../home/AboutSection';
import { Footer } from '../home/Footer';
import '../../style/Storefront.css';
type CustomerSection = 'Explore' | 'Products' | 'My orders' | 'Profile settings';
import { CustomerOrders } from "./CustomerOrders";
import { CustomerCheckout } from './CustomerCheckout';
import { CustomerProfile } from "./CustomerProfile";
import "../../style/CustomerPortal.css";
import { attachmentError } from '../../utils/customerDesigns';

interface Props {
  user: AuthUser | null;
  onLogin: () => void;
  onSignup: () => void;
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

export function CustomerPage({ user, onLogin, onSignup, onLogout, onProfileSaved }: Props) {
  const userId = user?.user_id;
  const [profile, setProfile] = useState<AuthUser | null>(user);
  const [products, setProducts] = useState<CustomerProduct[]>([]);
  const [orders, setOrders] = useState<CustomerOrder[]>([]);
  const [cart, setCart] = useState<CartLine[]>([]);
  const [section, setSection] = useState<CustomerSection>(() => window.location.hash === '#products' ? 'Products' : 'Explore');
  const [search, setSearch] = useState('');
  const [checkout, setCheckout] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [reload, setReload] = useState(0);

  useEffect(() => {
    const navigateHash = () => {
      setSection(window.location.hash === '#products' ? 'Products' : 'Explore');
      if (window.location.hash === '#products') window.scrollTo({ top: 0 });
    };
    window.addEventListener('hashchange', navigateHash);
    return () => window.removeEventListener('hashchange', navigateHash);
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    setError("");
    Promise.all([
      userId ? getCustomerProfile(controller.signal) : Promise.resolve(null),
      userId ? getCustomerProducts(controller.signal) : fetch('/api/products', { signal: controller.signal }).then(response => { if (!response.ok) throw new Error('Unable to load products.'); return response.json() as Promise<CustomerProduct[]>; }),
      userId ? getCustomerOrders(controller.signal) : Promise.resolve([]),
    ])
      .then(([user, catalog, history]) => {
        if (controller.signal.aborted) return;
        setProfile(user);
        setProducts(catalog);
        setOrders(history);
        setCart(user ? loadBasket(user.user_id) : []);
      })
      .catch((failure: Error) => {
        if (!controller.signal.aborted) setError(failure.message);
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, [reload, userId]);

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
                  designs: products.find(product => product.product_id === productId)?.is_customizable ? [...(line.designs?.length ? line.designs : [{ quantity: line.quantity, brief: '' }]), ...designs] : [],
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

  function goHome(anchor = 'home') {
    if (anchor === 'services') { openProducts(); return; }
    window.location.hash = anchor;
    setSection('Explore');
    requestAnimationFrame(() => document.getElementById(anchor)?.scrollIntoView({ behavior: 'smooth' }));
  }
  function openProducts() { window.location.hash = 'products'; openSection('Products'); }
  function openSection(next: CustomerSection) { setSection(next); window.scrollTo({ top: 0, behavior: 'smooth' }); }
  return (<div className="storefront">
    <Navbar user={profile} onNavigateToLogin={onLogin} onNavigateToSignup={onSignup} onLogout={onLogout}
      cartCount={cart.reduce((sum, line) => sum + line.quantity, 0)} onCart={() => profile ? setCheckout(true) : onLogin()}
      onHome={goHome} onSearch={setSearch} onOrders={() => { openSection('My orders'); void getCustomerOrders().then(setOrders).catch(e => setError(e.message)); }} onProfile={() => openSection('Profile settings')} />
    <main>
      {error && <div className="alert alert-danger m-4" role="alert">{error} <button className="btn btn-sm btn-outline-danger" onClick={() => setReload(value => value + 1)}>Try again</button></div>}
      {success && <div className="customer-notice m-4" role="status">{success}</div>}
      {section === 'Explore' && <><Hero onStartProject={() => goHome('services')} /><FeaturesBar />
        {loading ? <p className="text-center p-5" role="status">Loading the collection…</p> : <Services products={products} onAdd={addToCart} onLogin={profile ? undefined : onLogin} onViewAll={openProducts} wholesale={profile?.role === 'wholesaler'} />}
        {!user && <WholesaleRegistration />}<AboutSection /></>}
      <div className={section === 'Explore' ? '' : 'storefront-account'}>
      {section !== 'Explore' && <button className="storefront-back" onClick={() => goHome()}>← Back to the shop</button>}
      {section === 'Products' && (loading ? <p role="status">Loading the collection…</p> : <Services fullCatalog products={products} onAdd={addToCart} onLogin={profile ? undefined : onLogin} search={search} wholesale={profile?.role === 'wholesaler'} />)}
      {section === "My orders" && (
        <CustomerOrders
          orders={orders}
          onBrowse={() => goHome('services')}
          onRefresh={async () => setOrders(await getCustomerOrders())}
        />
      )}
      {section === "Profile settings" && profile && (
        <CustomerProfile
          user={profile}
          onLogout={onLogout}
          onSaved={(saved) => {
            setProfile(saved);
            onProfileSaved(saved);
          }}
        />
      )}
      </div>
      {checkout && profile && (
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
            openSection("My orders");
            setSuccess(
              `Order #${order.order_id} is placed. The press will review your design and print details.`,
            );
          }}
        />
      )}
    </main><Footer />
    </div>
  );
}
