import { useState, type ReactNode } from "react";
import { Dropdown } from "react-bootstrap";
import {
  FaArrowRight,
  FaBars,
  FaChevronDown,
  FaCog,
  FaLayerGroup,
  FaShoppingBag,
  FaSignOutAlt,
  FaTimes,
} from "react-icons/fa";
import type { AuthUser } from "../../api/auth";
import { CustomerAvatar } from "./CustomerAvatar";
import logo from "../../assets/logo in white.png";

export type CustomerSection = "Explore" | "My orders" | "Profile settings";

interface Props {
  user: AuthUser;
  section: CustomerSection;
  onNavigate: (section: CustomerSection) => void;
  onLogout: () => void;
  cartCount: number;
  onCart: () => void;
  children: ReactNode;
}

const sections = [
  { name: "Explore", icon: FaLayerGroup },
  { name: "My orders", icon: FaShoppingBag },
  { name: "Profile settings", icon: FaCog },
] as const;

export function CustomerLayout({
  user,
  section,
  onNavigate,
  onLogout,
  cartCount,
  onCart,
  children,
}: Props) {
  const [menuOpen, setMenuOpen] = useState(false);
  return (
    <div className="customer-app">
      {menuOpen && (
        <button
          className="customer-sidebar-backdrop"
          aria-label="Close navigation"
          onClick={() => setMenuOpen(false)}
        />
      )}
      <aside className={`customer-sidebar${menuOpen ? " is-open" : ""}`}>
        <div className="customer-sidebar-brand">
          <img src={logo} alt="Blackeyes" />
          <button
            className="customer-mobile-toggle"
            aria-label="Close navigation"
            onClick={() => setMenuOpen(false)}
          >
            <FaTimes />
          </button>
        </div>
        <span className="customer-kicker">YOUR CREATIVE SPACE</span>
        <nav aria-label="Customer navigation">
          {sections.map(({ name, icon: Icon }) => (
            <button
              key={name}
              className={section === name ? "is-active" : ""}
              aria-current={section === name ? "page" : undefined}
              onClick={() => {
                onNavigate(name);
                setMenuOpen(false);
              }}
            >
              <Icon />
              <span>{name}</span>
              {section === name && (
                <FaArrowRight className="customer-nav-arrow" />
              )}
            </button>
          ))}
        </nav>
        <div className="customer-sidebar-note">
          <span className="customer-print-mark" aria-hidden="true">
            ✳
          </span>
          <strong>
            Big ideas.
            <br />
            Beautifully printed.
          </strong>
          <p>
            From your first sketch to the final finish. We’re here to make it
            happen.
          </p>
        </div>
        <div className="customer-sidebar-account">
          <CustomerAvatar user={user} />
          <div>
            <strong>{user.full_name}</strong>
            <span>{user.email}</span>
          </div>
        </div>
      </aside>
      <div className="customer-main">
        <header className="customer-topbar">
          <div className="customer-topbar-title">
            <button
              className="customer-mobile-toggle"
              aria-label="Open navigation"
              onClick={() => setMenuOpen(true)}
            >
              <FaBars />
            </button>
            <div>
              <span className="customer-kicker">
                BLACKEYES / CUSTOMER STUDIO
              </span>
              <h1>{section}</h1>
            </div>
          </div>
          <div className="customer-topbar-actions">
            <button
              className="customer-basket-button"
              onClick={onCart}
              aria-label={`Open basket, ${cartCount} items`}
            >
              <FaShoppingBag />
              <span>Basket</span>
              <b>{cartCount}</b>
            </button>
            <Dropdown align="end">
              <Dropdown.Toggle
                variant=""
                className="customer-avatar-trigger"
                aria-label="Open account menu"
              >
                <CustomerAvatar user={user} />
                <FaChevronDown size={10} />
              </Dropdown.Toggle>
              <Dropdown.Menu className="customer-account-menu">
                <div>
                  <strong>{user.full_name}</strong>
                  <small>{user.email}</small>
                </div>
                <Dropdown.Item onClick={() => onNavigate("Profile settings")}>
                  <FaCog /> Profile settings
                </Dropdown.Item>
                <Dropdown.Divider />
                <Dropdown.Item onClick={onLogout}>
                  <FaSignOutAlt /> Log out
                </Dropdown.Item>
              </Dropdown.Menu>
            </Dropdown>
          </div>
        </header>
        {children}
        <footer className="customer-footer">
          Made for your next big idea. <span>BLACKEYES PRINT STUDIO</span>
        </footer>
      </div>
    </div>
  );
}
