import React from 'react';

import { Container, Row, Col, Button } from 'react-bootstrap';

import image from '../../assets/machine.jpg';

interface HeroProps {
  onStartProject: () => void;
}

export const Hero: React.FC<HeroProps> = ({ onStartProject }) => {
  return (
    <div
      id="home"
      className="text-white py-5 position-relative overflow-hidden"
      style={{ backgroundColor: '#070a13' }}
    >
      {/* Corner Brackets */}
      <div
        className="position-absolute top-0 start-0 m-4 d-none d-lg-block pointer-events-none"
        style={{
          width: '24px',
          height: '24px',
          borderTop: '2px solid #334155',
          borderLeft: '2px solid #334155',
          zIndex: 2,
        }}
      ></div>

      <div
        className="position-absolute bottom-0 start-0 m-4 d-none d-lg-block pointer-events-none"
        style={{
          width: '24px',
          height: '24px',
          borderBottom: '2px solid #334155',
          borderLeft: '2px solid #334155',
          zIndex: 2,
        }}
      ></div>

      <div
        className="position-absolute top-0 end-0 m-4 d-none d-lg-block pointer-events-none"
        style={{
          width: '24px',
          height: '24px',
          borderTop: '2px solid #334155',
          borderRight: '2px solid #334155',
          zIndex: 2,
        }}
      ></div>

      <div
        className="position-absolute bottom-0 end-0 m-4 d-none d-lg-block pointer-events-none"
        style={{
          width: '24px',
          height: '24px',
          borderBottom: '2px solid #334155',
          borderRight: '2px solid #334155',
          zIndex: 2,
        }}
      ></div>

      <Container fluid className="px-5 py-4 position-relative">
        <Row
          className="align-items-center justify-content-between g-5"
          style={{ maxWidth: '1600px', margin: '0 auto' }}
        >
          <Col lg={6} className="text-start ps-lg-5">
            <div className="d-flex align-items-center gap-2 mb-4">
              <span
                style={{
                  width: '8px',
                  height: '3px',
                  backgroundColor: '#00d2ff',
                  display: 'inline-block',
                }}
              ></span>

              <span
                style={{
                  width: '8px',
                  height: '3px',
                  backgroundColor: '#ff007f',
                  display: 'inline-block',
                }}
              ></span>

              <span
                style={{
                  width: '8px',
                  height: '3px',
                  backgroundColor: '#ffcc00',
                  display: 'inline-block',
                }}
              ></span>

              <span
                className="text-uppercase text-secondary tracking-widest fw-semibold"
                style={{
                  fontSize: '0.7rem',
                  letterSpacing: '2px',
                  color: '#94a3b8',
                }}
              >
                PROFESSIONAL PRINTING SOLUTIONS
              </span>
            </div>

            <h1
              className="display-4 fw-bold mb-4 lh-tight"
              style={{ fontFamily: 'sans-serif' }}
            >
              Your ideas, printed to{' '}
              <span style={{ color: '#00d2ff' }}>perfection</span>.
            </h1>

            <p
              className="text-secondary mb-4 fs-6"
              style={{
                maxWidth: '500px',
                lineHeight: '1.6',
                color: '#94a3b8',
              }}
            >
              From business cards to large-format prints, every job runs
              through full color calibration before it ever leaves the press —
              so what you see is exactly what you get.
            </p>

            <div className="d-flex flex-wrap gap-3 mb-5">
              <Button
                className="rounded-pill px-4 py-2 border-0 fw-semibold text-white"
                style={{
                  background: 'linear-gradient(90deg, #00d2ff, #ff007f)',
                }}
                onClick={onStartProject}
              >
                Start a project →
              </Button>

              <Button
                variant="outline-secondary"
                className="rounded-pill px-4 py-2 text-white bg-transparent"
                style={{ borderColor: '#334155' }}
              >
                See our work
              </Button>
            </div>

            <Row
              className="pt-4 border-top text-secondary g-4"
              style={{
                borderColor: '#1e293b !important',
                fontSize: '0.85rem',
              }}
            >
              <Col xs={4}>
                <strong className="text-white d-block fs-5 fw-bold">
                  24 hrs
                </strong>

                <span
                  style={{
                    fontSize: '0.75rem',
                    color: '#94a3b8',
                  }}
                >
                  standard turnaround
                </span>
              </Col>

              <Col xs={4}>
                <strong className="text-white d-block fs-5 fw-bold">
                  3–5 days
                </strong>

                <span
                  style={{
                    fontSize: '0.75rem',
                    color: '#94a3b8',
                  }}
                >
                  custom orders
                </span>
              </Col>

              <Col xs={4}>
                <strong className="text-white d-block fs-5 fw-bold">
                  500+
                </strong>

                <span
                  style={{
                    fontSize: '0.75rem',
                    color: '#94a3b8',
                  }}
                >
                  studios & brands served
                </span>
              </Col>
            </Row>
          </Col>

          {/* Right column holding the image and CMYK bars */}
          <Col
            lg={6}
            className="position-relative d-flex justify-content-center pe-lg-5"
          >
            <div
              className="position-relative w-100"
              style={{ maxWidth: '680px' }}
            >
              {/* Image with thin glowing blue border */}
              <div
                className="rounded-4 overflow-hidden shadow-lg w-100"
                style={{
                  backgroundColor: '#0d1322',
                  border: '1px solid rgba(0, 210, 255, 0.8)',
                  boxShadow:
                    '0 0 8px rgba(0, 210, 255, 0.35), 0 0 20px rgba(0, 210, 255, 0.15)',
                }}
              >
                <img
                  src={image}
                  alt="Printing Press Machine with Vibrant Colors"
                  className="w-100 object-fit-cover"
                  style={{ height: '440px' }}
                />
              </div>

              {/* CMYK Color Bars */}
              <div
                className="position-absolute d-none d-xl-flex flex-column gap-1 align-items-center"
                style={{
                  right: '-35px',
                  top: '50%',
                  transform: 'translateY(-50%)',
                  zIndex: 3,
                }}
              >
                <span
                  style={{
                    width: '4px',
                    height: '24px',
                    backgroundColor: '#00d2ff',
                    display: 'block',
                  }}
                ></span>

                <span
                  style={{
                    width: '4px',
                    height: '24px',
                    backgroundColor: '#ff007f',
                    display: 'block',
                  }}
                ></span>

                <span
                  style={{
                    width: '4px',
                    height: '24px',
                    backgroundColor: '#ffcc00',
                    display: 'block',
                  }}
                ></span>

                <span
                  style={{
                    width: '4px',
                    height: '24px',
                    backgroundColor: '#ffffff',
                    display: 'block',
                  }}
                ></span>
              </div>
            </div>
          </Col>
        </Row>
      </Container>
    </div>
  );
};