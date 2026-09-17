import React from 'react';
import { Container, Row, Col } from 'react-bootstrap';
import { FaPrint, FaUsers, FaFileAlt, FaStar } from 'react-icons/fa';
import logo from '../../assets/logo in white.png';

export const AboutSection: React.FC = () => {
  return (
    <section id="about" className="py-5 bg-white">
      <Container fluid className="px-lg-5" style={{ maxWidth: '1600px' }}>
        <Row className="g-4">
          {/* Left Banner Box with Dark Background, Image & Content */}
          <Col lg={7}>
            <div
              className="rounded-4 p-4 p-lg-5 text-white position-relative overflow-hidden shadow h-100 d-flex flex-column justify-content-between"
              style={{
                backgroundColor: '#070a13',
                backgroundImage:
                  'linear-gradient(100deg, rgba(7,10,19,0.94) 30%, rgba(7,10,19,0.55) 62%, rgba(7,10,19,0.12) 90%), url(https://images.unsplash.com/photo-1466690672306-5f92132f7248?auto=format&fit=crop&q=80&w=1400)',
                backgroundSize: 'cover',
                backgroundPosition: 'center',
                minHeight: '360px',
              }}
            >
              <div
                className="position-absolute"
                style={{
                  right: '34px',
                  bottom: '26px',
                  width: 0,
                  height: 0,
                  borderTop: '20px solid transparent',
                  borderBottom: '20px solid transparent',
                  borderRight: '30px solid #00AEEF',
                  opacity: 0.95,
                  zIndex: 1,
                }}
              />
              <div
                className="position-absolute"
                style={{
                  right: '10px',
                  bottom: '54px',
                  width: 0,
                  height: 0,
                  borderTop: '16px solid transparent',
                  borderBottom: '16px solid transparent',
                  borderLeft: '24px solid #ff007f',
                  opacity: 0.95,
                  zIndex: 1,
                }}
              />
              <div
                className="position-absolute rounded-circle"
                style={{
                  right: '26px',
                  bottom: '14px',
                  width: '14px',
                  height: '14px',
                  background: '#ffc107',
                  zIndex: 1,
                }}
              />

              <div style={{ position: 'relative', zIndex: 2 }}>
                <div className="mb-4">
                  <img
                    src={logo}
                    alt="Blackeyes Logo"
                    style={{
                      height: '46px',
                      objectFit: 'contain',
                    }}
                  />
                </div>
                <h3 className="fw-bold fs-2 mb-3 text-white">About Blackeyes</h3>
                <p className="text-white mb-4" style={{ fontSize: '0.9rem', lineHeight: '1.6', maxWidth: '420px', opacity: 0.9 }}>
                  We are a professional printing press committed to delivering high-quality print solutions with modern technology, fast service, and exceptional customer support.
                </p>
              </div>
            </div>
          </Col>

          {/* Right Stats Grid Box with White Background & Icons */}
          <Col lg={5}>
            <div className="bg-white rounded-4 p-4 shadow-sm border h-100 d-flex flex-column justify-content-center">
              <Row className="g-4">
                <Col xs={6} className="text-center">
                  <div
                    className="rounded-circle d-flex align-items-center justify-content-center mx-auto mb-2"
                    style={{ width: 44, height: 44, background: 'rgba(0,174,239,0.12)' }}
                  >
                    <FaPrint size={18} color="#00AEEF" />
                  </div>
                  <h3 className="fw-bold text-dark mb-1 fs-3">10+</h3>
                  <span className="text-muted" style={{ fontSize: '0.7rem', letterSpacing: '0.5px' }}>Years of Experience</span>
                </Col>
                <Col xs={6} className="text-center">
                  <div
                    className="rounded-circle d-flex align-items-center justify-content-center mx-auto mb-2"
                    style={{ width: 44, height: 44, background: 'rgba(255,0,127,0.10)' }}
                  >
                    <FaUsers size={18} color="#ff007f" />
                  </div>
                  <h3 className="fw-bold text-dark mb-1 fs-3">500+</h3>
                  <span className="text-muted" style={{ fontSize: '0.7rem', letterSpacing: '0.5px' }}>Happy Customers</span>
                </Col>
                <Col xs={6} className="text-center">
                  <div
                    className="rounded-circle d-flex align-items-center justify-content-center mx-auto mb-2"
                    style={{ width: 44, height: 44, background: 'rgba(255,193,7,0.15)' }}
                  >
                    <FaFileAlt size={18} color="#ffc107" />
                  </div>
                  <h3 className="fw-bold text-dark mb-1 fs-3">5K+</h3>
                  <span className="text-muted" style={{ fontSize: '0.7rem', letterSpacing: '0.5px' }}>Projects Completed</span>
                </Col>
                <Col xs={6} className="text-center">
                  <div
                    className="rounded-circle d-flex align-items-center justify-content-center mx-auto mb-2"
                    style={{ width: 44, height: 44, background: 'rgba(255,193,7,0.15)' }}
                  >
                    <FaStar size={18} color="#ffc107" />
                  </div>
                  <h3 className="fw-bold text-dark mb-1 fs-3">100%</h3>
                  <span className="text-muted" style={{ fontSize: '0.7rem', letterSpacing: '0.5px' }}>Customer Satisfaction</span>
                </Col>
              </Row>
            </div>
          </Col>
        </Row>
      </Container>
    </section>
  );
};
