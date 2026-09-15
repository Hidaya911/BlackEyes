import React from 'react';

interface CustomerPageProps {
  onNavigateHome: () => void;
}

export const CustomerPage: React.FC<CustomerPageProps> = ({ onNavigateHome }) => (
  <main className="min-vh-100 d-flex align-items-center justify-content-center bg-light">
    <div className="text-center">
      <h1>Customer page</h1>
      <p className="text-muted">This page is ready for its future design.</p>
      <button type="button" className="btn btn-dark" onClick={onNavigateHome}>Back to home</button>
    </div>
  </main>
);
