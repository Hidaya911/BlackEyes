import React, { useState } from 'react';
import { Container, Row, Col, Form, Button, InputGroup } from 'react-bootstrap';
import { FaEye, FaEyeSlash, FaArrowLeft, FaEnvelope, FaLock, FaUser, FaCheckCircle } from 'react-icons/fa';
import logo from '../../assets/logo in white.png';
import signupImage from '../../assets/colors.png'; // same brand photo used on the login page — swap if you want a different shot
import { signup, type AuthUser } from '../../api/auth';

interface SignupPageProps {
  onNavigateToLogin?: () => void;
  onSignupSuccess?: (user: AuthUser) => void;
  onNavigateHome?: () => void;
}

export const SignupPage: React.FC<SignupPageProps> = ({ onNavigateToLogin, onSignupSuccess, onNavigateHome }) => {
  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');
  const [address, setAddress] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [agreed, setAgreed] = useState(false);

  const passwordsMismatch = confirmPassword.length > 0 && password !== confirmPassword;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (submitting || passwordsMismatch || !agreed) return;
    setSubmitting(true);
    setErrorMessage('');
    try {
      const user = await signup(fullName, email, password, phone, address);
      onSignupSuccess?.(user);
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'Unable to create the account.');
    } finally {
      setSubmitting(false);
    }
  };

  const perks = [
    { text: 'Track every order live, from prepress to pickup', color: '#00d2ff' },
    { text: 'Reorder past jobs in a couple of taps', color: '#ff007f' },
    { text: 'Save specs, files and delivery details for next time', color: '#ffcc00' },
  ];

  return (
    <div className="min-vh-100 d-flex align-items-center justify-content-center position-relative" style={{ backgroundColor: '#070a13' }}>
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

        .be-submit {
          background: linear-gradient(90deg, #00d2ff, #ff007f);
          transition: transform .15s ease, box-shadow .15s ease;
        }
        .be-submit:hover:not(:disabled) {
          transform: translateY(-1px);
          box-shadow: 0 10px 24px -8px rgba(255, 0, 127, 0.55);
        }
        .be-submit:disabled { opacity: 0.55; }

        .be-form-panel { background-color: #fff; }
        @media (max-width: 991.98px) {
          .be-form-panel {
            background-image: linear-gradient(180deg, rgba(7,10,19,0.72) 0%, rgba(7,10,19,0.9) 100%), url(${signupImage});
            background-size: cover;
            background-position: center;
          }
        }
      `}</style>

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
          {/* Form column sits on the LEFT this time — mirrored from the login page for visual variety */}
          <Col
            lg={6}
            className="be-form-panel d-flex align-items-center justify-content-center p-4 p-sm-5 position-relative overflow-hidden order-2 order-lg-1"
          >
            <div className="w-100 position-relative" style={{ maxWidth: '440px', zIndex: 1 }}>
              <div className="position-relative border rounded-4 p-4 p-sm-5 shadow-sm bg-white" style={{ borderColor: '#eef0f3' }}>
                <div
                  className="position-absolute top-0 start-0 rounded-top-4"
                  style={{ height: '5px', width: '100%', background: 'linear-gradient(90deg, #ffcc00, #00d2ff 50%, #ff007f)' }}
                ></div>

                <div className="be-corner" style={{ top: '14px', left: '14px' }}></div>
                <div className="be-corner" style={{ top: '14px', right: '14px' }}></div>
                <div className="be-corner" style={{ bottom: '14px', left: '14px' }}></div>
                <div className="be-corner" style={{ bottom: '14px', right: '14px' }}></div>

                <div className="d-flex align-items-center gap-2 mb-3">
                  <span style={{ width: 16, height: 16, borderRadius: '50%', border: '1.4px solid #00d2ff', position: 'relative', flex: 'none' }}>
                    <span style={{ position: 'absolute', width: 16, height: 1.2, background: '#00d2ff', left: 0, top: 7 }}></span>
                    <span style={{ position: 'absolute', width: 1.2, height: 16, background: '#00d2ff', top: 0, left: 7 }}></span>
                  </span>
                  <span className="text-uppercase fw-semibold" style={{ fontSize: '0.7rem', letterSpacing: '1.5px', color: '#9aa0ab', fontFamily: 'monospace' }}>
                    Create account · Blackeyes
                  </span>
                </div>

                <h3 className="fw-bold text-dark mb-1" style={{ fontSize: '1.85rem' }}>Join the press floor</h3>
                <p className="text-muted mb-4" style={{ fontSize: '0.9rem' }}>Set up your account in under a minute</p>

                <Form onSubmit={handleSubmit}>
                  <Form.Group className="mb-3" controlId="formName">
                    <Form.Label className="text-dark fw-semibold" style={{ fontSize: '0.85rem' }}>Full name</Form.Label>
                    <InputGroup className="be-input-group rounded-3 overflow-hidden border" style={{ borderColor: '#e4e7ec' }}>
                      <InputGroup.Text className="bg-light border-0 text-secondary">
                        <FaUser size={13} />
                      </InputGroup.Text>
                      <Form.Control
                        type="text"
                        placeholder="Jordan Reyes"
                        value={fullName}
                        onChange={(e) => setFullName(e.target.value)}
                        required
                        className="be-input border-0 bg-light py-2.5 text-dark"
                        style={{ fontSize: '0.9rem', boxShadow: 'none' }}
                      />
                    </InputGroup>
                  </Form.Group>

                  <Form.Group className="mb-3" controlId="formEmail">
                    <Form.Label className="text-dark fw-semibold" style={{ fontSize: '0.85rem' }}>Email address</Form.Label>
                    <InputGroup className="be-input-group rounded-3 overflow-hidden border" style={{ borderColor: '#e4e7ec' }}>
                      <InputGroup.Text className="bg-light border-0 text-secondary">
                        <FaEnvelope size={13} />
                      </InputGroup.Text>
                      <Form.Control
                        type="email"
                        placeholder="you@example.com"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        required
                        className="be-input border-0 bg-light py-2.5 text-dark"
                        style={{ fontSize: '0.9rem', boxShadow: 'none' }}
                      />
                    </InputGroup>
                  </Form.Group>

                  <Form.Group className="mb-3" controlId="formPhone">
                    <Form.Label className="text-dark fw-semibold">Phone number <small className="text-muted">optional</small></Form.Label>
                    <Form.Control type="tel" autoComplete="tel" maxLength={50} value={phone} onChange={e => setPhone(e.target.value)} className="be-input bg-light" />
                  </Form.Group>
                  <Form.Group className="mb-3" controlId="formAddress">
                    <Form.Label className="text-dark fw-semibold">Address <small className="text-muted">optional</small></Form.Label>
                    <Form.Control as="textarea" rows={2} autoComplete="street-address" maxLength={500} value={address} onChange={e => setAddress(e.target.value)} className="be-input bg-light" />
                  </Form.Group>
                  <Form.Group className="mb-3" controlId="formPassword">
                    <Form.Label className="text-dark fw-semibold" style={{ fontSize: '0.85rem' }}>Password</Form.Label>
                    <InputGroup className="be-input-group rounded-3 overflow-hidden border" style={{ borderColor: '#e4e7ec' }}>
                      <InputGroup.Text className="bg-light border-0 text-secondary">
                        <FaLock size={13} />
                      </InputGroup.Text>
                      <Form.Control
                        type={showPassword ? 'text' : 'password'}
                        placeholder="At least 8 characters"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        required
                        minLength={8}
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

                  <Form.Group className="mb-3" controlId="formConfirmPassword">
                    <Form.Label className="text-dark fw-semibold" style={{ fontSize: '0.85rem' }}>Confirm password</Form.Label>
                    <InputGroup
                      className="be-input-group rounded-3 overflow-hidden border"
                      style={{ borderColor: passwordsMismatch ? '#ff007f' : '#e4e7ec' }}
                    >
                      <InputGroup.Text className="bg-light border-0 text-secondary">
                        <FaLock size={13} />
                      </InputGroup.Text>
                      <Form.Control
                        type={showConfirm ? 'text' : 'password'}
                        placeholder="Re-enter your password"
                        value={confirmPassword}
                        onChange={(e) => setConfirmPassword(e.target.value)}
                        required
                        className="be-input border-0 bg-light py-2.5 text-dark"
                        style={{ fontSize: '0.9rem', boxShadow: 'none' }}
                      />
                      <InputGroup.Text
                        className="bg-light border-0 text-secondary"
                        role="button"
                        onClick={() => setShowConfirm(!showConfirm)}
                        style={{ cursor: 'pointer' }}
                      >
                        {showConfirm ? <FaEyeSlash size={14} /> : <FaEye size={14} />}
                      </InputGroup.Text>
                    </InputGroup>
                    {passwordsMismatch && (
                      <div className="mt-1" style={{ fontSize: '0.78rem', color: '#ff007f' }}>Passwords don't match yet</div>
                    )}
                  </Form.Group>

                  <Form.Group className="mb-4" controlId="formTerms">
                    <Form.Check
                      type="checkbox"
                      id="agreeTerms"
                      checked={agreed}
                      onChange={(e) => setAgreed(e.target.checked)}
                      required
                      label={
                        <span className="text-muted" style={{ fontSize: '0.82rem' }}>
                          I agree to the{' '}
                          <a href="#terms" className="text-decoration-none" style={{ color: '#ff007f' }}>Terms</a>
                          {' '}and{' '}
                          <a href="#privacy" className="text-decoration-none" style={{ color: '#ff007f' }}>Privacy Policy</a>
                        </span>
                      }
                    />
                  </Form.Group>

                  {errorMessage && <div role="alert" className="alert alert-danger">{errorMessage}</div>}
                  <Button
                    type="submit"
                    disabled={submitting || passwordsMismatch || !agreed}
                    className="be-submit w-100 py-2.5 rounded-pill border-0 fw-semibold text-white mb-4"
                    style={{ fontSize: '0.95rem' }}
                  >
                    {submitting ? 'Creating account…' : 'Create account'}
                  </Button>

                  <div className="d-flex align-items-center gap-3 mb-4">
                    <hr className="flex-grow-1" style={{ borderColor: '#e4e7ec', opacity: 1 }} />
                    <span className="text-muted text-uppercase" style={{ fontSize: '0.7rem', letterSpacing: '1px' }}>Already a customer</span>
                    <hr className="flex-grow-1" style={{ borderColor: '#e4e7ec', opacity: 1 }} />
                  </div>

                  <Button
                    type="button"
                    variant="outline-dark"
                    className="w-100 py-2.5 rounded-pill fw-semibold"
                    style={{ fontSize: '0.9rem' }}
                    onClick={onNavigateToLogin}
                  >
                    Sign in instead
                  </Button>
                </Form>
              </div>
            </div>
          </Col>

          {/* Branding / perks column — on the RIGHT this time */}
          <Col
            lg={6}
            className="position-relative d-none d-lg-flex flex-column justify-content-between p-5 text-white overflow-hidden order-1 order-lg-2"
            style={{ backgroundColor: '#070a13' }}
          >
            <div
              className="position-absolute top-0 start-0 w-100 h-100"
              style={{
                backgroundImage: `linear-gradient(180deg, rgba(7, 10, 19, 0.7) 0%, rgba(7, 10, 19, 0.95) 100%), url(${signupImage})`,
                backgroundSize: 'cover',
                backgroundPosition: 'center',
                zIndex: 1,
              }}
            ></div>

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

            <div className="position-relative my-auto" style={{ zIndex: 2, maxWidth: '440px' }}>
              <span className="text-uppercase fw-bold mb-2 d-block" style={{ fontSize: '0.75rem', letterSpacing: '2px', color: '#ffcc00' }}>
                Why join
              </span>
              <h2 className="display-5 fw-bold mb-4">One account, the whole press floor.</h2>
              <div className="d-flex flex-column gap-3">
                {perks.map((perk, i) => (
                  <div key={i} className="d-flex align-items-start gap-3">
                    <FaCheckCircle size={18} color={perk.color} style={{ marginTop: '2px', flex: 'none' }} />
                    <span className="text-secondary" style={{ fontSize: '0.95rem', lineHeight: '1.5' }}>{perk.text}</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="position-relative text-secondary" style={{ zIndex: 2, fontSize: '0.8rem' }}>
              © 2026 BLACKEYES. ALL RIGHTS RESERVED.
            </div>
          </Col>
        </Row>
      </Container>
    </div>
  );
};
