import { AdminAvatar } from './AdminAvatar';
import { AdminSection } from './AdminSection';
import { useState } from 'react';
// import { SmartSearch } from '../press/SmartSearch';
import { FaArrowRight, FaBoxOpen, FaChartLine, FaChevronDown, FaClipboardList, FaCog, FaLayerGroup, FaSearch, FaSignOutAlt, FaTruck, FaUsers } from 'react-icons/fa';
import { Dropdown, Offcanvas } from 'react-bootstrap';
import { FaBars } from 'react-icons/fa';
import type { AuthUser } from '../../api/auth';
import { StockAlerts } from './StockAlerts';
import logo from '../../assets/logo in white.png';
import '../../style/AdminPage.css';
import '../../style/WorkspaceResponsive.css';

interface Props { onNavigateHome: () => void; adminId?: number; user: AuthUser | null; }
const links = [['Dashboard', FaLayerGroup], /* ['Smart Search', FaSearch], */ ['Orders', FaClipboardList], ['New walk-in order', FaClipboardList], ['Invoices & receipts', FaClipboardList], ['Products', FaBoxOpen], ['Create staff', FaUsers], ['Vendors', FaTruck], ['Customers', FaUsers], ['Customer ledger', FaClipboardList], ['Reports', FaChartLine], ['Settings', FaCog]] as const;

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
        <AdminSection section={section} adminId={adminId} profile={profile} orderNotice={orderNotice} navigateToSection={navigateToSection} saveProfile={saveProfile} onOrderCreated={(id, name) => { setSection('Orders'); setOrderNotice(`Order #${id} created for ${name}. It is ready for review.`); }} />
      </section>
    </main>
  );
};
