import React, { useEffect, useMemo, useState } from 'react';
import './Dashboard.css';
import { HISTORY_ENDPOINTS } from '../config/api';

const HISTORY_URL = HISTORY_ENDPOINTS.CONVERSATIONS;
const MESSAGES_API_BASE = HISTORY_ENDPOINTS.MESSAGES;

const formatDate = (date) => {
  if (!date) return 'Unknown date';
  return new Intl.DateTimeFormat('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  }).format(new Date(date));
};

const normalizeConversation = (conversation) => {
  const messages = Array.isArray(conversation.messages)
    ? conversation.messages
    : (Array.isArray(conversation.rawMessages) ? conversation.rawMessages : []);
  
  const userMessage = messages.find((m) => String(m.role).toUpperCase() === 'USER');
  const assistantMessage = messages.find((m) => String(m.role).toUpperCase() === 'ASSISTANT');
  const latestMessage = [...messages].sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0))[0];

  let rawTitle = conversation.title;
  if (!rawTitle || typeof rawTitle !== 'string' || rawTitle.startsWith('{')) {
    rawTitle = userMessage?.content || latestMessage?.content || 'Untitled analysis';
  }
  const title = typeof rawTitle === 'string' && rawTitle.length > 70
    ? rawTitle.substring(0, 70) + '...'
    : rawTitle;

  const metadata = assistantMessage?.metadata || {};
  const mode = conversation.mode || (metadata.image_count > 1 || metadata.temporal_mode === 'multi_image'
    ? 'Bi-Temporal'
    : metadata.modalities?.length
      ? 'Optical + SAR'
      : 'Single Image');

  const confidence = conversation.confidence || (metadata.confidence == null
    ? null
    : `${Math.round(metadata.confidence <= 1 ? metadata.confidence * 100 : metadata.confidence)}%`);

  const thumbnail = conversation.thumbnail
    || (Array.isArray(userMessage?.images) ? userMessage.images[0] : userMessage?.imageUrl)
    || (Array.isArray(userMessage?.imageUrls) ? userMessage.imageUrls[0] : null)
    || null;

  const extractedUserId = conversation.userId
    || conversation.user_id
    || conversation.ownerId
    || conversation.owner_id
    || (typeof conversation.user === 'object' ? conversation.user?.id : (typeof conversation.user === 'string' ? conversation.user : null))
    || userMessage?.userId
    || userMessage?.user_id
    || null;

  return {
    id: conversation.id,
    userId: extractedUserId,
    title,
    thumbnail,
    date: conversation.date || latestMessage?.createdAt || new Date().toISOString(),
    mode,
    confidence,
    status: conversation.status || (assistantMessage ? 'COMPLETE' : 'PENDING'),
    rawMessages: messages,
  };
};

function SatqueryMark() {
  return (
    <svg viewBox="0 0 47 46" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true">
      <circle cx="23.5" cy="23" r="21"></circle>
      <ellipse cx="23.5" cy="23" rx="21" ry="6" transform="rotate(-25 23.5 23)"></ellipse>
      <circle cx="23.5" cy="23" r="3.5" fill="#00B4D8" stroke="none"></circle>
    </svg>
  );
}

export default function Dashboard({
  initialTab = 'dashboard',
  onNewAnalysis,
  isLoggedIn = false,
  user = null,
  onLogout,
  onLogin
}) {
  const [activeTab, setActiveTab] = useState(initialTab);
  const [transitionKey, setTransitionKey] = useState(0);
  const [theme, setTheme] = useState('light');
  const [conversations, setConversations] = useState([]);
  const [historyLoading, setHistoryLoading] = useState(true);
  const [historyError, setHistoryError] = useState('');
  const [historySearch, setHistorySearch] = useState('');
  const [historyFilter, setHistoryFilter] = useState('ALL');

  // Modal / Drawer state for viewing messages of a clicked conversation
  const [selectedConversation, setSelectedConversation] = useState(null);
  const [activeMessages, setActiveMessages] = useState([]);
  const [messagesLoading, setMessagesLoading] = useState(false);
  const [messagesError, setMessagesError] = useState('');

  const handleOpenConversation = (analysis) => {
    setSelectedConversation(analysis);
    setMessagesError('');

    const initialMsgs = Array.isArray(analysis.rawMessages) ? [...analysis.rawMessages] : [];
    initialMsgs.sort((a, b) => new Date(a.createdAt || 0) - new Date(b.createdAt || 0));
    setActiveMessages(initialMsgs);

    const isLocal = String(analysis.id).startsWith('conv_local_');
    if (isLocal) {
      setMessagesLoading(false);
      return;
    }

    setMessagesLoading(initialMsgs.length === 0);

    const token = localStorage.getItem('satquery_auth_token') || '';
    const headers = { 'Content-Type': 'application/json' };
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
      headers['x-auth-token'] = token;
      headers['token'] = token;
    }

    fetch(`${MESSAGES_API_BASE}/${analysis.id}`, { headers })
      .then((res) => {
        if (!res.ok) throw new Error(`Messages fetch failed (${res.status})`);
        return res.json();
      })
      .then((payload) => {
        const rawMsgs = Array.isArray(payload?.data)
          ? payload.data
          : (Array.isArray(payload?.messages)
            ? payload.messages
            : (Array.isArray(payload?.data?.messages) ? payload.data.messages : []));

        if (rawMsgs.length > 0) {
          const sorted = [...rawMsgs].sort((a, b) => new Date(a.createdAt || 0) - new Date(b.createdAt || 0));
          setActiveMessages(sorted);
        }
      })
      .catch((err) => {
        console.warn('Error loading full remote conversation messages:', err);
        if (initialMsgs.length === 0) {
          setMessagesError('Failed to load full message history.');
        }
      })
      .finally(() => {
        setMessagesLoading(false);
      });
  };

  const handleCloseModal = () => {
    setSelectedConversation(null);
    setActiveMessages([]);
    setMessagesError('');
  };

  useEffect(() => {
    setActiveTab(initialTab);
    setTransitionKey((k) => k + 1);
  }, [initialTab]);

  const handleTabChange = (tab) => {
    setActiveTab(tab);
    setTransitionKey((k) => k + 1);
  };

  useEffect(() => {
    const controller = new AbortController();

    const loadHistory = async () => {
      let remoteList = [];
      const token = localStorage.getItem('satquery_auth_token') || '';
      const currentUserId = user?.id || user?.data?.id || (user && typeof user === 'object' && user.id) || '';

      const headers = {
        'Content-Type': 'application/json'
      };
      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
        headers['x-auth-token'] = token;
        headers['token'] = token;
      }

      try {
        const fetchUrl = currentUserId ? `${HISTORY_URL}?userId=${encodeURIComponent(currentUserId)}` : HISTORY_URL;
        const response = await fetch(fetchUrl, { headers, signal: controller.signal });
        if (response.ok) {
          const payload = await response.json();
          if (payload.success && Array.isArray(payload.data)) {
            remoteList = payload.data
              .map(normalizeConversation)
              .filter(item => {
                if (currentUserId && item.userId) {
                  return String(item.userId) === String(currentUserId);
                }
                return true;
              });
          }
        }
      } catch (error) {
        if (error.name !== 'AbortError') {
          console.warn('Remote history fetch unavailable:', error);
        }
      }

      let localList = [];
      try {
        const stored = localStorage.getItem('satquery_local_history');
        if (stored) {
          const parsed = JSON.parse(stored);
          if (Array.isArray(parsed)) {
            localList = parsed
              .map(normalizeConversation)
              .filter(item => {
                if (currentUserId) {
                  return item.userId && String(item.userId) === String(currentUserId);
                } else {
                  return !item.userId;
                }
              });
          }
        }
      } catch (err) {
        console.error('Error loading local history:', err);
      }

      const mergedMap = new Map();
      remoteList.forEach(item => mergedMap.set(item.id, item));
      localList.forEach(item => mergedMap.set(item.id, item));

      const mergedArray = Array.from(mergedMap.values()).sort((a, b) => {
        const dateA = a.date ? new Date(a.date).getTime() : 0;
        const dateB = b.date ? new Date(b.date).getTime() : 0;
        return dateB - dateA;
      });

      setConversations(mergedArray);
      setHistoryError('');
      setHistoryLoading(false);
    };

    loadHistory();

    return () => controller.abort();
  }, [user]);

  const filteredConversations = useMemo(() => {
    const search = historySearch.trim().toLowerCase();
    return conversations.filter((conversation) => {
      const matchesSearch = !search || conversation.title.toLowerCase().includes(search);
      const matchesFilter = historyFilter === 'ALL'
        || conversation.mode.toUpperCase() === historyFilter
        || conversation.status === historyFilter;
      return matchesSearch && matchesFilter;
    });
  }, [conversations, historyFilter, historySearch]);

  const renderHistoryState = (emptyText = 'No analyses found.') => {
    if (historyLoading) return <div className="history-state">Loading analysis history...</div>;
    if (historyError) return <div className="history-state error-state">{historyError}</div>;
    if (!filteredConversations.length) return <div className="history-state">{emptyText}</div>;
    return null;
  };

  const renderAnalysisCard = (analysis, isHistory = false, index = 0) => (
    <div 
      className={`analysis-card ${isHistory ? 'history-card' : ''}`} 
      key={analysis.id}
      style={isHistory ? { animationDelay: `${0.14 + Math.min(index, 20) * 0.05}s` } : undefined}
      onClick={() => handleOpenConversation(analysis)}
    >
      <div className="analysis-card-left">
        {analysis.thumbnail ? (
          <div
            className="analysis-image"
            style={{
              backgroundImage: `url("${analysis.thumbnail}")`,
              backgroundSize: 'cover',
              backgroundPosition: 'center',
              borderRadius: '4px'
            }}
          />
        ) : (
          <div className="analysis-image satquery-card-logo">
            <SatqueryMark />
          </div>
        )}
        <div className="analysis-details">
          <div className="analysis-title">{analysis.title}</div>
          <div className="analysis-meta">
            <span className="analysis-date">{formatDate(analysis.date)}</span>
            <span className="analysis-tag">{analysis.mode}</span>
          </div>
        </div>
      </div>
      <div className="analysis-card-right">
        <div className="analysis-confidence">
          <div className="conf-value">{analysis.confidence || '—'}</div>
          <div className="conf-label">CONFIDENCE</div>
        </div>
        <div className="analysis-status">
          <div className={`status-pill ${analysis.status === 'FAILED' ? 'failed-pill' : ''}`}>
            {analysis.status}
          </div>
          <div className="view-link">{isHistory ? 'OPEN +' : 'VIEW'}</div>
        </div>
      </div>
    </div>
  );

  return (
    <div className="dashboard-container">
     
      <div className="sidebar">
        <div className="sidebar-logo" >
          <svg width="47" height="46" viewBox="0 0 47 46" fill="none" stroke="black" strokeWidth="1.5">
            <circle cx="23.5" cy="23" r="21"></circle>
            <ellipse cx="23.5" cy="23" rx="21" ry="6" transform="rotate(-25 23.5 23)"></ellipse>
            <circle cx="23.5" cy="23" r="3.5" fill="#00B4D8" stroke="none"></circle>
          </svg>
          <div className="sidebar-logo-text">
            SATQUERY <span className="ai-text">AI</span>
          </div>
        </div>

        <button className="sidebar-new-btn" onClick={onNewAnalysis}>
          <span>+</span> New Analysis
        </button>

        <nav className="sidebar-nav">
          <div 
            className={`nav-item ${activeTab === 'dashboard' ? 'active' : ''}`}
            onClick={() => handleTabChange('dashboard')}
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="18" height="18">
              <rect x="3" y="3" width="7" height="7"></rect>
              <rect x="14" y="3" width="7" height="7"></rect>
              <rect x="14" y="14" width="7" height="7"></rect>
              <rect x="3" y="14" width="7" height="7"></rect>
            </svg>
            Dashboard
          </div>
          <div 
            className={`nav-item ${activeTab === 'history' ? 'active' : ''}`}
            onClick={() => handleTabChange('history')}
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="18" height="18">
              <circle cx="12" cy="12" r="10"></circle>
              <polyline points="12 6 12 12 16 14"></polyline>
            </svg>
            History
          </div>
          <div 
            className={`nav-item ${activeTab === 'reports' ? 'active' : ''}`}
            onClick={() => handleTabChange('reports')}
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="18" height="18">
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
              <polyline points="14 2 14 8 20 8"></polyline>
              <line x1="16" y1="13" x2="8" y2="13"></line>
              <line x1="16" y1="17" x2="8" y2="17"></line>
              <polyline points="10 9 9 9 8 9"></polyline>
            </svg>
            Reports
          </div>
          <div 
            className={`nav-item ${activeTab === 'settings' ? 'active' : ''}`}
            onClick={() => handleTabChange('settings')}
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="18" height="18">
              <circle cx="12" cy="12" r="3"></circle>
              <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"></path>
            </svg>
            Settings
          </div>
        </nav>

        <div className="sidebar-profile">
          <div className="profile-avatar">
            {(user?.fullName || user?.email || 'M')[0].toUpperCase()}
          </div>
          <div className="profile-info">
            <div className="profile-name">{user?.fullName || 'Mayank'}</div>
          </div>
          {onLogout && (
            <button
              onClick={onLogout}
              title="Log out"
              style={{
                background: 'transparent',
                border: 'none',
                color: '#888',
                cursor: 'pointer',
                marginLeft: 'auto',
                padding: '4px',
                display: 'flex',
                alignItems: 'center'
              }}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"></path>
                <polyline points="16 17 21 12 16 7"></polyline>
                <line x1="21" y1="12" x2="9" y2="12"></line>
              </svg>
            </button>
          )}
        </div>
      </div>

      <div className="dashboard-content" key={`${activeTab}-${transitionKey}`}>
        {activeTab === 'dashboard' && (
          <>
            <header className="dashboard-header">
              <h1>Good Morning, {user?.fullName?.split(' ')[0] || user?.name?.split(' ')[0] || ''}.</h1>
              <p>What would you like to analyze today?</p>
            </header>

            <div className="new-analysis-banner" onClick={onNewAnalysis}>
              <div className="banner-left">
                <div className="banner-icon">+</div>
                <div className="banner-text">
                  <div className="banner-title">New Analysis</div>
                  <div className="banner-sub">Upload satellite imagery and ask a natural-language question</div>
                </div>
              </div>
              <div className="banner-right">START &gt;</div>
            </div>

            <div className="stats-grid">
              <div className="stat-card">
                <div className="stat-value">{conversations.length}</div>
                <div className="stat-label">ANALYSES</div>
              </div>
              <div className="stat-card">
                <div className="stat-value">{conversations.reduce((total, item) => total + (item.mode === 'Bi-Temporal' ? 2 : 1), 0)}</div>
                <div className="stat-label">IMAGES PROCESSED</div>
              </div>
              <div className="stat-card">
                <div className="stat-value">
                  {conversations.length
                    ? `${Math.round(conversations.reduce((total, item) => total + parseInt(item.confidence || '0', 10), 0) / conversations.length)}%`
                    : '—'}
                </div>
                <div className="stat-label">AVG CONFIDENCE</div>
              </div>
              <div className="stat-card">
                <div className="stat-value">{conversations.filter((item) => item.status === 'COMPLETE').length}</div>
                <div className="stat-label">REPORTS</div>
              </div>
            </div>

            <div className="recent-analysis-section">
              <h2>Recent Analysis</h2>
              <div className="analysis-list">
                {renderHistoryState('No recent analyses found.') || filteredConversations.slice(0, 3).map((analysis) => renderAnalysisCard(analysis))}
              </div>
            </div>
          </>
        )}

        {activeTab === 'history' && (
          <div className="history-tab">
            <h1 className="history-title">Analysis History</h1>

            <div className="history-filters">
              <div className="history-search">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#A9B1B1" strokeWidth="2">
                  <circle cx="11" cy="11" r="8"></circle>
                  <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
                </svg>
                <input
                  type="text"
                  placeholder="Search analyses..."
                  value={historySearch}
                  onChange={(event) => setHistorySearch(event.target.value)}
                />
              </div>
              {['ALL', 'SINGLE IMAGE', 'BI-TEMPORAL', 'OPTICAL + SAR', 'COMPLETED', 'FAILED'].map((filter) => (
                <button
                  className={`filter-pill ${historyFilter === filter ? 'active-pill' : ''}`}
                  key={filter}
                  onClick={() => setHistoryFilter(filter)}
                >
                  {filter}
                </button>
              ))}
            </div>

            <div className="analysis-list history-list">
              {renderHistoryState() || filteredConversations.map((analysis, index) => renderAnalysisCard(analysis, true, index))}
            </div>
          </div>
        )}

        {activeTab === 'reports' && (
          <div className="reports-tab">
            <div className="reports-header-row">
              <h1 className="history-title">Reports</h1>
              <div className="reports-actions">
                <button className="btn-export">Export JSON</button>
                <button className="btn-download">Download Report</button>
              </div>
            </div>

            <div className="report-document">
              <div className="report-doc-header">
                <div className="report-doc-logo">
                  <svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="black" strokeWidth="1.2">
                    <circle cx="10" cy="10" r="8" strokeWidth="1.6"></circle>
                    <line x1="2" y1="10" x2="18" y2="10"></line>
                    <line x1="10" y1="2" x2="10" y2="18"></line>
                    <ellipse cx="10" cy="10" rx="4" ry="8"></ellipse>
                    <circle cx="10" cy="10" r="1.5" fill="#00B4D8" stroke="none"></circle>
                  </svg>
                  SATQUERY <span className="ai-text">AI</span>
                </div>
                <div className="report-doc-id">
                  <div className="report-id-label">REPORT ID</div>
                  <div className="report-id-val">RPT-2026-0923</div>
                </div>
              </div>

              <div className="report-doc-title-sec">
                <h2>Remote Sensing Analysis Report</h2>
                <div className="report-doc-date">03 SEPTEMBER 2026 &middot; 09:41 IST</div>
              </div>

              <div className="report-section">
                <h3>QUERY</h3>
                <p>Describe this image.</p>
              </div>

              <div className="report-section">
                <h3>INPUT DATA</h3>
                <p>satellite_image.tif &middot; GeoTIFF &middot; Sentinel-2A &middot; 10m &middot; EPSG:4326 &middot; 12 Aug 2026</p>
              </div>

              <div className="report-section">
                <h3>SCENE OVERVIEW</h3>
                <p>The image shows a predominantly coastal region with dense urban built-up areas, structured road networks, mixed vegetation belts, and a prominent water body adjacent to the developed zone.</p>
              </div>

              <div className="report-section">
                <h3>AI FINDINGS</h3>
                <p>Urban Area (94%), Water Body (89%), Vegetation Zone (86%). The analysis detected 3 primary land-cover classes with high confidence spatial evidence.</p>
              </div>

              <div className="report-section">
                <h3>CONFIDENCE BREAKDOWN</h3>
                <div className="confidence-bars">
                  <div className="conf-bar-row">
                    <div className="conf-bar-label">Task Classification</div>
                    <div className="conf-bar-track"><div className="conf-bar-fill" style={{width: '98%'}}></div></div>
                    <div className="conf-bar-pct">98%</div>
                  </div>
                  <div className="conf-bar-row">
                    <div className="conf-bar-label">Model Prediction</div>
                    <div className="conf-bar-track"><div className="conf-bar-fill" style={{width: '91%'}}></div></div>
                    <div className="conf-bar-pct">91%</div>
                  </div>
                  <div className="conf-bar-row">
                    <div className="conf-bar-label">Evidence Agreement</div>
                    <div className="conf-bar-track"><div className="conf-bar-fill" style={{width: '89%'}}></div></div>
                    <div className="conf-bar-pct">89%</div>
                  </div>
                </div>
              </div>

              <div className="report-section">
                <h3>MODELS USED</h3>
                <p className="models-used-text">Remote Sensing VLM &middot; DETR Grounding &middot; BigEarthNet Adaptation</p>
              </div>

              <div className="report-footer">
                GENERATED BY SATQUERY AI - REMOTE SENSING INTELLIGENCE - satquery.ai
              </div>
            </div>
          </div>
        )}

        {activeTab === 'settings' && (
          <div className="settings-tab">
            <h1 className="settings-title">Settings</h1>
            
            <div className="settings-section">
              <div className="settings-section-title">Account</div>
              <div className="settings-block">
                <div className="settings-row">
                  <div className="settings-label">Full Name</div>
                  <div className="settings-value">{user?.fullName || user?.name || 'Mayank Tripathi'}</div>
                </div>
                <div className="settings-row">
                  <div className="settings-label">Email</div>
                  <div className="settings-value">{user?.email || 'mayank.tripathi@isro.gov.in'}</div>
                </div>
                <div className="settings-row">
                  <div className="settings-label">Organization</div>
                  <div className="settings-value">{user?.organization || 'ISRO — National Remote Sensing Centre'}</div>
                </div>
              </div>
            </div>

            <div className="settings-section">
              <div className="settings-section-title">Analysis Preferences</div>
              <div className="settings-block">
                <div className="settings-row">
                  <div className="settings-label">Default Analysis Mode</div>
                  <div className="settings-value">Single Image</div>
                </div>
                <div className="settings-row">
                  <div className="settings-label">Confidence Threshold</div>
                  <div className="settings-value">0.75</div>
                </div>
                <div className="settings-row">
                  <div className="settings-label">Default Resolution</div>
                  <div className="settings-value">10 m</div>
                </div>
              </div>
            </div>

            <div className="settings-section">
              <div className="settings-section-title">Export Preferences</div>
              <div className="settings-block">
                <div className="settings-row">
                  <div className="settings-label">Report Format</div>
                  <div className="settings-value">PDF</div>
                </div>
                <div className="settings-row">
                  <div className="settings-label">Include Execution Trace</div>
                  <div className="settings-value">Yes</div>
                </div>
                <div className="settings-row">
                  <div className="settings-label">Coordinate System</div>
                  <div className="settings-value">EPSG:4326</div>
                </div>
              </div>
            </div>

            <div className="settings-section">
              <div className="settings-section-title">Appearance</div>
              <div className="settings-block">
                <div className="settings-row">
                  <div className="settings-label">Theme</div>
                  <div className="settings-value">
                    <div className="theme-toggle">
                      <div 
                        className={`theme-option ${theme === 'light' ? 'active' : ''}`}
                        onClick={() => setTheme('light')}
                      >LIGHT</div>
                      <div 
                        className={`theme-option ${theme === 'dark' ? 'active' : ''}`}
                        onClick={() => setTheme('dark')}
                      >DARK</div>
                      <div 
                        className={`theme-option ${theme === 'system' ? 'active' : ''}`}
                        onClick={() => setTheme('system')}
                      >SYSTEM</div>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <button className="btn-save-settings">Save Changes</button>
          </div>
        )}

      </div>

      {selectedConversation && (
        <div className="chat-modal-backdrop" onClick={handleCloseModal}>
          <div className="chat-modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="chat-modal-header">
              <div className="chat-modal-header-left">
                <SatqueryMark />
                <div>
                  <h3 className="chat-modal-title">{selectedConversation.title}</h3>
                  <div className="chat-modal-sub">
                    ID: {selectedConversation.id} &middot; {formatDate(selectedConversation.date)} &middot; <span className="analysis-tag">{selectedConversation.mode}</span>
                  </div>
                </div>
              </div>
              <button className="chat-modal-close-btn" onClick={handleCloseModal}>
                &times;
              </button>
            </div>

            <div className="chat-modal-body">
              {messagesLoading && (
                <div className="chat-modal-status">Loading conversation messages...</div>
              )}
              {messagesError && (
                <div className="chat-modal-status chat-modal-error">{messagesError}</div>
              )}
              {!messagesLoading && activeMessages.length === 0 && !messagesError && (
                <div className="chat-modal-status">No messages found in this conversation.</div>
              )}

              {activeMessages.map((msg) => {
                const isUser = String(msg.role || '').toUpperCase() === 'USER';
                const meta = msg.metadata || {};
                return (
                  <div key={msg.id || Math.random()} className={`chat-message-row ${isUser ? 'user-row' : 'assistant-row'}`}>
                    <div className="chat-avatar">{isUser ? 'U' : 'AI'}</div>
                    <div className="chat-message-content">
                      <div className="chat-message-header">
                        <span className="chat-sender-name">{isUser ? 'User Request' : 'SatQuery AI'}</span>
                        <span className="chat-timestamp">{msg.createdAt ? new Date(msg.createdAt).toLocaleString() : ''}</span>
                      </div>
                      
                      {(() => {
                        const imageSources = [];
                        if (msg.imageUrl) imageSources.push(msg.imageUrl);
                        if (Array.isArray(msg.imageUrls)) imageSources.push(...msg.imageUrls);
                        if (Array.isArray(msg.images)) imageSources.push(...msg.images);
                        if (Array.isArray(meta.images)) imageSources.push(...meta.images);
                        if (meta.imageUrl) imageSources.push(meta.imageUrl);

                        if (imageSources.length > 0) {
                          return (
                            <div className="chat-image-gallery">
                              {imageSources.map((src, idx) => (
                                <div key={idx} className="chat-image-attachment">
                                  <img src={src} alt={`Uploaded Scene ${idx + 1}`} />
                                </div>
                              ))}
                            </div>
                          );
                        }
                        return null;
                      })()}

                      <div className="chat-message-bubble">
                        {msg.content}
                      </div>

                      {!isUser && (meta.confidence != null || meta.modalities || meta.temporal_mode || meta.visual_evidence) && (
                        <div className="chat-message-metadata">
                          {meta.confidence != null && (
                            <span className="meta-badge conf-badge">
                              Confidence: {Math.round(meta.confidence <= 1 ? meta.confidence * 100 : meta.confidence)}%
                            </span>
                          )}
                          {meta.temporal_mode && (
                            <span className="meta-badge">Mode: {meta.temporal_mode}</span>
                          )}
                          {meta.image_count > 1 && (
                            <span className="meta-badge">Images: {meta.image_count}</span>
                          )}
                          {meta.modalities && (
                            <span className="meta-badge">Modalities: {meta.modalities.join(', ')}</span>
                          )}
                          {meta.visual_evidence && Array.isArray(meta.visual_evidence) && (
                            <div className="visual-evidence-list">
                              <span className="evidence-title">Visual Evidence:</span>
                              {meta.visual_evidence.map((ev, i) => (
                                <span key={i} className="evidence-tag">{ev}</span>
                              ))}
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
