import React from 'react';
import { Container, Row, Col } from 'react-bootstrap';
import { FaFacebookF, FaInstagram, FaTwitter } from 'react-icons/fa';
import logo from '../assets/logo in white.png';
 

export const Footer: React.FC = () => {
  return (
    <footer id="contact" className="bg-dark-custom text-white pt-5 pb-3 border-top border-secondary">
      <Container>
        <Row className="g-4 justify-content-between mb-5">
          <Col lg={4} sm={6}>
            <div className="mb-3">
              <img src={logo} alt="Blackeyes Logo" style={{ height: '45px' }} />
            </div>
            <p className="text-secondary" style={{ fontSize: '0.85rem', maxWidth: '300px' }}>
              A professional printing press bringing ideas to paper with precision, speed and craft.
            </p>
          </Col>

          <Col lg={2} sm={6}>
            <h6 className="fw-bold text-uppercase mb-3" style={{ fontSize: '0.8rem', letterSpacing: '1px' }}>Navigate</h6>
            <ul className="list-unstyled d-flex flex-column gap-2" style={{ fontSize: '0.85rem' }}>
              <li><a href="#home" className="text-secondary text-decoration-none">Home</a></li>
              <li><a href="#services" className="text-secondary text-decoration-none">Products</a></li>
              <li><a href="#about" className="text-secondary text-decoration-none">About</a></li>
              <li><a href="#contact" className="text-secondary text-decoration-none">Contact</a></li>
            </ul>
          </Col>

          <Col lg={2} sm={6}>
            <h6 className="fw-bold text-uppercase mb-3" style={{ fontSize: '0.8rem', letterSpacing: '1px' }}>Services</h6>
            <ul className="list-unstyled d-flex flex-column gap-2" style={{ fontSize: '0.85rem' }}>
              <li><a href="#business-cards" className="text-secondary text-decoration-none">Business Cards</a></li>
              <li><a href="#flyers" className="text-secondary text-decoration-none">Flyers</a></li>
              <li><a href="#brochures" className="text-secondary text-decoration-none">Brochures</a></li>
              <li><a href="#posters" className="text-secondary text-decoration-none">Posters</a></li>
            </ul>
          </Col>

          <Col lg={3} sm={6}>
            <h6 className="fw-bold text-uppercase mb-3" style={{ fontSize: '0.8rem', letterSpacing: '1px' }}>Connect</h6>
            <div className="d-flex gap-2">
              <a href="https://www.facebook.com/share/1JgazRA6D9/" className="btn btn-outline-secondary rounded-circle text-white d-flex align-items-center justify-content-center" style={{ width: '35px', height: '35px' }}><FaFacebookF size={14} /></a>
              <a href=" https://www.instagram.com/blackeyes.print?stkn=ZHl0bjhlNXo1eG1h" className="btn btn-outline-secondary rounded-circle text-white d-flex align-items-center justify-content-center" style={{ width: '35px', height: '35px' }}><FaInstagram size={14} /></a>
              
              <a href="#" className="btn btn-outline-secondary rounded-circle text-white d-flex align-items-center justify-content-center" style={{ width: '35px', height: '35px' }}><FaTwitter size={14} /></a>
            </div>
          </Col>
        </Row>

        <div className="border-top border-secondary pt-3 text-center text-secondary" style={{ fontSize: '0.75rem' }}>
          <div>© 2026 BLACKEYES. ALL RIGHTS RESERVED.</div>
        </div>
      </Container>
    </footer>
  );
};
