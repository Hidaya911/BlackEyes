import { useState } from 'react';
import { Navbar as BootstrapNavbar, Nav, Container, Form, Button, Dropdown } from 'react-bootstrap';
import { FaShoppingBag, FaUser, FaBoxOpen, FaSignOutAlt, FaCog } from 'react-icons/fa';
import type { AuthUser } from '../../api/auth';
import logo from '../../assets/logo.png';
interface Props {
  onNavigateToLogin: () => void; onNavigateToSignup: () => void;
  user?: AuthUser | null; cartCount?: number; onCart?: () => void;
  onOrders?: () => void; onProfile?: () => void; onLogout?: () => void;
  onHome?: (anchor: string) => void; onSearch?: (query: string) => void;
}
export function Navbar({ onNavigateToLogin, onNavigateToSignup, user, cartCount = 0, onCart, onOrders, onProfile, onLogout, onHome, onSearch }: Props) {
  const [expanded, setExpanded] = useState(false);
  const [search, setSearch] = useState('');
  const navigate = (anchor: string) => { setExpanded(false); onHome?.(anchor); };
  return <BootstrapNavbar expanded={expanded} expand="lg" className="storefront-nav bg-white py-3 border-bottom">
    <Container fluid className="px-3 px-lg-5" style={{ maxWidth: 1600 }}>
      <BootstrapNavbar.Brand href="#home" onClick={() => navigate('home')} className="d-flex align-items-center gap-3">
        <img src={logo} alt="Blackeyes" style={{ height: 40 }} />
        <span className="storefront-brand-caption d-none d-xl-block">PRESS & PRINT CO<br />BLACKEYES</span>
      </BootstrapNavbar.Brand>
      <div className="storefront-nav-actions order-lg-3">
        {user && (user.role === 'customer' || user.role === 'wholesaler') && <button type="button" className="storefront-basket" aria-label={`Open basket, ${cartCount} items`} onClick={onCart}><FaShoppingBag /><span>{cartCount}</span></button>}
        {user ? <Dropdown align="end">
          <Dropdown.Toggle variant="light" id="storefront-profile" className="storefront-profile-toggle" aria-label="Open profile menu">
            {user.profile_image ? <img src={user.profile_image} alt="" /> : <FaUser />}<span className="d-none d-xl-inline">{user.full_name.split(' ')[0]}</span>
          </Dropdown.Toggle>
          <Dropdown.Menu className="storefront-profile-menu">
            <div className="px-3 py-2"><strong className="d-block">{user.full_name}</strong><span className={`storefront-role ${user.role === 'wholesaler' ? 'is-wholesale' : ''}`}>{user.role === 'wholesaler' ? 'Wholesaler' : 'Customer'}</span></div>
            <Dropdown.Divider /><Dropdown.Item onClick={onOrders}><FaBoxOpen /> My orders</Dropdown.Item>
            <Dropdown.Item onClick={onProfile}><FaCog /> Profile settings</Dropdown.Item>
            <Dropdown.Divider /><Dropdown.Item onClick={onLogout}><FaSignOutAlt /> Log out</Dropdown.Item>
          </Dropdown.Menu>
        </Dropdown> : <div className="d-flex gap-2"><Button variant="outline-dark" className="rounded-pill px-3" onClick={onNavigateToLogin}>Login</Button><Button variant="dark" className="rounded-pill px-3" onClick={onNavigateToSignup}>Sign Up</Button></div>}
        <BootstrapNavbar.Toggle aria-controls="storefront-navigation" onClick={() => setExpanded(!expanded)} />
      </div>
      <BootstrapNavbar.Collapse id="storefront-navigation" className="order-lg-2">
        <Nav className="mx-auto gap-lg-3 py-3 py-lg-0">{[['home', 'Home'], ['services', 'Products'], ['wholesale', 'Wholesale'], ['about', 'About'], ['contact', 'Contact']].filter(([anchor]) => !user || anchor !== 'wholesale').map(([anchor, label]) => <Nav.Link href={`#${anchor === 'services' ? 'products' : anchor}`} key={anchor} onClick={event => { event.preventDefault(); navigate(anchor); }}>{label}</Nav.Link>)}</Nav>
        <Form className="me-lg-3" onSubmit={event => { event.preventDefault(); onSearch?.(search); navigate('services'); }}><Form.Control type="search" aria-label="Search products" placeholder="Search products…" className="rounded-pill bg-light" value={search} onChange={event => setSearch(event.target.value)} /></Form>
      </BootstrapNavbar.Collapse>
    </Container>
  </BootstrapNavbar>;
}
