import { useState, useEffect } from 'react'
import Splash from './components/Splash'
import Landing from './components/Landing'
import Dashboard from './components/Dashboard'
import SearchPage from './components/SearchPage'
import Signup from './components/Signup'
import Login from './components/Login'

function App() {
  const [isLoggedIn, setIsLoggedIn] = useState(() => {
    return localStorage.getItem('satquery_is_logged_in') === 'true';
  });

  const [user, setUser] = useState(() => {
    try {
      const stored = localStorage.getItem('satquery_user');
      return stored ? JSON.parse(stored) : null;
    } catch {
      return null;
    }
  });

  const [token, setToken] = useState(() => {
    return localStorage.getItem('satquery_auth_token') || '';
  });

  // Route Guard Function: Enforces route protection rules
  const getGuardedPage = (requestedPage, loggedIn) => {
    const page = (requestedPage || '').toLowerCase();
    
    // Protected Routes: Require Login
    if (page === 'dashboard' && !loggedIn) {
      return 'login';
    }
    
    // Auth Routes: If already logged in, redirect away from login/signup to searchpage
    if ((page === 'login' || page === 'signup') && loggedIn) {
      return 'searchpage';
    }

    if (['signup', 'login', 'dashboard', 'searchpage', 'landing'].includes(page)) {
      return page;
    }

    return 'splash';
  };

  const getInitialPage = () => {
    const hash = window.location.hash.replace('#', '').toLowerCase();
    const storedLoggedIn = localStorage.getItem('satquery_is_logged_in') === 'true';
    return getGuardedPage(hash, storedLoggedIn);
  };

  const [currentPage, setCurrentPage] = useState(getInitialPage);
  const [dashboardTab, setDashboardTab] = useState('dashboard');

  useEffect(() => {
    const handleHashChange = () => {
      const hash = window.location.hash.replace('#', '').toLowerCase();
      const safePage = getGuardedPage(hash, isLoggedIn);
      
      if (window.location.hash !== `#${safePage}`) {
        window.history.replaceState(null, '', `#${safePage}`);
      }
      setCurrentPage(safePage);
    };

    handleHashChange(); // Enforce protection on mount & auth change
    window.addEventListener('hashchange', handleHashChange);
    return () => window.removeEventListener('hashchange', handleHashChange);
  }, [isLoggedIn]);

  const navigateTo = (page) => {
    const safePage = getGuardedPage(page, isLoggedIn);
    window.location.hash = safePage;
    setCurrentPage(safePage);
  };

  const handleLoginSuccess = (authData) => {
    const userData = authData?.user || authData || { fullName: 'User', email: 'user@satquery.ai' };
    const authToken = authData?.token || '';

    setIsLoggedIn(true);
    setUser(userData);
    setToken(authToken);

    localStorage.setItem('satquery_is_logged_in', 'true');
    localStorage.setItem('satquery_user', JSON.stringify(userData));
    if (authToken) {
      localStorage.setItem('satquery_auth_token', authToken);
    }

    navigateTo('searchpage');
  };

  const handleLogout = () => {
    setIsLoggedIn(false);
    setUser(null);
    setToken('');

    localStorage.removeItem('satquery_is_logged_in');
    localStorage.removeItem('satquery_user');
    localStorage.removeItem('satquery_auth_token');

    navigateTo('searchpage');
  };

  const goToDashboard = (tab) => {
    setDashboardTab(tab);
    navigateTo('dashboard');
  };

  if (currentPage === 'login') {
    return (
      <Login
        onSignUp={() => navigateTo('signup')}
        onLoginSuccess={handleLoginSuccess}
      />
    );
  }

  if (currentPage === 'signup') {
    return (
      <Signup
        onSignIn={() => navigateTo('login')}
        onSignupSuccess={handleLoginSuccess}
      />
    );
  }

  if (currentPage === 'searchpage') {
    return (
      <SearchPage
        onNavigate={goToDashboard}
        isLoggedIn={isLoggedIn}
        user={user}
        onLogin={() => navigateTo('login')}
        onSignup={() => navigateTo('signup')}
        onLogout={handleLogout}
      />
    );
  }

  if (currentPage === 'dashboard') {
    return (
      <Dashboard
        initialTab={dashboardTab}
        onNewAnalysis={() => navigateTo('searchpage')}
        isLoggedIn={isLoggedIn}
        user={user}
        onLogout={handleLogout}
        onLogin={() => navigateTo('login')}
      />
    );
  }

  if (currentPage === 'landing') {
    return <Landing onGetStarted={() => navigateTo('searchpage')} />;
  }

  return (
    <Splash onFinish={() => navigateTo('landing')} />
  );
}

export default App;
