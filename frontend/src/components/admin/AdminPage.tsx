import { useState } from 'react';
import { SmartSearch } from '../press/SmartSearch';
import { FaArrowRight, FaBoxOpen, FaChartLine, FaChevronDown, FaClipboardList, FaCog, FaLayerGroup, FaSearch, FaSignOutAlt, FaTruck, FaUsers } from 'react-icons/fa';
import { Dropdown, Offcanvas } from 'react-bootstrap';
import { FaBars } from 'react-icons/fa';
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
import { StockAlerts } from './StockAlerts';
import { DocumentCenter } from '../press/documents/DocumentCenter';
import { CustomerLedger } from '../press/ledger/CustomerLedger';
import logo from '../../assets/logo in white.png';
import '../../style/AdminPage.css';
import '../../style/WorkspaceResponsive.css';

interface Props { onNavigateHome: () => void; adminId?: number; user: AuthUser | null; }
const links = [['Dashboard', FaLayerGroup], ['Smart Search', FaSearch], ['Orders', FaClipboardList], ['New walk-in order', FaClipboardList], ['Invoices & receipts', FaClipboardList], ['Products', FaBoxOpen], ['Create staff', FaUsers], ['Vendors', FaTruck], ['Customers', FaUsers], ['Customer ledger', FaClipboardList], ['Reports', FaChartLine], ['Settings', FaCog]] as const;

function AdminAvatar({ profile }: { profile: AuthUser | null }) {
  const [failedImage, setFailedImage] = useState<string | null>(null);
  const name = profile?.full_name.trim() || 'Super Administrator';
  const words = name.split(/\s+/);
  const initials = (words[0][0] + (words.length > 1 ? words[words.length - 1][0] : '')).toUpperCase();
  const image = profile?.profile_image;

  return (
    <span
      className="d-inline-flex align-items-center justify-content-center rounded-circle overflow-hidden shadow-sm"
      role="img"
      aria-label={`${name}'s profile`}
      title={name}
      style={{
        width: 42,
        height: 42,
        flexShrink: 0,
        background: 'linear-gradient(135deg, #1b718d, #513b73)',
        border: '2px solid #ffffffb3',
        color: '#fff',
        fontSize: 14,
        fontWeight: 700,
      }}
    >
      {image && image !== failedImage ? (
        <img
          src={image}
          alt=""
          style={{ width: '100%', height: '100%', objectFit: 'cover' }}
          onError={() => setFailedImage(image)}
        />
      ) : initials}
    </span>
  );
}

export const AdminPage = ({ onNavigateHome, adminId, user }: Props) => {
  const [section, setSection] = useState('Dashboard');
  const [menu, setMenu] = useState(false);
  const [profile, setProfile] = useState<AuthUser | null>(user);
  const [search, setSearch] = useState('');
  const [searchOpen, setSearchOpen] = useState(false);
  const [orderNotice, setOrderNotice] = useState('');
  const matchingSections = links.filter(([label]) => label.toLowerCase().includes(search.trim().toLowerCase()));
  const navigateToSection = (label: string) => {
    setMenu(false);
    setSection(label);
    setSearch('');
    setSearchOpen(false);
    setOrderNotice('');
  };
  const saveProfile = (saved: AuthUser) => { setProfile(saved); sessionStorage.setItem('blackeyes:user', JSON.stringify(saved)); };
  let content;

  switch (section) {
    case 'Smart Search':
      content = <SmartSearch isAdmin />;
      break;
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
      content = <WalkInOrder onCancel={() => navigateToSection('Orders')} onCreated={order => { setSection('Orders'); setOrderNotice(`Order #${order.order_id} created for ${order.customer_name}. It is ready for review.`); }} />;
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
  return (
    <main className="admin-workspace min-vh-100 d-flex" style={{ background: '#f4f7fb' }}>
      <Offcanvas responsive="lg" show={menu} onHide={() => setMenu(false)} id="admin-navigation" aria-label="Admin navigation"
        className="admin-sidebar flex-column"
        style={{ width: 250, flex: '0 0 250px', background: '#090e1b', padding: '28px 16px', color: '#a7b2c4' }}
      >
        <Offcanvas.Header closeButton closeVariant="white" className="d-lg-none"><Offcanvas.Title>Navigation</Offcanvas.Title></Offcanvas.Header>
        <img src={logo} alt="Blackeyes" style={{ width: 112, margin: '0 12px 28px' }} />
        <small className="text-uppercase px-2 mb-3" style={{ letterSpacing: '1px', fontSize: 10 }}>
          Press management
        </small>
        {links.map(([label, Icon]) => (
          <button
            key={label}
            type="button"
            onClick={() => navigateToSection(label)}
            className="border-0 text-start rounded-3 mb-1"
            style={{
              padding: '12px 13px',
              background: section === label ? 'linear-gradient(90deg,#00d2ff33,#ff007f22)' : 'transparent',
              color: section === label ? '#fff' : '#a7b2c4',
            }}
          >
            <Icon className="me-3" />
            {label}
          </button>
        ))}
        <div className="mt-auto pt-4">
          <div
            className="d-flex align-items-center gap-2 rounded-3 p-3"
            style={{ background: 'linear-gradient(120deg, #142237, #191b30)', border: '1px solid #ffffff12' }}
          >
            <AdminAvatar profile={profile} />
            <div style={{ minWidth: 0 }}>
              <div className="fw-semibold text-white" style={{ fontSize: 12 }}>Super Administrator</div>
              <div
                className="text-truncate mt-1"
                title={profile?.email ?? ''}
                style={{ fontSize: 11, color: '#a7b2c4' }}
              >
                {profile?.email || 'No email available'}
              </div>
            </div>
          </div>
        </div>
      </Offcanvas>
      <section className="flex-grow-1 p-4 p-lg-5" style={{ minWidth: 0 }}>
        <header className="admin-topbar">
          <button type="button" className="btn btn-light d-lg-none" aria-label="Open navigation" aria-controls="admin-navigation" aria-expanded={menu} onClick={() => setMenu(true)}><FaBars /></button>
          <div className="admin-heading">
            <div className="admin-wordmark">
              <span className="admin-print-dots" aria-hidden="true"><i /><i /><i /></span>
              BLACKEYES <span>/ WORKSPACE</span>
            </div>
            <div className="admin-section-name">{section}</div>
          </div>

          <div
            className="admin-section-search"
            onBlur={event => {
              if (!event.currentTarget.contains(event.relatedTarget)) setSearchOpen(false);
            }}
            onKeyDown={event => {
              if (event.key === 'Escape') setSearchOpen(false);
            }}
          >
            <form
              role="search"
              onSubmit={event => {
                event.preventDefault();
                if (matchingSections[0]) navigateToSection(matchingSections[0][0]);
              }}
            >
              <FaSearch aria-hidden="true" />
              <input
                type="search"
                aria-label="Search workspace sections"
                aria-expanded={searchOpen}
                aria-controls="admin-search-results"
                placeholder="Find a workspace section…"
                value={search}
                onFocus={() => setSearchOpen(true)}
                onChange={event => {
                  setSearch(event.target.value);
                  setSearchOpen(true);
                }}
              />
              <span className="admin-search-hint" aria-hidden="true">↵</span>
            </form>
            {searchOpen && (
              <div className="admin-search-results" id="admin-search-results">
                <div className="admin-menu-caption">{search.trim() ? 'MATCHING SECTIONS' : 'JUMP TO A SECTION'}</div>
                {matchingSections.length ? matchingSections.map(([label, Icon]) => (
                  <button key={label} type="button" onClick={() => navigateToSection(label)}>
                    <span className="admin-result-icon"><Icon /></span>
                    <span>{label}</span>
                    <FaArrowRight className="ms-auto" size={10} />
                  </button>
                )) : <p className="admin-no-results">No matching sections. Try “Products” or “Vendors”.</p>}
              </div>
            )}
          </div>

          <div className="admin-account">
            <Dropdown align="end">
              <Dropdown.Toggle variant="" className="admin-profile-trigger" id="admin-profile-menu" aria-label="Open account menu">
                <AdminAvatar profile={profile} />
                <span className="admin-profile-label">
                  <strong>{profile?.full_name || 'Administrator'}</strong>
                  <small>Super Administrator</small>
                </span>
                <FaChevronDown className="admin-profile-chevron" aria-hidden="true" />
              </Dropdown.Toggle>
              <Dropdown.Menu className="admin-account-menu">
                <div className="admin-account-summary">
                  <span className="admin-menu-caption">SIGNED IN AS</span>
                  <strong>{profile?.full_name || 'Administrator'}</strong>
                  <span>{profile?.email || 'No email available'}</span>
                </div>
                <Dropdown.Item onClick={() => navigateToSection('Settings')}>
                  <FaCog aria-hidden="true" /> Account settings
                </Dropdown.Item>
                <Dropdown.Divider />
                <Dropdown.Item className="admin-logout" onClick={onNavigateHome}>
                  <FaSignOutAlt aria-hidden="true" /> Log out
                </Dropdown.Item>
              </Dropdown.Menu>
            </Dropdown>
          </div>
        </header>
        <StockAlerts section={section} onManage={() => navigateToSection('Products')} />
        {content}
      </section>
    </main>
  );
};
