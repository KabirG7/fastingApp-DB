import React, { useState, useEffect, useCallback } from 'react';
import './App.css';

function App() {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(localStorage.getItem('token'));
  const [authMode, setAuthMode] = useState('login'); // 'login' or 'signup'
  const [authError, setAuthError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const [currentMonth, setCurrentMonth] = useState('');

  useEffect(() => {
    const today = new Date();
    const monthIndex = today.getMonth(); // 0-indexed month
    const monthNames = [
      "January", "February", "March", "April", "May", "June",
      "July", "August", "September", "October", "November", "December"
    ];
    setCurrentMonth(monthNames[monthIndex]);
  }, []);
  
  // Current view: 'auth', 'dashboard', 'timer', 'history'
  const [currentView, setCurrentView] = useState('auth');
  
  // Fasting state
  const [activeFast, setActiveFast] = useState(null);
  const [elapsedTime, setElapsedTime] = useState(0);
  const [fastingHistory, setFastingHistory] = useState([]);
  const [fastingStats, setFastingStats] = useState(null);

  // History view state
  const [selectedDay, setSelectedDay] = useState(null);

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

  // Helper function to get weekly history data
  const getWeeklyHistory = () => {
    const today = new Date();
    const currentDay = today.getDay(); // 0 = Sunday, 1 = Monday, etc.
    const startOfWeek = new Date(today);
    startOfWeek.setDate(today.getDate() - currentDay);
    startOfWeek.setHours(0, 0, 0, 0);

    // Generate array of weeks (last 8 weeks including current week)
    const weeks = [];
    for (let weekIndex = 7; weekIndex >= 0; weekIndex--) {
      const weekStart = new Date(startOfWeek);
      weekStart.setDate(startOfWeek.getDate() - (weekIndex * 7));
      
      const weekData = {
        weekStart,
        days: []
      };

      // Generate 7 days for this week
      for (let dayIndex = 0; dayIndex < 7; dayIndex++) {
        const currentDate = new Date(weekStart);
        currentDate.setDate(weekStart.getDate() + dayIndex);
        
        // Find fasting sessions for this day
        const dayFasts = fastingHistory.filter(session => {
          const sessionDate = new Date(session.startTime);
          return sessionDate.toDateString() === currentDate.toDateString();
        });

        // Determine day status
        let status = 'empty';
        let primaryFast = null;
        
        if (dayFasts.length > 0) {
          // Find the most recent fast for this day
          primaryFast = dayFasts.reduce((latest, current) => {
            return new Date(current.startTime) > new Date(latest.startTime) ? current : latest;
          });
          
          status = primaryFast.status === 'completed' ? 'completed' : 
                   primaryFast.status === 'cancelled' ? 'cancelled' : 'active';
        }

        weekData.days.push({
          date: new Date(currentDate),
          fasts: dayFasts,
          status,
          primaryFast,
          dayName: currentDate.toLocaleDateString('en', { weekday: 'short' }),
          dayNumber: currentDate.getDate()
        });
      }

      weeks.push(weekData);
    }

    return weeks;
  };

  const apiCall = useCallback(async (endpoint, options = {}) => {
    const config = {
      headers: { 'Content-Type': 'application/json' },
      ...options
    };

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
  }, [token]);

  const fetchActiveFast = useCallback(async () => {
    try {
      console.log('Fetching active fast...');
      const fast = await apiCall('/fasting/active');
      console.log('Active fast response:', fast);
      setActiveFast(fast);
    } catch (error) {
      console.error('Error fetching active fast:', error);
      if (error.message.includes('No active fasting session')) {
        setActiveFast(null);
      }
    }
  }, [apiCall]);

  const fetchFastingHistory = useCallback(async () => {
    try {
      console.log('Fetching fasting history...');
      const history = await apiCall('/fasting/history');
      console.log('History response:', history);
      setFastingHistory(history);
    } catch (error) {
      console.error('Error fetching history:', error);
    }
  }, [apiCall]);

  const fetchFastingStats = useCallback(async () => {
    try {
      console.log('Fetching fasting stats...');
      const stats = await apiCall('/fasting/stats');
      console.log('Stats response:', stats);
      setFastingStats(stats);
    } catch (error) {
      console.error('Error fetching stats:', error);
      setFastingStats({
        completedSessions: 0,
        completionRate: 0,
        totalHoursFasted: 0
      });
    }
  }, [apiCall]);

  // Check for existing token on component mount
  useEffect(() => {
    const savedToken = localStorage.getItem('token');
    if (savedToken) {
      setToken(savedToken);
      setCurrentView('dashboard');
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
  }, [token, fetchActiveFast, fetchFastingStats]);

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

  const handleLogout = () => {
    console.log('Logging out...');
    setToken(null);
    setUser(null);
    setActiveFast(null);
    setFastingHistory([]);
    setFastingStats(null);
    setElapsedTime(0);
    setSelectedDay(null);
    localStorage.removeItem('token');
    setCurrentView('auth');
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
      
      setToken(data.token);
      setUser(data.user);
      localStorage.setItem('token', data.token);
      setAuthForm({ username: '', email: '', password: '' });
      
    } catch (error) {
      console.error('Auth error:', error);
      setAuthError(error.message);
    } finally {
      setIsLoading(false);
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

  // History Screen - New Weekly Square Design
  if (currentView === 'history') {
    if (fastingHistory.length === 0) {
      fetchFastingHistory();
    }

    const weeklyData = getWeeklyHistory();

    return (
      <div className="app">
        <div className="background-gradient"></div>
        
        <div className="container">
          <div className="glass-panel">
            <div className="header">
              <h1 className="title">{currentMonth} Fasting History</h1>
              <div className="user-info">
                <button onClick={() => setCurrentView('dashboard')} className="nav-button">
                  Dashboard
                </button>
                <button onClick={handleLogout} className="logout-button">
                  Logout
                </button>
              </div>
            </div>
            
            <div className={`history-container ${selectedDay ? 'details-open' : ''}`}>
              {fastingHistory.length === 0 ? (
                <div className="empty-state">
                  <p>No fasting sessions yet. Start your first fast!</p>
                </div>
              ) : (
                <div className="weekly-history">
                  <div className="week-labels">
                    <div className="week-label-item">Sun</div>
                    <div className="week-label-item">Mon</div>
                    <div className="week-label-item">Tue</div>
                    <div className="week-label-item">Wed</div>
                    <div className="week-label-item">Thu</div>
                    <div className="week-label-item">Fri</div>
                    <div className="week-label-item">Sat</div>
                  </div>
                  
                  {weeklyData.map((week, weekIndex) => (
                    <div key={weekIndex} className="week-row">
                      {week.days.map((day, dayIndex) => (
                        <div 
                          key={dayIndex}
                          className={`day-square ${day.status}`}
                          onClick={() => {
                            if (day.fasts.length > 0) {
                              setSelectedDay(selectedDay?.date?.toDateString() === day.date.toDateString() ? null : day);
                            }
                          }}
                          title={`${day.date.toLocaleDateString()} - ${day.fasts.length} fasts`}
                        >
                          <div className="day-number">{day.dayNumber}</div>
                          {day.fasts.length > 0 && (
                            <div className="fast-indicator">
                              {day.primaryFast?.protocol || day.fasts[0].protocol}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  ))}
                </div>
              )}

              {/* Expanded Day Details */}
              {selectedDay && (
                <div className={`day-details ${selectedDay ? 'visible' : ''}`}>
                  <div className="day-details-header">
                    <h3>{selectedDay.date.toLocaleDateString('en', { 
                      weekday: 'long', 
                      year: 'numeric', 
                      month: 'long', 
                      day: 'numeric' 
                    })}</h3>
                    <button 
                      className="close-details"
                      onClick={() => setSelectedDay(null)}
                    >
                      ×
                    </button>
                  </div>
                  
                  <div className="day-details-content">
                    {selectedDay.fasts.map((fast) => (
                      <div key={fast._id} className="fast-detail-card">
                        <div className="fast-detail-header">
                          <span className="protocol">{fast.protocol}</span>
                          <span className={`status ${fast.status}`}>{fast.status}</span>
                        </div>
                        
                        <div className="fast-detail-info">
                          <div className="info-row">
                            <span>Duration:</span>
                            <span>{fast.durationHours} hours</span>
                          </div>
                          <div className="info-row">
                            <span>Started:</span>
                            <span>{new Date(fast.startTime).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</span>
                          </div>
                          {fast.endTime && (
                            <div className="info-row">
                              <span>Ended:</span>
                              <span>{new Date(fast.endTime).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</span>
                            </div>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
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