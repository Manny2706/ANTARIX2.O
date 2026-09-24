import { useState, useEffect } from 'react'
import Splash from './components/Splash'
import Landing from './components/Landing'
import Dashboard from './components/Dashboard'
import SearchPage from './components/SearchPage'
import Signup from './components/Signup'
import Login from './components/Login'
import { AUTH_ENDPOINTS } from './config/api'

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

  // Fetch /api/auth/me to get current authenticated user data & user ID
  useEffect(() => {
    if (!token) return;

    const fetchMe = async () => {
      try {
        const response = await fetch(AUTH_ENDPOINTS.ME, {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`,
            'x-auth-token': token,
            'token': token
          }
        });
        if (response.ok) {
          const result = await response.json();
          if (result.success && result.data) {
            const userData = result.data;
            setUser(userData);
            setIsLoggedIn(true);
            localStorage.setItem('satquery_user', JSON.stringify(userData));
            localStorage.setItem('satquery_is_logged_in', 'true');
          }
        }
      } catch (err) {
        console.warn('Error fetching /api/auth/me:', err);
      }
    };

    fetchMe();
  }, [token]);

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

  const handleLoginSuccess = async (authData) => {
    const rawUserData = authData?.user || authData?.data || authData;
    const authToken = authData?.token || authData?.data?.token || localStorage.getItem('satquery_auth_token') || '';

    let userData = rawUserData;
    if (authToken) {
      setToken(authToken);
      localStorage.setItem('satquery_auth_token', authToken);
      try {
        const res = await fetch(AUTH_ENDPOINTS.ME, {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${authToken}`,
            'x-auth-token': authToken,
            'token': authToken
          }
        });
        if (res.ok) {
          const json = await res.json();
          if (json.success && json.data) {
            userData = json.data;
          }
        }
      } catch (err) {
        console.warn('Failed to fetch me on login success:', err);
      }
    }

    setIsLoggedIn(true);
    setUser(userData);
    localStorage.setItem('satquery_is_logged_in', 'true');
    localStorage.setItem('satquery_user', JSON.stringify(userData));

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
