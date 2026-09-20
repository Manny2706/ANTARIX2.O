import React, { useState } from 'react';
import './Signup.css';
import heroImg from '../assets/signup-hero.jpg';
import { AUTH_ENDPOINTS } from '../config/api';

export default function Signup({ onSignIn, onSignupSuccess }) {
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [agreeTerms, setAgreeTerms] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setErrorMsg('');

    if (!fullName || !email || !password || !confirmPassword) {
      setErrorMsg('Please fill in all fields.');
      return;
    }

    if (password !== confirmPassword) {
      setErrorMsg('Passwords do not match.');
      return;
    }

    setLoading(true);

    try {
      const response = await fetch(AUTH_ENDPOINTS.REGISTER, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          fullName,
          email,
          password,
          confirmPassword,
        }),
      });

      const data = await response.json();

      if (response.ok && data.success) {
        if (onSignupSuccess) {
          onSignupSuccess({
            user: data.data?.user || { fullName, email },
            token: data.data?.token || '',
          });
        }
      } else {
        setErrorMsg(data.message || 'Registration failed. Please try again.');
      }
    } catch (err) {
      console.error('Registration error:', err);
      // Fallback local registration if network unreachable
      if (onSignupSuccess) {
        onSignupSuccess({
          user: { fullName, email },
          token: 'local_token_' + Date.now(),
        });
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="signup-container">
      <div className="signup-left">
        <div className="signup-logo">
          <svg width="38" height="37" viewBox="0 0 47 46" fill="none" stroke="black" strokeWidth="1.5" aria-hidden="true">
            <circle cx="23.5" cy="23" r="21"></circle>
            <ellipse cx="23.5" cy="23" rx="21" ry="6" transform="rotate(-25 23.5 23)"></ellipse>
            <circle cx="23.5" cy="23" r="3.5" fill="#00B4D8" stroke="none"></circle>
          </svg>
          <div className="signup-logo-text">
            SATQUERY <span className="ai-text">AI</span>
          </div>
        </div>

        <div className="signup-hero-card">
          <img src={heroImg} alt="Earth observation satellite view" className="signup-hero-img" />
        </div>

        <div className="signup-quote-sec">
          <h2 className="signup-quote-heading">
            &quot;Earth observation reimagined through the lens of intelligence.&quot;
          </h2>
          <div className="signup-quote-sub">
            SATQUERY AI &mdash; REMOTE SENSING INTELLIGENCE
          </div>
        </div>

        <div className="signup-tags">
          <span>OPTICAL</span>
          <span>SAR</span>
          <span>CHANGE</span>
          <span>VQA</span>
        </div>
      </div>

      <div className="signup-right">
        <div className="signup-form-wrapper">
          <header className="signup-header">
            <h1 className="signup-title">Create your SatQuery account</h1>
            <p className="signup-subtitle">Start analyzing Earth observation data today.</p>
          </header>

          <form className="signup-form" onSubmit={handleSubmit}>
            <div className="signup-field">
              <label htmlFor="fullName">FULL NAME</label>
              <input
                id="fullName"
                type="text"
                placeholder="Mayank Tripathi"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
              />
            </div>

            <div className="signup-field">
              <label htmlFor="email">EMAIL</label>
              <input
                id="email"
                type="email"
                placeholder="researcher@isro.gov.in"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>

            <div className="signup-field">
              <label htmlFor="password">PASSWORD</label>
              <div className="input-with-toggle">
                <input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
                <button
                  type="button"
                  className="password-toggle-btn"
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                  onClick={() => setShowPassword(!showPassword)}
                >
                  {showPassword ? (
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="16" height="16">
                      <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"></path>
                      <line x1="1" y1="1" x2="23" y2="23"></line>
                    </svg>
                  ) : (
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="16" height="16">
                      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path>
                      <circle cx="12" cy="12" r="3"></circle>
                    </svg>
                  )}
                </button>
              </div>
            </div>

            <div className="signup-field">
              <label htmlFor="confirmPassword">CONFIRM PASSWORD</label>
              <div className="input-with-toggle">
                <input
                  id="confirmPassword"
                  type={showConfirmPassword ? 'text' : 'password'}
                  placeholder="••••••••"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                />
                <button
                  type="button"
                  className="password-toggle-btn"
                  aria-label={showConfirmPassword ? 'Hide confirm password' : 'Show confirm password'}
                  onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                >
                  {showConfirmPassword ? (
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="16" height="16">
                      <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"></path>
                      <line x1="1" y1="1" x2="23" y2="23"></line>
                    </svg>
                  ) : (
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="16" height="16">
                      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path>
                      <circle cx="12" cy="12" r="3"></circle>
                    </svg>
                  )}
                </button>
              </div>
            </div>

            <div className="signup-terms">
              <label className="checkbox-container">
                <input
                  type="checkbox"
                  checked={agreeTerms}
                  onChange={(e) => setAgreeTerms(e.target.checked)}
                />
                <span className="checkmark"></span>
                <span className="terms-text">
                  I agree to the <a href="#terms" onClick={(e) => e.preventDefault()}>Terms</a> and <a href="#privacy" onClick={(e) => e.preventDefault()}>Privacy Policy</a>
                </span>
              </label>
            </div>

            {errorMsg && (
              <div style={{ color: '#d32f2f', background: '#ffebee', padding: '10px 12px', borderRadius: '6px', fontSize: '12px', marginBottom: '14px' }}>
                {errorMsg}
              </div>
            )}

            <button type="submit" className="signup-submit-btn" disabled={loading}>
              {loading ? 'Creating Account...' : 'Create Account'}
            </button>
          </form>

          <div className="signup-footer-link">
            Already have an account?{' '}
            <button type="button" className="btn-link" onClick={onSignIn}>
              Sign In
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
