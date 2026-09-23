import { lazy, Suspense, useState } from 'react';
import 'bootstrap/dist/css/bootstrap.min.css';
import './index.css';

import { LoginPage } from './components/auth/Login';
import { SignupPage } from './components/auth/SignupPage';
import type { AuthUser, UserRole } from './api/auth';
const AdminPage = lazy(() => import('./components/admin/AdminPage').then(module => ({ default: module.AdminPage })));
const StaffPage = lazy(() => import('./components/staff/StaffPage').then(module => ({ default: module.StaffPage })));
import { CustomerPage } from './components/customer/CustomerPage';
import { ResetPasswordPage } from './components/auth/ResetPasswordPage';
import { ForgotPasswordPage } from './components/auth/ForgotPasswordPage';

type Page = 'home' | 'login' | 'signup' | 'forgot' | 'reset' | UserRole;

const STORAGE_KEY = 'blackeyes:page';
const USER_KEY = 'blackeyes:user';

// Read whatever page the user was last on, so a refresh doesn't bounce them back to home.
const getInitialPage = (): Page => {
  const stored = sessionStorage.getItem(STORAGE_KEY);
  if (new URLSearchParams(window.location.search).has('reset_token')) return 'reset';
  return stored === 'login' || stored === 'signup' || stored === 'forgot' || stored === 'admin' || stored === 'staff' || stored === 'customer' || stored === 'wholesaler'
    ? stored
    : 'home';
};

export function App() {
  return <Suspense fallback={<p className="text-center p-5" role="status">Loading workspace…</p>}><AppContent /></Suspense>;
}

function AppContent() {
  const [page, setPage] = useState<Page>(getInitialPage);
  const [currentUser, setCurrentUser] = useState<AuthUser | null>(() => {
    const stored = sessionStorage.getItem(USER_KEY);
    return stored ? JSON.parse(stored) as AuthUser : null;
  });

  const navigate = (target: Page) => {
    sessionStorage.setItem(STORAGE_KEY, target);
    setPage(target);
  };

  const goToLogin = () => navigate('login');
  const goToSignup = () => navigate('signup');
  const goToForgot = () => navigate('forgot');
  const goToHome = () => navigate('home');
  const handleLogin = (user: AuthUser) => { sessionStorage.setItem(USER_KEY, JSON.stringify(user)); setCurrentUser(user); navigate(user.role === 'customer' || user.role === 'wholesaler' ? 'home' : user.role); };
  const logout = () => {
    void fetch('/api/auth/logout', { method: 'POST' }).catch(() => undefined).finally(() => {
      sessionStorage.removeItem(USER_KEY);
      setCurrentUser(null);
      goToHome();
    });
  };
  const saveCurrentProfile = (user: AuthUser) => {
    sessionStorage.setItem(USER_KEY, JSON.stringify(user));
    setCurrentUser(user);
  };

  if (page === 'login') {
    return (
      <LoginPage
        onLoginSuccess={handleLogin}
        onNavigateHome={goToHome}
        onNavigateToSignup={goToSignup}
        onNavigateToForgotPassword={goToForgot}
      />
    );
  }
  if (page === 'forgot') return <ForgotPasswordPage onLogin={goToLogin} />;

  if (page === 'signup') {
    return (
      <SignupPage
        onSignupSuccess={handleLogin}
        onNavigateHome={goToHome}
        onNavigateToLogin={goToLogin}
      />
    );
  }
  if (page === 'reset') return <ResetPasswordPage token={new URLSearchParams(window.location.search).get('reset_token') ?? ''} onLogin={goToLogin} />;

  if (page === 'admin') return <AdminPage onNavigateHome={logout} adminId={currentUser?.user_id} user={currentUser} />;
  if (page === 'staff') return <StaffPage onLogout={logout} onProfileSaved={saveCurrentProfile} />;
  return <CustomerPage key={currentUser?.user_id ?? 'guest'} user={currentUser} onLogin={goToLogin} onSignup={goToSignup} onLogout={logout} onProfileSaved={saveCurrentProfile} />;
}

export default App;
