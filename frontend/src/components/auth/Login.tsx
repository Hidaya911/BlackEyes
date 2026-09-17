import React, { useState } from 'react';
import { Container, Row, Col, Form, Button, InputGroup } from 'react-bootstrap';
import { FaEye, FaEyeSlash, FaArrowLeft, FaEnvelope, FaLock } from 'react-icons/fa';
import logo from '../../assets/logo in white.png';
import loginImage from '../../assets/colors.png'; // Update with your actual login side-banner image path if needed
import { login, type AuthUser } from '../../api/auth';

interface LoginPageProps {
  onNavigateToSignup?: () => void;
  onLoginSuccess?: (user: AuthUser) => void;
  onNavigateHome?: () => void;
  onNavigateToForgotPassword?: () => void;
}

export const LoginPage: React.FC<LoginPageProps> = ({ onNavigateToSignup, onLoginSuccess, onNavigateHome, onNavigateToForgotPassword }) => {
  const [email, setEmail] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(false);
  const [focusedField, setFocusedField] = useState<'email' | 'password' | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (submitting) return;
    setSubmitting(true);
    setErrorMessage('');
    try {
      const user = await login(email, password);
      onLoginSuccess?.(user);
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'Unable to sign in.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-vh-100 d-flex align-items-center justify-content-center position-relative" style={{ backgroundColor: '#070a13' }}>
      {/* local styles: glow pulse + focus rings + corner marks — kept scoped here so the component stays a single drop-in file */}
      <style>{`
        @keyframes bePulse {
          0%, 100% { opacity: 0.55; transform: scale(1); }
          50% { opacity: 0.85; transform: scale(1.08); }
        }
        @keyframes beDrift {
          0%, 100% { transform: translate(0, 0); }
          50% { transform: translate(6px, -6px); }
        }
        .be-logo-glow {
          position: absolute;
          inset: -46px;
          z-index: 1;
          pointer-events: none;
        }
        .be-logo-glow span {
          position: absolute;
          border-radius: 50%;
          filter: blur(26px);
          mix-blend-mode: screen;
          animation: bePulse 4.5s ease-in-out infinite, beDrift 7s ease-in-out infinite;
        }
        .be-logo-glow span.c1 { width: 90px; height: 90px; left: 6px;  top: 4px;  background: #00d2ff; animation-delay: 0s; }
        .be-logo-glow span.c2 { width: 80px; height: 80px; right: 0;  top: 22px; background: #ff007f; animation-delay: 0.6s; }
        .be-logo-glow span.c3 { width: 60px; height: 60px; left: 34%; bottom: -6px; background: #ffcc00; animation-delay: 1.2s; }

        .be-input:focus, .be-input-group:focus-within {
          box-shadow: 0 0 0 3px rgba(0, 210, 255, 0.18) !important;
          border-color: #00d2ff !important;
        }
        .be-corner {
          position: absolute;
          width: 14px;
          height: 14px;
          pointer-events: none;
        }
        .be-corner::before, .be-corner::after {
          content: '';
          position: absolute;
          background: #cfd4dc;
        }
        .be-corner::before { width: 14px; height: 1.4px; top: 6.3px; left: 0; }
        .be-corner::after  { width: 1.4px; height: 14px; left: 6.3px; top: 0; }

        .be-switch .form-check-input { cursor: pointer; }
        .be-switch .form-check-input:checked {
          background-color: #ff007f;
          border-color: #ff007f;
        }
        .be-submit {
          background: linear-gradient(90deg, #00d2ff, #ff007f);
          transition: transform .15s ease, box-shadow .15s ease;
        }
        .be-submit:hover {
          transform: translateY(-1px);
          box-shadow: 0 10px 24px -8px rgba(255, 0, 127, 0.55);
        }

        /* below the lg breakpoint the branding column is hidden, so give the form
           column the same background photo instead of leaving it plain white */
        .be-right-panel {
          background-color: #fff;
        }
        @media (max-width: 991.98px) {
          .be-right-panel {
            background-image: linear-gradient(180deg, rgba(7,10,19,0.72) 0%, rgba(7,10,19,0.9) 100%), url(${loginImage});
            background-size: cover;
            background-position: center;
          }
        }
      `}</style>

      {/* Back to home arrow — sits above everything, visible on every breakpoint */}
      {onNavigateHome && (
        <button
          type="button"
          onClick={onNavigateHome}
          className="btn d-flex align-items-center gap-2 position-absolute"
          style={{
            top: '20px',
            left: '20px',
            zIndex: 10,
            background: 'rgba(7,10,19,0.85)',
            border: '1px solid rgba(255,255,255,0.15)',
            borderRadius: '999px',
            padding: '8px 16px',
            color: '#fff',
            fontSize: '0.85rem',
            backdropFilter: 'blur(4px)',
            boxShadow: '0 4px 14px rgba(0,0,0,0.25)',
          }}
        >
          <FaArrowLeft size={13} />
          <span className="d-none d-sm-inline">Back to home</span>
        </button>
      )}

      <Container fluid className="h-100 p-0">
        <Row className="g-0 min-vh-100">
          {/* Left Side: Branding / Imagery Column */}
          <Col lg={6} className="position-relative d-none d-lg-flex flex-column justify-content-between p-5 text-white overflow-hidden" style={{ backgroundColor: '#070a13' }}>
            {/* Background Image / Overlay */}
            <div
              className="position-absolute top-0 start-0 w-100 h-100"
              style={{
                backgroundImage: `linear-gradient(180deg, rgba(7, 10, 19, 0.7) 0%, rgba(7, 10, 19, 0.95) 100%), url(${loginImage})`,
                backgroundSize: 'cover',
                backgroundPosition: 'center',
                zIndex: 1
              }}
            ></div>

            {/* Top Logo — with layered glow behind it */}
            <div className="position-relative" style={{ zIndex: 2, marginTop: '70px' }}>
              <div className="position-relative d-inline-block">
                <div className="be-logo-glow">
                  <span className="c1"></span>
                  <span className="c2"></span>
                  <span className="c3"></span>
                </div>
                <img
                  src={logo}
                  alt="Blackeyes Logo"
                  className="position-relative"
                  style={{
                    zIndex: 2,
                    height: '60px',
                    objectFit: 'contain',
                    filter: 'drop-shadow(0 0 14px rgba(0,210,255,0.45)) drop-shadow(0 0 26px rgba(255,0,127,0.3))',
                  }}
                />
              </div>
            </div>

            {/* Center Content / Tagline */}
            <div className="position-relative my-auto" style={{ zIndex: 2, maxWidth: '440px' }}>
              <span className="text-uppercase fw-bold mb-2 d-block" style={{ fontSize: '0.75rem', letterSpacing: '2px', color: '#00d2ff' }}>
                Your Printing Partner
              </span>
              <h2 className="display-5 fw-bold mb-3">Bring your creative visions to life.</h2>
              <p className="text-secondary mb-0" style={{ fontSize: '0.95rem', lineHeight: '1.6' }}>
                Manage your orders, track your progress and get the best professional printing experience with high-precision craft.
              </p>
            </div>

            {/* Bottom Footer Info */}
            <div className="position-relative text-secondary" style={{ zIndex: 2, fontSize: '0.8rem' }}>
              © 2026 BLACKEYES. ALL RIGHTS RESERVED.
            </div>
          </Col>

          {/* Right Side: Form */}
          <Col lg={6} className="be-right-panel d-flex align-items-center justify-content-center p-4 p-sm-5 position-relative overflow-hidden">
            <div className="w-100 position-relative" style={{ maxWidth: '440px', zIndex: 1 }}>
              <div className="position-relative border rounded-4 p-4 p-sm-5 shadow-sm bg-white" style={{ borderColor: '#eef0f3' }}>
                {/* CMYK accent bar */}
                <div
                  className="position-absolute top-0 start-0 rounded-top-4"
                  style={{ height: '5px', width: '100%', background: 'linear-gradient(90deg, #00d2ff, #ff007f 50%, #ffcc00)' }}
                ></div>

                <div className="be-corner" style={{ top: '14px', left: '14px' }}></div>
                <div className="be-corner" style={{ top: '14px', right: '14px' }}></div>

                <div className="d-flex align-items-center gap-2 mb-3">
                  <span style={{ width: 16, height: 16, borderRadius: '50%', border: '1.4px solid #ff007f', position: 'relative', flex: 'none' }}>
                    <span style={{ position: 'absolute', width: 16, height: 1.2, background: '#ff007f', left: 0, top: 7 }}></span>
                    <span style={{ position: 'absolute', width: 1.2, height: 16, background: '#ff007f', top: 0, left: 7 }}></span>
                  </span>
                  <span className="text-uppercase fw-semibold" style={{ fontSize: '0.7rem', letterSpacing: '1.5px', color: '#9aa0ab', fontFamily: 'monospace' }}>
                    Sign in · Blackeyes
                  </span>
                </div>

                <h3 className="fw-bold text-dark mb-1" style={{ fontSize: '1.85rem' }}>Welcome back</h3>
                <p className="text-muted mb-4" style={{ fontSize: '0.9rem' }}>Sign in to track orders and manage your account</p>

                <Form onSubmit={handleSubmit}>
                  <Form.Group className="mb-3" controlId="formEmail">
                    <Form.Label className="text-dark fw-semibold" style={{ fontSize: '0.85rem' }}>Email address</Form.Label>
                    <InputGroup
                      className={`be-input-group rounded-3 overflow-hidden border ${focusedField === 'email' ? '' : ''}`}
                      style={{ borderColor: '#e4e7ec' }}
                    >
                      <InputGroup.Text className="bg-light border-0 text-secondary">
                        <FaEnvelope size={13} />
                      </InputGroup.Text>
                      <Form.Control
                        type="email"
                        placeholder="you@example.com"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        onFocus={() => setFocusedField('email')}
                        onBlur={() => setFocusedField(null)}
                        required
                        className="be-input border-0 bg-light py-2.5 text-dark"
                        style={{ fontSize: '0.9rem', boxShadow: 'none' }}
                      />
                    </InputGroup>
                  </Form.Group>

                  <Form.Group className="mb-3" controlId="formPassword">
                    <div className="d-flex justify-content-between align-items-center mb-1">
                      <Form.Label className="text-dark fw-semibold mb-0" style={{ fontSize: '0.85rem' }}>Password</Form.Label>
                      <button type="button" onClick={onNavigateToForgotPassword} className="btn p-0 text-decoration-none" style={{ fontSize: '0.8rem', color: '#ff007f' }}>Forgot password?</button>
                    </div>
                    <InputGroup className="be-input-group rounded-3 overflow-hidden border" style={{ borderColor: '#e4e7ec' }}>
                      <InputGroup.Text className="bg-light border-0 text-secondary">
                        <FaLock size={13} />
                      </InputGroup.Text>
                      <Form.Control
                        type={showPassword ? 'text' : 'password'}
                        placeholder="Enter your password"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        onFocus={() => setFocusedField('password')}
                        onBlur={() => setFocusedField(null)}
                        required
                        className="be-input border-0 bg-light py-2.5 text-dark"
                        style={{ fontSize: '0.9rem', boxShadow: 'none' }}
                      />
                      <InputGroup.Text
                        className="bg-light border-0 text-secondary"
                        role="button"
                        onClick={() => setShowPassword(!showPassword)}
                        style={{ cursor: 'pointer' }}
                      >
                        {showPassword ? <FaEyeSlash size={14} /> : <FaEye size={14} />}
                      </InputGroup.Text>
                    </InputGroup>
                  </Form.Group>

                  <div className="mb-4 be-switch">
                    <Form.Check
                      type="switch"
                      id="rememberMe"
                      label="Keep me signed in"
                      checked={rememberMe}
                      onChange={(e) => setRememberMe(e.target.checked)}
                      className="text-muted"
                      style={{ fontSize: '0.85rem' }}
                    />
                  </div>

                  {errorMessage && <div role="alert" className="alert alert-danger">{errorMessage}</div>}
                  <Button
                    type="submit"
                    disabled={submitting}
                    className="be-submit w-100 py-2.5 rounded-pill border-0 fw-semibold text-white mb-4"
                    style={{ fontSize: '0.95rem' }}
                  >
                    {submitting ? 'Signing in…' : 'Sign in'}
                  </Button>

                  <div className="d-flex align-items-center gap-3 mb-4">
                    <hr className="flex-grow-1" style={{ borderColor: '#e4e7ec', opacity: 1 }} />
                    <span className="text-muted text-uppercase" style={{ fontSize: '0.7rem', letterSpacing: '1px' }}>New here</span>
                    <hr className="flex-grow-1" style={{ borderColor: '#e4e7ec', opacity: 1 }} />
                  </div>

                  <Button
                    type="button"
                    variant="outline-dark"
                    className="w-100 py-2.5 rounded-pill fw-semibold"
                    style={{ fontSize: '0.9rem' }}
                    onClick={onNavigateToSignup}
                  >
                    Create an account
                  </Button>
                </Form>
              </div>
            </div>
          </Col>
        </Row>
      </Container>
    </div>
  );
};
