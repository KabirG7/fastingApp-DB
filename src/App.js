import React, { useState, useEffect } from 'react';
import './App.css';

function App() {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(localStorage.getItem('token'));
  const [authMode, setAuthMode] = useState('login'); // 'login' or 'signup'
  const [authError, setAuthError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  
  // Current view: 'auth', 'dashboard', 'timer', 'history'
  const [currentView, setCurrentView] = useState('auth');
  
  // Fasting state
  const [activeFast, setActiveFast] = useState(null);
  const [elapsedTime, setElapsedTime] = useState(0);
  const [fastingHistory, setFastingHistory] = useState([]);
  const [fastingStats, setFastingStats] = useState(null);

  // Auth form states
  const [authForm, setAuthForm] = useState({
    username: '',
    email: '',
    password: ''
  });

  // Fasting protocol selection
  const [selectedProtocol, setSelectedProtocol] = useState({
    name: '16:8',
    duration: 16,
    description: 'This is the most common fasting plan to start if you are new to intermittent fasting.'
  });

  const protocolOptions = [
    {
      name: '12:12',
      duration: 12,
      description: 'The "12 on, 12 off" plan can help promote fat-burning and other health benefits.',
      popular: false
    },
    {
      name: '14:10',
      duration: 14,
      description: 'With this fasting plan, you eat within a 10-hour window and fast for 14 hours.',
      popular: false
    },
    {
      name: '16:8',
      duration: 16,
      description: 'This is the most common fasting plan to start if you are new to intermittent fasting.',
      popular: true
    },
    {
      name: '18:6',
      duration: 18,
      description: 'An advanced fasting protocol with a 6-hour eating window.',
      popular: false
    },
    {
      name: '20:4',
      duration: 20,
      description: 'Also known as the Warrior Diet, this is an advanced fasting method.',
      popular: false
    }
  ];

  // Check for existing token on component mount
  useEffect(() => {
    const savedToken = localStorage.getItem('token');
    if (savedToken) {
      setToken(savedToken);
      setCurrentView('dashboard');
      // Don't fetch data here, let the token useEffect handle it
    } else {
      setCurrentView('auth');
    }
  }, []);

  // Handle token changes and fetch data when token is available
  useEffect(() => {
    if (token) {
      setCurrentView('dashboard');
      fetchActiveFast();
      fetchFastingStats();
    } else {
      setCurrentView('auth');
    }
  }, [token]);

  // Timer effect for active fasting
  useEffect(() => {
    let interval;
    if (activeFast && activeFast.status === 'active') {
      setCurrentView('timer');
      interval = setInterval(() => {
        const startTime = new Date(activeFast.startTime);
        const now = new Date();
        const elapsed = Math.floor((now - startTime) / 1000);
        setElapsedTime(elapsed);
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [activeFast]);

  const apiCall = async (endpoint, options = {}) => {
    const config = {
      headers: { 'Content-Type': 'application/json' },
      ...options
    };

    // Use the current token state
    const currentToken = token || localStorage.getItem('token');
    if (currentToken) {
      config.headers.Authorization = `Bearer ${currentToken}`;
    }

    try {
      const response = await fetch(`http://localhost:3001/api${endpoint}`, config);
      const data = await response.json();

      if (!response.ok) {
        if (response.status === 401) {
          console.log('Unauthorized - clearing token');
          handleLogout();
        }
        throw new Error(data.error || `HTTP ${response.status}: ${response.statusText}`);
      }

      return data;
    } catch (error) {
      console.error(`API call failed for ${endpoint}:`, error);
      throw error;
    }
  };

  const handleAuth = async (e) => {
    e.preventDefault();
    setIsLoading(true);
    setAuthError('');

    const endpoint = authMode === 'login' ? '/auth/login' : '/auth/register';
    const payload = authMode === 'login' 
      ? { username: authForm.username, password: authForm.password }
      : authForm;

    try {
      const data = await apiCall(endpoint, {
        method: 'POST',
        body: JSON.stringify(payload),
      });

      console.log('Auth successful:', data);
      
      // Set token and user data
      setToken(data.token);
      setUser(data.user);
      localStorage.setItem('token', data.token);
      
      // Clear form
      setAuthForm({ username: '', email: '', password: '' });
      
      // View will be set by the useEffect that watches token changes
      
    } catch (error) {
      console.error('Auth error:', error);
      setAuthError(error.message);
    } finally {
      setIsLoading(false);
    }
  };

  const handleLogout = () => {
    console.log('Logging out...');
    setToken(null);
    setUser(null);
    setActiveFast(null);
    setFastingHistory([]);
    setFastingStats(null);
    setElapsedTime(0);
    localStorage.removeItem('token');
    setCurrentView('auth');
  };

  const fetchActiveFast = async () => {
    try {
      console.log('Fetching active fast...');
      const fast = await apiCall('/fasting/active');
      console.log('Active fast response:', fast);
      setActiveFast(fast);
    } catch (error) {
      console.error('Error fetching active fast:', error);
      // Don't show error to user for this - it's normal to not have an active fast
      if (error.message.includes('No active fasting session')) {
        setActiveFast(null);
      }
    }
  };

  const fetchFastingHistory = async () => {
    try {
      console.log('Fetching fasting history...');
      const history = await apiCall('/fasting/history');
      console.log('History response:', history);
      setFastingHistory(history);
    } catch (error) {
      console.error('Error fetching history:', error);
    }
  };

  const fetchFastingStats = async () => {
    try {
      console.log('Fetching fasting stats...');
      const stats = await apiCall('/fasting/stats');
      console.log('Stats response:', stats);
      setFastingStats(stats);
    } catch (error) {
      console.error('Error fetching stats:', error);
      // Set default stats if fetch fails
      setFastingStats({
        completedSessions: 0,
        completionRate: 0,
        totalHoursFasted: 0
      });
    }
  };

  const startFast = async () => {
    setIsLoading(true);
    try {
      console.log('Starting fast with protocol:', selectedProtocol);
      const fast = await apiCall('/fasting/start', {
        method: 'POST',
        body: JSON.stringify({
          protocol: selectedProtocol.name,
          durationHours: selectedProtocol.duration
        })
      });

      console.log('Fast started:', fast);
      setActiveFast(fast);
      setCurrentView('timer');
    } catch (error) {
      console.error('Error starting fast:', error);
      alert(`Failed to start fast: ${error.message}`);
    } finally {
      setIsLoading(false);
    }
  };

  const endFast = async () => {
    setIsLoading(true);
    try {
      console.log('Ending fast...');
      await apiCall('/fasting/end', { method: 'PUT' });
      setActiveFast(null);
      setElapsedTime(0);
      setCurrentView('dashboard');
      fetchFastingStats();
    } catch (error) {
      console.error('Error ending fast:', error);
      alert(`Failed to end fast: ${error.message}`);
    } finally {
      setIsLoading(false);
    }
  };

  const cancelFast = async () => {
    if (!window.confirm('Are you sure you want to cancel your fasting session?')) return;
    
    setIsLoading(true);
    try {
      console.log('Cancelling fast...');
      await apiCall('/fasting/cancel', { method: 'PUT' });
      setActiveFast(null);
      setElapsedTime(0);
      setCurrentView('dashboard');
      fetchFastingStats();
    } catch (error) {
      console.error('Error cancelling fast:', error);
      alert(`Failed to cancel fast: ${error.message}`);
    } finally {
      setIsLoading(false);
    }
  };

  const formatTime = (seconds) => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const getProgress = () => {
    if (!activeFast) return 0;
    const totalSeconds = activeFast.durationHours * 3600;
    return Math.min((elapsedTime / totalSeconds) * 100, 100);
  };

  const getRemainingTime = () => {
    if (!activeFast) return 0;
    const totalSeconds = activeFast.durationHours * 3600;
    return Math.max(totalSeconds - elapsedTime, 0);
  };

  // Debug info
  console.log('Current state:', {
    token: token ? 'present' : 'missing',
    user: user?.username || 'none',
    currentView,
    activeFast: activeFast ? 'present' : 'none',
    fastingStats: fastingStats ? 'present' : 'none'
  });

  // Auth Screen
  if (currentView === 'auth') {
    return (
      <div className="app">
        <div className="background-gradient"></div>
        
        <div className="container">
          <div className="glass-panel auth-panel">
            <h1 className="title">
              {authMode === 'login' ? 'Welcome Back' : 'Start Your Fasting Journey'}
            </h1>
            
            <form onSubmit={handleAuth} className="auth-form">
              {authError && <div className="error-message">{authError}</div>}
              
              <div className="input-group">
                <input
                  type="text"
                  placeholder="Username"
                  value={authForm.username}
                  onChange={(e) => setAuthForm({...authForm, username: e.target.value})}
                  className="auth-input"
                  required
                />
              </div>

              {authMode === 'signup' && (
                <div className="input-group">
                  <input
                    type="email"
                    placeholder="Email"
                    value={authForm.email}
                    onChange={(e) => setAuthForm({...authForm, email: e.target.value})}
                    className="auth-input"
                    required
                  />
                </div>
              )}

              <div className="input-group">
                <input
                  type="password"
                  placeholder="Password"
                  value={authForm.password}
                  onChange={(e) => setAuthForm({...authForm, password: e.target.value})}
                  className="auth-input"
                  required
                />
              </div>

              <button 
                type="submit" 
                className={`auth-button ${isLoading ? 'loading' : ''}`}
                disabled={isLoading}
              >
                {isLoading ? 'Please wait...' : (authMode === 'login' ? 'Sign In' : 'Sign Up')}
              </button>
            </form>

            <div className="auth-switch">
              <p>
                {authMode === 'login' ? "Don't have an account? " : "Already have an account? "}
                <button 
                  type="button"
                  onClick={() => {
                    setAuthMode(authMode === 'login' ? 'signup' : 'login');
                    setAuthError('');
                    setAuthForm({ username: '', email: '', password: '' });
                  }}
                  className="switch-button"
                >
                  {authMode === 'login' ? 'Sign Up' : 'Sign In'}
                </button>
              </p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Dashboard Screen
  if (currentView === 'dashboard') {
    return (
      <div className="app">
        <div className="background-gradient"></div>
        
        <div className="container">
          <div className="glass-panel">
      {/*  <span className="username"> Hi {user?.username || 'User'}</span> */}
            <div className="header">
              <h1 className="title">Intermittent Fasting Tracker</h1>
              <div className="user-info">
                <button onClick={() => setCurrentView('history')} className="nav-button">
                  History
                </button>
                <button onClick={handleLogout} className="logout-button">
                  Logout
                </button>
              </div>
            </div>

            {fastingStats && (
              <div className="stats-container">
                <div className="stat-card">
                  <div className="stat-value">{fastingStats.completedSessions || 0}</div>
                  <div className="stat-label">Completed Fasts</div>
                </div>
                <div className="stat-card">
                  <div className="stat-value">{fastingStats.completionRate || 0}%</div>
                  <div className="stat-label">Success Rate</div>
                </div>
                <div className="stat-card">
                  <div className="stat-value">{fastingStats.totalHoursFasted || 0}h</div>
                  <div className="stat-label">Hours Fasted (30d)</div>
                </div>
              </div>
            )}
            
            <div className="protocol-selection">
              <h2>Choose Your Fasting Protocol</h2>
              
              <div className="protocol-grid">
                {protocolOptions.map((protocol) => (
                  <div 
                    key={protocol.name}
                    className={`protocol-card ${selectedProtocol.name === protocol.name ? 'selected' : ''}`}
                    onClick={() => setSelectedProtocol(protocol)}
                  >
                    {protocol.popular && <div className="popular-badge">Popular</div>}
                    <div className="protocol-hours">{protocol.duration}</div>
                    <div className="protocol-info">
                      <div className="protocol-name">{protocol.name}</div>
                      <p className="protocol-description">{protocol.description}</p>
                    </div>
                  </div>
                ))}
              </div>
              
              <button 
                className={`start-fast-button ${isLoading ? 'loading' : ''}`} 
                onClick={startFast}
                disabled={isLoading}
              >
                {isLoading ? 'Starting...' : `Start ${selectedProtocol.name} Fast`}
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Timer Screen
  if (currentView === 'timer' && activeFast) {
    const startTime = new Date(activeFast.startTime).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'});
    const goalTime = new Date(new Date(activeFast.startTime).getTime() + activeFast.durationHours * 60 * 60 * 1000).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'});
    
    return (
      <div className="app">
        <div className="background-gradient"></div>
        
        <div className="container">
          <div className="glass-panel">
            <div className="header">
              <h1 className="title">Fasting Timer</h1>
              <div className="user-info">
                <span className="username">@{user?.username || 'User'}</span>
                <button onClick={handleLogout} className="logout-button">
                  Logout
                </button>
              </div>
            </div>
            
            <div className="timer-container">
              <div className="timer-circle">
                <svg className="progress-ring" width="200" height="200">
                  <circle
                    className="progress-ring-circle-bg"
                    cx="100"
                    cy="100"
                    r="90"
                  />
                  <circle
                    className="progress-ring-circle"
                    cx="100"
                    cy="100"
                    r="90"
                    style={{
                      strokeDasharray: `${2 * Math.PI * 90}`,
                      strokeDashoffset: `${2 * Math.PI * 90 * (1 - getProgress() / 100)}`
                    }}
                  />
                </svg>
                <div className="timer-content">
                  <div className="elapsed-label">Elapsed</div>
                  <div className="elapsed-time">{formatTime(elapsedTime)}</div>
                  <div className="progress-percent">{Math.round(getProgress())}%</div>
                </div>
              </div>
              
              <div className="timer-details">
                <div className="timer-info">
                  <div className="info-item">
                    <span>Protocol</span>
                    <span className="value">{activeFast.protocol}</span>
                  </div>
                  <div className="info-item">
                    <span>Started</span>
                    <span className="value">{startTime}</span>
                  </div>
                  <div className="info-item">
                    <span>Goal</span>
                    <span className="value">{goalTime}</span>
                  </div>
                  <div className="info-item">
                    <span>Remaining</span>
                    <span className="value">{formatTime(getRemainingTime())}</span>
                  </div>
                </div>
                
                <div className="timer-actions">
                  <button 
                    className={`end-fast-button ${isLoading ? 'loading' : ''}`} 
                    onClick={endFast}
                    disabled={isLoading}
                  >
                    {isLoading ? 'Ending...' : 'Complete Fast'}
                  </button>
                  <button 
                    className={`cancel-fast-button ${isLoading ? 'loading' : ''}`} 
                    onClick={cancelFast}
                    disabled={isLoading}
                  >
                    {isLoading ? 'Cancelling...' : 'Cancel Fast'}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // History Screen
  if (currentView === 'history') {
    if (fastingHistory.length === 0) {
      fetchFastingHistory();
    }

    return (
      <div className="app">
        <div className="background-gradient"></div>
        
        <div className="container">
          <div className="glass-panel">
            <div className="header">
              <h1 className="title">Fasting History</h1>
              <div className="user-info">
                <button onClick={() => setCurrentView('dashboard')} className="nav-button">
                  Dashboard
                </button>
                <button onClick={handleLogout} className="logout-button">
                  Logout
                </button>
              </div>
            </div>
            
            <div className="history-container">
              {fastingHistory.length === 0 ? (
                <div className="empty-state">
                  <p>No fasting sessions yet. Start your first fast!</p>
                </div>
              ) : (
                <div className="history-list">
                  {fastingHistory.map((session) => (
                    <div key={session._id} className="history-item">
                      <div className="session-info">
                        <div className="session-protocol">{session.protocol}</div>
                        <div className="session-duration">{session.durationHours} hours</div>
                        <div className={`session-status ${session.status}`}>{session.status}</div>
                      </div>
                      <div className="session-time">
                        <div>Started: {new Date(session.startTime).toLocaleString()}</div>
                        {session.endTime && (
                          <div>Ended: {new Date(session.endTime).toLocaleString()}</div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    );
  }

  return null;
}

export default App;