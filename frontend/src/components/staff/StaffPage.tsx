import { useEffect, useState } from "react";
import { Dropdown } from "react-bootstrap";
import {
  FaBars,
  FaClipboardList,
  FaCog,
  FaPlus,
  FaSignOutAlt,
  FaTimes,
  FaChevronDown,
} from "react-icons/fa";
import type { AuthUser } from "../../api/auth";
import { getPressProfile } from "../../api/press";
import { OrderManager } from "../press/OrderManager";
import { DocumentCenter } from '../press/documents/DocumentCenter';
import { WalkInOrder } from "../press/WalkInOrder";
import { StaffSettings } from "./StaffSettings";
import { ProfileAvatar } from "./ProfileAvatar";
import logo from "../../assets/logo in white.png";
import "../../style/PressWorkspace.css";

const sections = [
  ["Orders", FaClipboardList],
  ["New walk-in order", FaPlus],
  ["Invoices & receipts", FaClipboardList],
  ["Settings", FaCog],
] as const;
type Section = (typeof sections)[number][0];

export function StaffPage({
  onLogout,
  onProfileSaved,
}: {
  onLogout: () => void;
  onProfileSaved: (user: AuthUser) => void;
}) {
  const [profile, setProfile] = useState<AuthUser | null>(null);
  const [section, setSection] = useState<Section>("Orders");
  const [menu, setMenu] = useState(false);
  const [error, setError] = useState("");
  const [reload, setReload] = useState(0);
  const [notice, setNotice] = useState("");

  useEffect(() => {
    const controller = new AbortController();
    getPressProfile(controller.signal)
      .then(setProfile)
      .catch((failure: Error) => {
        if (!controller.signal.aborted) setError(failure.message);
      });
    return () => controller.abort();
  }, [reload]);

  function navigate(next: Section) {
    setSection(next);
    setMenu(false);
    setNotice("");
  }
  function saveProfile(user: AuthUser) {
    setProfile(user);
    onProfileSaved(user);
  }

  if (!profile)
    return (
      <main className="press-loading">
        <div className="counter-panel">
          <h2>Your press workspace</h2>
          {error ? (
            <>
              <p role="alert">{error}</p>
              <button
                className="btn press-primary me-2"
                onClick={() => { setError(""); setReload((value) => value + 1); }}
              >
                Retry
              </button>
              <button className="btn btn-light" onClick={onLogout}>
                Sign in again
              </button>
            </>
          ) : (
            <p role="status">Opening your workspace…</p>
          )}
        </div>
      </main>
    );

  return (
    <main className="staff-workspace">
      {menu && (
        <button
          className="staff-menu-shade"
          aria-label="Close navigation"
          onClick={() => setMenu(false)}
        />
      )}
      <aside className={`staff-sidebar${menu ? " is-open" : ""}`}>
        <div className="staff-brand">
          <img src={logo} alt="Blackeyes" />
          <button
            className="staff-menu-close"
            aria-label="Close navigation"
            onClick={() => setMenu(false)}
          >
            <FaTimes />
          </button>
        </div>
        <span className="staff-sidebar-caption">THE PRESS FLOOR</span>
        <nav aria-label="Staff workspace">
          {sections.map(([name, Icon]) => (
            <button
              key={name}
              className={section === name ? "active" : ""}
              aria-current={section === name ? "page" : undefined}
              onClick={() => navigate(name)}
            >
              <Icon />
              {name}
            </button>
          ))}
        </nav>
        <div className="staff-sidebar-note">
          <span className="press-kicker">FROM COUNTER TO CREATION</span>
          <p>Good details make great prints.</p>
          <small>
            Capture the brief. Check the artwork. Keep every job moving.
          </small>
        </div>
        <div className="staff-sidebar-account">
          <ProfileAvatar user={profile} />
          <div>
            <strong>{profile.full_name}</strong>
            <small>Press staff</small>
          </div>
        </div>
        <button className="staff-logout" onClick={onLogout}>
          <FaSignOutAlt /> Log out
        </button>
      </aside>
      <section className="staff-content">
        <header className="staff-topbar">
          <button
            className="staff-menu-toggle"
            aria-label="Open navigation"
            aria-expanded={menu}
            onClick={() => setMenu(true)}
          >
            <FaBars />
          </button>
          <div className="staff-heading">
            <span>
              <i /> BLACKEYES / STAFF WORKSPACE
            </span>
            <h1>{section}</h1>
          </div>
          <Dropdown align="end">
            <Dropdown.Toggle
              variant=""
              className="staff-profile-trigger"
              id="staff-account-menu"
            >
              <ProfileAvatar user={profile} />
              <span>
                <strong>{profile.full_name}</strong>
                <small>Press staff</small>
              </span>
              <FaChevronDown />
            </Dropdown.Toggle>
            <Dropdown.Menu>
              <Dropdown.Header>{profile.email}</Dropdown.Header>
              <Dropdown.Item onClick={() => navigate("Settings")}>
                <FaCog className="me-2" />
                Profile settings
              </Dropdown.Item>
              <Dropdown.Divider />
              <Dropdown.Item onClick={onLogout}>
                <FaSignOutAlt className="me-2" />
                Log out
              </Dropdown.Item>
            </Dropdown.Menu>
          </Dropdown>
        </header>
        {notice && (
          <div className="alert alert-success" role="status">
            {notice}
          </div>
        )}
        {section === "Orders" && (
          <OrderManager onCreate={() => navigate("New walk-in order")} />
        )}
        {section === 'Invoices & receipts' && <DocumentCenter />}
        {section === "New walk-in order" && (
          <WalkInOrder
            onCancel={() => navigate("Orders")}
            onCreated={(order) => {
              setSection("Orders");
              setNotice(
                `Order #${order.order_id} created for ${order.customer_name}. It is ready for review.`,
              );
            }}
          />
        )}
        {section === "Settings" && (
          <StaffSettings
            user={profile}
            onSaved={saveProfile}
            onLogout={onLogout}
          />
        )}
      </section>
    </main>
  );
}
