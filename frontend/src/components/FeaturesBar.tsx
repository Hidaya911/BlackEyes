import React from 'react';
import { Container, Row, Col } from 'react-bootstrap';

export const FeaturesBar: React.FC = () => {
  const features = [
    { num: '01', category: 'MATERIAL', title: 'High quality prints', desc: 'Crystal-clear results on professional-grade stock, checked against a calibrated proof.' },
    { num: '02', category: 'SCHEDULE', title: 'Fast turnaround', desc: 'Standard orders ship in 24 hours. Custom runs are ready in 3–5 business days.' },
    { num: '03', category: 'PAYMENT', title: 'Secure payments', desc: 'Pay online through Whish Money, or settle in cash when your order arrives.' },
    { num: '04', category: 'TRUST', title: 'Reliable & professional', desc: 'The press of choice for businesses, organizations and independent creators.' }
  ];

  return (
    <div className="pb-5" style={{ backgroundColor: 'white', marginTop: '0px', position: 'relative', zIndex: 5 }}>
      <Container fluid className="px-0">
        <Row className="g-0 border-top border-bottom" style={{ borderColor: '#e6dfd3 !important' }}>
          {features.map((feat, idx) => (
            <Col lg={3} sm={6} xs={12} key={idx} className="border-end border-bottom border-lg-bottom-0" style={{ borderColor: '#e6dfd3 !important' }}>
              <div className="p-4 p-lg-5">
                <div className="fw-bold mb-2" style={{ fontSize: '0.75rem', letterSpacing: '1px', color: '#ff007f' }}>
                  {feat.num} / {feat.category}
                </div>
                <h5 className="fw-bold mb-3 text-dark" style={{ fontFamily: 'sans-serif' }}>{feat.title}</h5>
                <p className="text-secondary mb-0" style={{ fontSize: '0.85rem', lineHeight: '1.6', color: '#64748b' }}>
                  {feat.desc}
                </p>
              </div>
            </Col>
          ))}
        </Row>
      </Container>
    </div>
  );
};