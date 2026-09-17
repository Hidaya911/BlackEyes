import React from 'react';
import type { UserRole } from '../../api/auth';

interface RolePageProps {
  role: UserRole;
  onNavigateHome: () => void;
}

export const RolePage: React.FC<RolePageProps> = ({ role, onNavigateHome }) => (
  <main className="min-vh-100 d-flex align-items-center justify-content-center bg-light">
    <div className="text-center">
      <h1 className="text-capitalize">{role} page</h1>
      <p className="text-muted">This page is ready for its future design.</p>
      <button type="button" className="btn btn-dark" onClick={onNavigateHome}>Back to home</button>
    </div>
  </main>
);
