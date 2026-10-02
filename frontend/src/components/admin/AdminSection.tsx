import type { AuthUser } from '../../api/auth';
import { ProductManager } from './ProductManager';
import { StaffManager } from './StaffManager';
import { VendorManager } from './VendorManager';
import { OrderManager } from '../press/OrderManager';
import { WalkInOrder } from '../press/WalkInOrder';
import { SettingsManager } from './SettingsManager';
import { CustomerManager } from './CustomerManager';
import { AdminReports } from './AdminReports';
import { InventoryManager } from './InventoryManager';
import { DocumentCenter } from '../press/documents/DocumentCenter';
import { CustomerLedger } from '../press/ledger/CustomerLedger';

interface Props {
  section: string;
  adminId?: number;
  profile: AuthUser | null;
  orderNotice: string;
  navigateToSection: (section: string) => void;
  saveProfile: (user: AuthUser) => void;
  onOrderCreated: (id: number, name: string) => void;
}

export function AdminSection({ section, adminId, profile, orderNotice, navigateToSection, saveProfile, onOrderCreated }: Props) {
  let content;

  switch (section) {
    // case 'Smart Search':
    //   content = <SmartSearch isAdmin />;
    //   break;
    case 'Customer ledger':
      content = <CustomerLedger />;
      break;
    case 'Invoices & receipts':
      content = <DocumentCenter />;
      break;
    case 'Dashboard':
      content = <AdminReports key="dashboard" dashboard onNavigate={navigateToSection} />;
      break;
    case 'Reports':
      content = <AdminReports key="reports" onNavigate={navigateToSection} />;
      break;
    case 'Customers':
      content = <CustomerManager />;
      break;
    case 'Orders':
      content = <>{orderNotice && <div className="alert alert-success" role="status">{orderNotice}</div>}<OrderManager onCreate={() => navigateToSection('New walk-in order')} /></>;
      break;
    case 'New walk-in order':
      content = <WalkInOrder onCancel={() => navigateToSection('Orders')} onCreated={order => { onOrderCreated(order.order_id, order.customer_name); }} />;
      break;
    case 'Products':
      content = <><ProductManager adminId={adminId} /><InventoryManager /></>;
      break;
    case 'Create staff':
      content = <StaffManager adminId={adminId} />;
      break;
    case 'Vendors':
      content = <VendorManager adminId={adminId} />;
      break;
    case 'Settings':
      content = <SettingsManager adminId={adminId} user={profile} onSaved={saveProfile} />;
      break;
    default:
      content = (
        <div className="rounded-4 bg-white shadow-sm p-5">
          <small className="text-info text-uppercase fw-bold">{section}</small>
          <h1 className="mt-2">
            {section === 'Dashboard' ? `Good morning, ${profile?.full_name ?? 'Admin'}.` : section}
          </h1>
          <p className="text-muted mb-0">This workspace is ready for the next module.</p>
        </div>
      );
  }
  return content;
}
