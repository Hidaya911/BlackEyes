import React from 'react';
import { Container, Row, Col, Card, Button } from 'react-bootstrap';

export const Services: React.FC = () => {
  const products = [
    { title: 'Business Cards', specs: '350gsm · matte / gloss', price: '$35', img: 'https://images.unsplash.com/photo-1589829545856-d10d557cf95f?auto=format&fit=crop&w=500&q=80' },
    { title: 'Flyers', specs: 'A5 / A4 · double-sided', price: '$50', img: 'https://images.unsplash.com/photo-1541701494587-cb58502866ab?auto=format&fit=crop&w=500&q=80' },
    { title: 'Brochures', specs: 'tri-fold · saddle stitch', price: '$45', img: 'https://images.unsplash.com/photo-1626785774573-4b799315345d?auto=format&fit=crop&w=500&q=80' },
    { title: 'Posters', specs: 'large format · vinyl', price: '$60', img: 'https://images.unsplash.com/photo-1572044162444-ad60f128bdea?auto=format&fit=crop&w=500&q=80' },
  ];

  return (
    <section id="services" className="py-5 bg-white border-0" style={{ borderTop: 'none !important' }}>
      <Container fluid className="px-5" style={{ maxWidth: '1600px' }}>
        <div className="d-flex justify-content-between align-items-end mb-5 flex-wrap gap-3">
          <div>
            <div className="d-flex align-items-center gap-2 mb-2">
              <span style={{ width: '8px', height: '3px', backgroundColor: '#00d2ff', display: 'inline-block' }}></span>
              <span style={{ width: '8px', height: '3px', backgroundColor: '#ff007f', display: 'inline-block' }}></span>
              <span style={{ width: '8px', height: '3px', backgroundColor: '#ffcc00', display: 'inline-block' }}></span>
              <span className="text-uppercase text-muted fw-bold" style={{ fontSize: '0.7rem', letterSpacing: '1px' }}>Our Services</span>
            </div>
            <h2 className="fw-bold display-6 text-dark mb-2" style={{ fontFamily: 'sans-serif' }}>Popular Products</h2>
            <p className="text-muted mb-0" style={{ fontSize: '0.9rem', maxWidth: '600px' }}>
              High-quality printing solutions for all your needs. Choose from our most popular products or customize your own.
            </p>
          </div>
          <Button className="rounded-pill px-4 py-2 bg-dark text-white border-0 fw-semibold">
            View All Products →
          </Button>
        </div>

        <Row className="g-4">
          {products.map((item, idx) => (
            <Col lg={3} sm={6} xs={12} key={idx}>
              <Card className="border-0 shadow-sm rounded-4 overflow-hidden h-100 bg-light">
                <div style={{ height: '220px', overflow: 'hidden' }}>
                  <Card.Img variant="top" src={item.img} className="w-100 h-100 object-fit-cover" />
                </div>
                <Card.Body className="d-flex flex-column justify-content-between p-4">
                  <div>
                    <Card.Title className="fw-bold fs-6 mb-1 text-dark" style={{ fontFamily: 'sans-serif' }}>{item.title}</Card.Title>
                    <Card.Text className="text-muted fs-7 mb-3" style={{ fontSize: '0.75rem' }}>{item.specs}</Card.Text>
                  </div>
                  <div className="d-flex justify-content-between align-items-center pt-3 border-top" style={{ borderColor: '#e2e8f0 !important' }}>
                    <span className="text-muted text-uppercase fw-semibold" style={{ fontSize: '0.7rem', letterSpacing: '0.5px' }}>From</span>
                    <span className="fw-bold fs-6 text-dark">{item.price}</span>
                  </div>
                </Card.Body>
              </Card>
            </Col>
          ))}
        </Row>
      </Container>
    </section>
  );
};
