import React from 'react';

interface StaffPageProps {
  onNavigateHome: () => void;
}

export const StaffPage: React.FC<StaffPageProps> = ({ onNavigateHome }) => (
  <main className="min-vh-100 d-flex align-items-center justify-content-center bg-light">
    <div className="text-center">
      <h1>Staff page</h1>
      <p className="text-muted">This page is ready for its future design.</p>
      <button type="button" className="btn btn-dark" onClick={onNavigateHome}>Back to home</button>
    </div>
  </main>
);
