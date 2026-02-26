import { useState, useEffect, useCallback } from 'react';
import { login, logout, getStoredAuth, fetchRecords, getRecordingUrl, getContactMappings, saveContactMappings } from './api';
import './App.css';

const RECORDS_PER_PAGE = 20;

export default function App() {
  const [user, setUser]                     = useState(null);
  const [loading, setLoading]               = useState(true);
  const [records, setRecords]               = useState([]);
  const [filtered, setFiltered]             = useState([]);
  const [email, setEmail]                   = useState('');
  const [password, setPassword]             = useState('');
  const [loginError, setLoginError]         = useState('');
  const [playingId, setPlayingId]           = useState(null);
  const [playingLabel, setPlayingLabel]     = useState('');
  const [search, setSearch]                 = useState('');
  const [sortBy, setSortBy]                 = useState('newest');
  const [currentPage, setCurrentPage]       = useState(1);
  const [currentAudioUrl, setCurrentAudioUrl] = useState(null);
  const [audioEl, setAudioEl]               = useState(null);
  const [mappings, setMappings]             = useState({});
  const [newPhone, setNewPhone]             = useState('');
  const [newName, setNewName]               = useState('');

  /* ── Auth ── */
  useEffect(() => {
    const stored = getStoredAuth();
    if (stored) setUser(stored);
    setLoading(false);
  }, []);

  useEffect(() => {
    if (!user) return;
    getContactMappings().then(setMappings).catch(console.error);
  }, [user]);

  /* ── Data ── */
  const loadRecords = useCallback(async () => {
    if (!user) return;
    try {
      const data = await fetchRecords(10000, 0, sortBy);
      setRecords(data.records || []);
    } catch (e) { console.error(e); }
  }, [user, sortBy]);

  useEffect(() => {
    loadRecords();
    const iv = setInterval(loadRecords, 30000);
    return () => clearInterval(iv);
  }, [loadRecords]);

  /* ── Filter / sort ── */
  useEffect(() => {
    let out = [...records];
    if (search.trim()) {
      const q = search.toLowerCase();
      out = out.filter(r =>
        r.phoneNumber?.toLowerCase().includes(q) ||
        r.contactName?.toLowerCase().includes(q) ||
        r.hostPhoneNumber?.toLowerCase().includes(q) ||
        r.hostName?.toLowerCase().includes(q) ||
        (mappings[r.hostPhoneNumber] || '').toLowerCase().includes(q)
      );
    }
    out.sort((a, b) => {
      if (sortBy === 'oldest')   return (a.timestamp || 0) - (b.timestamp || 0);
      if (sortBy === 'longest')  return (b.duration  || 0) - (a.duration  || 0);
      if (sortBy === 'shortest') return (a.duration  || 0) - (b.duration  || 0);
      return (b.timestamp || 0) - (a.timestamp || 0);
    });
    setFiltered(out);
    setCurrentPage(1);
  }, [records, search, sortBy, mappings]);

  /* ── Helpers ── */
  const fmt = (ts) => {
    if (!ts) return { date: 'N/A', time: '' };
    const d = ts.toDate ? ts.toDate() : new Date(ts);
    return {
      date: d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' }),
      time: d.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' }),
    };
  };

  const fmtDuration = (s) => {
    if (!s) return '0:00';
    const m = Math.floor(s / 60), secs = Math.floor(s % 60);
    return `${m}:${secs.toString().padStart(2, '0')}`;
  };

  const hostLabel = (r) => {
    if (r.hostName) return r.hostName;
    if (!r.hostPhoneNumber) return 'Unknown';
    return mappings[r.hostPhoneNumber]
      ? `${mappings[r.hostPhoneNumber]}`
      : r.hostPhoneNumber;
  };

  const badgeClass = (type) => {
    const t = (type || '').toLowerCase();
    if (t === 'incoming') return 'badge incoming';
    if (t === 'outgoing') return 'badge outgoing';
    if (t === 'missed')   return 'badge missed';
    return 'badge unknown';
  };

  /* ── Play ── */
  const playRecording = async (record) => {
    const key = record.recordingKey || record.storageUrl;
    if (!key || playingId === record._id) return;
    if (audioEl) audioEl.pause();
    try {
      const url = await getRecordingUrl(key);
      setPlayingId(record._id);
      setPlayingLabel(record.phoneNumber || 'Recording');
      setCurrentAudioUrl(url);
    } catch { alert('Could not load recording'); }
  };

  const stopAudio = () => {
    setPlayingId(null);
    setPlayingLabel('');
    setCurrentAudioUrl(null);
    setAudioEl(null);
  };

  /* ── Contact mappings ── */
  const saveMappings = async (e) => {
    e.preventDefault();
    if (!newPhone.trim() || !newName.trim()) return;
    const updated = { ...mappings, [newPhone.trim()]: newName.trim() };
    await saveContactMappings(updated);
    setMappings(updated);
    setNewPhone(''); setNewName('');
  };

  /* ── Pagination ── */
  const totalPages = Math.ceil(filtered.length / RECORDS_PER_PAGE);
  const pageStart  = (currentPage - 1) * RECORDS_PER_PAGE;
  const pageSlice  = filtered.slice(pageStart, pageStart + RECORDS_PER_PAGE);

  const pageNumbers = () => {
    if (totalPages <= 7) return Array.from({ length: totalPages }, (_, i) => i + 1);
    const pages = new Set([1, totalPages, currentPage, currentPage - 1, currentPage + 1].filter(p => p >= 1 && p <= totalPages));
    return [...pages].sort((a, b) => a - b);
  };

  /* ── Today count ── */
  const todayCount = records.filter(r => {
    const d = r.timestamp ? new Date(r.timestamp) : null;
    return d && d.toDateString() === new Date().toDateString();
  }).length;

  /* ── Loading / Login ── */
  if (loading) return <div className="loading">Loading…</div>;

  if (!user) return (
    <div className="login-container">
      <div className="login-box">
        <div className="login-logo">📞</div>
        <h1>Call Track</h1>
        <p>Admin Dashboard</p>
        <form onSubmit={async (e) => {
          e.preventDefault(); setLoginError('');
          try {
            const data = await login(email, password);
            setUser({ email: data.email });
          } catch { setLoginError('Invalid email or password'); }
        }}>
          <input type="email" placeholder="Email address" value={email}
            onChange={e => setEmail(e.target.value)} required autoFocus />
          <input type="password" placeholder="Password" value={password}
            onChange={e => setPassword(e.target.value)} required />
          {loginError && <div className="error">{loginError}</div>}
          <button type="submit">Sign in →</button>
        </form>
      </div>
    </div>
  );

  /* ── Dashboard ── */
  return (
    <div className="dashboard">

      {/* Top bar */}
      <header className="top-bar">
        <div className="top-bar-left">
          <div className="top-bar-icon">📞</div>
          <h1>Call Track</h1>
        </div>
        <div className="header-right">
          <div className="user-pill">👤 {user.email}</div>
          <button className="logout-btn" onClick={() => { logout(); setUser(null); }}>Sign out</button>
        </div>
      </header>

      <main className="main-content">
        <div className="content-wrapper">

          {/* Stats */}
          <div className="stats">
            <div className="stat-card">
              <h3>Total Recordings</h3>
              <p>{records.length}</p>
              <span className="stat-label">all time</span>
            </div>
            <div className="stat-card">
              <h3>Today</h3>
              <p>{todayCount}</p>
              <span className="stat-label">calls today</span>
            </div>
            <div className="stat-card">
              <h3>Filtered</h3>
              <p>{filtered.length}</p>
              <span className="stat-label">matching results</span>
            </div>
          </div>

          {/* Toolbar */}
          <div className="toolbar">
            <div className="search-wrap">
              <span className="search-icon">🔍</span>
              <input
                className="search-input"
                type="text"
                placeholder="Search by number, name, host…"
                value={search}
                onChange={e => setSearch(e.target.value)}
              />
            </div>
            <select className="sort-select" value={sortBy} onChange={e => setSortBy(e.target.value)}>
              <option value="newest">Newest first</option>
              <option value="oldest">Oldest first</option>
              <option value="longest">Longest duration</option>
              <option value="shortest">Shortest duration</option>
            </select>
            <button className="refresh-btn" onClick={loadRecords}>↻ Refresh</button>
          </div>

          {/* Table */}
          <div className="table-card">
            <div className="table-header">
              <h2>Call Records</h2>
              <span className="record-count">
                {pageStart + 1}–{Math.min(pageStart + RECORDS_PER_PAGE, filtered.length)} of {filtered.length}
              </span>
            </div>

            <div className="table-wrapper">
              <table>
                <thead>
                  <tr>
                    <th>Date & Time</th>
                    <th>Host / Device</th>
                    <th>Number Called</th>
                    <th>Type</th>
                    <th>Duration</th>
                    <th>Recording</th>
                  </tr>
                </thead>
                <tbody>
                  {pageSlice.length === 0 ? (
                    <tr><td className="no-data" colSpan="6">
                      {search ? 'No records match your search.' : 'No call records yet.'}
                    </td></tr>
                  ) : pageSlice.map((record) => {
                    const { date, time } = fmt(record.timestamp);
                    const hasAudio = !!(record.recordingKey || record.storageUrl);
                    const isPlaying = playingId === record._id;
                    return (
                      <tr key={record._id}>
                        <td>
                          <div className="date-cell">
                            {date}
                            <span className="time">{time}</span>
                          </div>
                        </td>
                        <td>
                          <div className="host-cell">
                            <span className="host-name">{hostLabel(record)}</span>
                            {record.hostPhoneNumber && <span className="host-sub">📱 {record.hostPhoneNumber}</span>}
                            {record.deviceName && <span className="host-sub device-model">🔧 {record.deviceName}</span>}
                          </div>
                        </td>
                        <td><span className="phone-cell">{record.phoneNumber || '—'}</span></td>
                        <td><span className={badgeClass(record.callType)}>{record.callType || 'Unknown'}</span></td>
                        <td><span className="duration-cell">{fmtDuration(record.duration)}</span></td>
                        <td>
                          <div className="action-group">
                            {hasAudio ? (
                              <>
                                <button className={`btn-play${isPlaying ? ' playing' : ''}`} onClick={() => playRecording(record)}>
                                  {isPlaying ? '⏸ Playing' : '▶ Play'}
                                </button>
                                <button className="btn-share" onClick={async () => {
                                  try {
                                    const url = await getRecordingUrl(record.recordingKey || record.storageUrl);
                                    await navigator.clipboard.writeText(url);
                                    alert('Link copied!');
                                  } catch { alert('Failed to copy link'); }
                                }}>
                                  ↗ Share
                                </button>
                              </>
                            ) : (
                              <span className="no-recording">No audio</span>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="pagination">
                <span className="pagination-info">
                  Showing {Math.min(RECORDS_PER_PAGE, filtered.length - pageStart)} of {filtered.length} records
                </span>
                <div className="pagination-controls">
                  <button className="page-btn" onClick={() => setCurrentPage(p => p - 1)} disabled={currentPage === 1}>
                    ← Prev
                  </button>
                  <div className="page-numbers">
                    {pageNumbers().reduce((acc, page, i, arr) => {
                      if (i > 0 && page - arr[i - 1] > 1) {
                        acc.push(<span key={`gap-${i}`} className="page-info">…</span>);
                      }
                      acc.push(
                        <button
                          key={page}
                          className={`page-number${currentPage === page ? ' active' : ''}`}
                          onClick={() => setCurrentPage(page)}
                        >{page}</button>
                      );
                      return acc;
                    }, [])}
                  </div>
                  <button className="page-btn" onClick={() => setCurrentPage(p => p + 1)} disabled={currentPage === totalPages}>
                    Next →
                  </button>
                </div>
              </div>
            )}
          </div>

        </div>
      </main>

      {/* Audio Player */}
      {currentAudioUrl && (
        <div className="audio-player-container">
          <div className="audio-player">
            <span className="audio-label">Now playing</span>
            <span className="audio-playing-name">{playingLabel}</span>
            <audio
              controls autoPlay src={currentAudioUrl}
              onEnded={stopAudio}
              ref={el => { if (el) setAudioEl(el); }}
            />
            <button className="close-player" onClick={stopAudio} title="Close">×</button>
          </div>
        </div>
      )}
    </div>
  );
}
