import React, { useState } from 'react';
import { Navbar as BootstrapNavbar, Nav, Container, Form, Button } from 'react-bootstrap';
import { FaShoppingBag, FaUser } from 'react-icons/fa';
import logo from '../../assets/logo.png';

interface NavbarProps {
  onNavigateToLogin: () => void;
  onNavigateToSignup: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({ onNavigateToLogin, onNavigateToSignup }) => {
  const [expanded, setExpanded] = useState(false);
  const [showUserDropdown, setShowUserDropdown] = useState(false);

  return (
    <BootstrapNavbar
      expanded={expanded}
      expand="lg"
      bg="white"
      variant="light"
      className="py-3 px-4 border-bottom border-light shadow-sm position-relative"
    >
      <Container fluid className="px-lg-5" style={{ maxWidth: '1600px' }}>
        <BootstrapNavbar.Brand href="#home" className="d-flex align-items-center gap-3">
          <img
            src={logo}
            alt="Blackeyes Logo"
            style={{ height: '40px', objectFit: 'contain' }}
          />
          <div
            className="text-muted border-start ps-3 d-none d-sm-block"
            style={{
              fontSize: '0.75rem',
              lineHeight: '1.2',
              letterSpacing: '1px',
              fontFamily: 'monospace'
            }}
          >
            PRESS & PRINT CO<br />
            BLACKEYES
          </div>
        </BootstrapNavbar.Brand>

        {/* Mobile Action Icons (User with dropdown & Shopping Bag) + Hamburger Toggle */}
        <div className="d-flex align-items-center gap-3 d-lg-none position-relative">
          {/* User Icon with Dropdown for Mobile */}
          <div className="position-relative">
            <div
              className="text-dark cursor-pointer p-1"
              onClick={() => setShowUserDropdown(!showUserDropdown)}
            >
              <FaUser size={18} className="text-secondary" />
            </div>

            {showUserDropdown && (
              <div
                className="position-absolute shadow-sm bg-white rounded-3 p-3 border"
                style={{ right: 0, top: '40px', width: '200px', zIndex: 1050 }}
              >
                <div className="d-flex flex-column gap-2">
                  <Button
                    variant="outline-dark"
                    className="rounded-pill py-1.5 text-sm fw-medium w-100"
                    onClick={() => {
                      setShowUserDropdown(false);
                      onNavigateToLogin();
                    }}
                  >
                    Login
                  </Button>
                  <Button
                    className="rounded-pill py-1.5 text-sm fw-medium border-0 text-white w-100"
                    style={{ backgroundColor: '#070a13' }}
                    onClick={() => {
                      setShowUserDropdown(false);
                      onNavigateToSignup();
                    }}
                  >
                    Sign Up
                  </Button>
                </div>
              </div>
            )}
          </div>

          {/* Shopping Bag Icon for Mobile */}
          <div className="position-relative text-dark cursor-pointer p-1">
            <FaShoppingBag size={18} className="text-secondary" />
            <span
              className="position-absolute top-0 start-100 translate-middle badge rounded-pill"
              style={{ backgroundColor: '#ff007f', fontSize: '0.55rem' }}
            >
              0
            </span>
          </div>

          <BootstrapNavbar.Toggle
            aria-controls="responsive-navbar-nav"
            onClick={() => setExpanded(expanded ? false : true)}
          />
        </div>

        <BootstrapNavbar.Collapse id="responsive-navbar-nav">
          <Nav className="mx-auto align-items-lg-center gap-3 py-3 py-lg-0">
            <Nav.Link href="#home" className="text-dark fw-semibold active position-relative pb-1" onClick={() => setExpanded(false)}>
              Home
              <span className="position-absolute bottom-0 start-0 w-100 d-none d-lg-block" style={{ height: '2px', background: 'linear-gradient(90deg, #00d2ff, #ff007f)' }}></span>
            </Nav.Link>
            <Nav.Link href="#services" className="text-muted" onClick={() => setExpanded(false)}>Products</Nav.Link>
            <Nav.Link href="#about" className="text-muted" onClick={() => setExpanded(false)}>About</Nav.Link>
            <Nav.Link href="#contact" className="text-muted" onClick={() => setExpanded(false)}>Contact</Nav.Link>
          </Nav>

          {/* Desktop Actions */}
          <div className="d-flex align-items-center gap-3 mt-3 mt-lg-0">
            <Form className="position-relative d-none d-xl-block">
              <Form.Control
                type="search"
                placeholder="Search products, services..."
                className="bg-light border text-dark rounded-pill px-4 py-2"
                style={{ width: '250px', fontSize: '0.85rem' }}
              />
            </Form>

            <div className="position-relative text-dark cursor-pointer px-2 d-none d-lg-block">
              <FaShoppingBag size={20} className="text-secondary" />
              <span
                className="position-absolute top-0 start-100 translate-middle badge rounded-pill"
                style={{ backgroundColor: '#ff007f', fontSize: '0.6rem' }}
              >
                0
              </span>
            </div>

            <div className="d-none d-lg-flex align-items-center gap-3">
              <Button
                variant="outline-dark"
                className="rounded-pill px-4 py-1.5 text-sm fw-medium"
                onClick={onNavigateToLogin}
              >
                Login
              </Button>
              <Button
                className="rounded-pill px-4 py-1.5 text-sm fw-medium border-0 text-white"
                style={{ backgroundColor: '#070a13' }}
                onClick={onNavigateToSignup}
              >
                Sign Up
              </Button>
            </div>
          </div>
        </BootstrapNavbar.Collapse>
      </Container>
    </BootstrapNavbar>
  );
};
