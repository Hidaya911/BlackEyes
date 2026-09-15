import { useState } from 'react';
import 'bootstrap/dist/css/bootstrap.min.css';
import './index.css';

import { Navbar } from './components/Navbar';
import { Hero } from './components/Hero';
import { FeaturesBar } from './components/FeaturesBar';
import { Services } from './components/Services';
import { AboutSection } from './components/AboutSection';
import { Footer } from './components/Footer';
import { LoginPage } from './components/Login';
import { SignupPage } from './components/SignupPage';
import type { AuthUser, UserRole } from './api/auth';
import { AdminPage } from './components/AdminPage';
import { StaffPage } from './components/StaffPage';
import { CustomerPage } from './components/CustomerPage';

type Page = 'home' | 'login' | 'signup' | UserRole;

const STORAGE_KEY = 'blackeyes:page';
const USER_KEY = 'blackeyes:user';

// Read whatever page the user was last on, so a refresh doesn't bounce them back to home.
const getInitialPage = (): Page => {
  const stored = sessionStorage.getItem(STORAGE_KEY);
  return stored === 'login' || stored === 'signup' || stored === 'admin' || stored === 'staff' || stored === 'customer'
    ? stored
    : 'home';
};

export function App() {
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
  const goToHome = () => navigate('home');
  const handleLogin = (user: AuthUser) => { sessionStorage.setItem(USER_KEY, JSON.stringify(user)); setCurrentUser(user); navigate(user.role); };
  const logout = () => { sessionStorage.removeItem(USER_KEY); goToHome(); };

  if (page === 'login') {
    return (
      <LoginPage
        onLoginSuccess={handleLogin}
        onNavigateHome={goToHome}
        onNavigateToSignup={goToSignup}
      />
    );
  }

  if (page === 'signup') {
    return (
      <SignupPage
        onSignupSuccess={navigate}
        onNavigateHome={goToHome}
        onNavigateToLogin={goToLogin}
      />
    );
  }

  if (page === 'admin') return <AdminPage onNavigateHome={logout} adminId={currentUser?.user_id} user={currentUser} />;
  if (page === 'staff') return <StaffPage onNavigateHome={goToHome} />;
  if (page === 'customer') return <CustomerPage onNavigateHome={goToHome} />;

  return (
    <div className="min-vh-100 d-flex flex-column">
      <Navbar onNavigateToLogin={goToLogin} onNavigateToSignup={goToSignup} />
      <Hero onStartProject={goToLogin} />
      <FeaturesBar />
      <Services />
      <AboutSection />
      <Footer />
    </div>
  );
}

export default App;
