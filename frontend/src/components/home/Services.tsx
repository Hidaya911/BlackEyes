import type { CustomerProduct, DesignDraft } from '../../api/customer';
import { ProductCatalog } from '../customer/ProductCatalog';
interface Props {
  products: CustomerProduct[];
  onAdd: (id: number, quantity: number, specifications: string, designs: DesignDraft[]) => string | void;
  onLogin?: () => void; search?: string; wholesale?: boolean;
  fullCatalog?: boolean;
  onViewAll?: () => void;
}
export function Services({ products, onAdd, onLogin, search = '', wholesale = false, fullCatalog = false, onViewAll }: Props) {
  return <section id="services" className={`storefront-products ${fullCatalog ? 'collection-full' : 'collection-preview'}`}>
    <div className="storefront-collection-heading">
      <div className="storefront-section-intro"><span className="customer-kicker"><i className="collection-inks" aria-hidden="true">
        <i /><i /><i /></i> THE PRINT EDIT</span><h2>Small details.<br /><em>Big impressions.</em></h2>
        <p>{wholesale ? 'Your wholesale collection. Business pricing, ready for your next order.' : 'From everyday essentials to something entirely yours. Find your next great print.'}</p>
        {wholesale && <span className="storefront-role is-wholesale">Wholesale prices</span>}</div>
      <div className="collection-signature" aria-hidden="true"><span>INK. PAPER. POSSIBILITY.</span>
      <strong>Made to<br />stand <em>out.</em></strong>
      <div className="collection-swatches"><i /><i /><i /><i /></div>
      <small>THE BLACKEYES COLLECTION ↗</small></div>
    </div>
    <div className="collection-browse-heading"><div><span className="customer-kicker">
      {fullCatalog ? 'EXPLORE THE COMPLETE COLLECTION' : 'A LITTLE INSPIRATION'}</span>
      <h2>{fullCatalog ? 'All products' : 'Fresh from the studio'}</h2>
      </div>{!fullCatalog && products.length > 3 && <a href="#products" className="collection-view-all" onClick={event => { event.preventDefault(); onViewAll?.(); }}>View all products <span aria-hidden="true">→</span></a>}</div>
    <ProductCatalog key={search} products={fullCatalog ? products : products.slice(0, 3)} orders={[]} firstName="" onAdd={onAdd} onOrders={() => undefined} embedded showToolbar={fullCatalog} onLogin={onLogin} search={fullCatalog ? search : ''} />
  </section>;
}
