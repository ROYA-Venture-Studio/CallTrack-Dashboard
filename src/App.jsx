import { useState, useEffect } from 'react';
import { signInWithEmailAndPassword, onAuthStateChanged, signOut } from 'firebase/auth';
import { collection, query, orderBy, onSnapshot, limit } from 'firebase/firestore';
import { ref, getDownloadURL } from 'firebase/storage';
import { auth, db, storage } from './firebase';
import './App.css';

function App() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [records, setRecords] = useState([]);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [playingId, setPlayingId] = useState(null);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      setUser(user);
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    if (!user) return;

    const q = query(
      collection(db, 'call_records'),
      orderBy('timestamp', 'desc'),
      limit(100)
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const data = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      setRecords(data);
    });

    return () => unsubscribe();
  }, [user]);

  const handleLogin = async (e) => {
    e.preventDefault();
    setError('');
    try {
      await signInWithEmailAndPassword(auth, email, password);
    } catch (err) {
      setError('Invalid email or password');
    }
  };

  const handleLogout = () => signOut(auth);

  const formatDuration = (seconds) => {
    if (!seconds) return '0:00';
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const formatDate = (timestamp) => {
    if (!timestamp) return 'N/A';
    const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
    return date.toLocaleString();
  };

  const playRecording = async (record) => {
    // Check for direct URL first, then try storage path
    const audioUrl = record.storageUrl || record.recordingPath;
    if (!audioUrl) return;
    
    try {
      let url = audioUrl;
      
      // If it's a storage path (not a full URL), get download URL
      if (!audioUrl.startsWith('http')) {
        const audioRef = ref(storage, audioUrl);
        url = await getDownloadURL(audioRef);
      }
      
      const audio = new Audio(url);
      audio.play();
      setPlayingId(record.id);
      
      audio.onended = () => setPlayingId(null);
    } catch (err) {
      console.error('Error playing recording:', err);
      alert('Could not play recording');
    }
  };

  if (loading) {
    return <div className="loading">Loading...</div>;
  }

  if (!user) {
    return (
      <div className="login-container">
        <div className="login-box">
          <h1>��� Call Track</h1>
          <p>Admin Dashboard</p>
          <form onSubmit={handleLogin}>
            <input
              type="email"
              placeholder="Email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
            <input
              type="password"
              placeholder="Password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
            {error && <div className="error">{error}</div>}
            <button type="submit">Login</button>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div className="dashboard">
      <header>
        <h1>��� Call Track Dashboard</h1>
        <div className="header-right">
          <span>{user.email}</span>
          <button onClick={handleLogout}>Logout</button>
        </div>
      </header>

      <main>
        <div className="stats">
          <div className="stat-card">
            <h3>Total Recordings</h3>
            <p>{records.length}</p>
          </div>
          <div className="stat-card">
            <h3>Today</h3>
            <p>{records.filter(r => {
              const date = r.timestamp?.toDate ? r.timestamp.toDate() : new Date(r.timestamp);
              return date.toDateString() === new Date().toDateString();
            }).length}</p>
          </div>
        </div>

        <div className="table-container">
          <table>
            <thead>
              <tr>
                <th>Date & Time</th>
                <th>From (Device)</th>
                <th>Number Called</th>
                <th>Type</th>
                <th>Duration</th>
                <th>Recording</th>
              </tr>
            </thead>
            <tbody>
              {records.length === 0 ? (
                <tr>
                  <td colSpan="6" className="no-data">No call records yet</td>
                </tr>
              ) : (
                records.map((record) => (
                  <tr key={record.id}>
                    <td>{formatDate(record.timestamp)}</td>
                    <td>{record.deviceId || record.deviceName || 'Unknown'}</td>
                    <td className="phone-number">{record.phoneNumber || 'Unknown'}</td>
                    <td>
                      <span className={`call-type ${record.callType?.toLowerCase()}`}>
                        {record.callType || 'Unknown'}
                      </span>
                    </td>
                    <td>{formatDuration(record.duration)}</td>
                    <td>
                      {(record.storageUrl || record.recordingPath) ? (
                        <button 
                          className={`play-btn ${playingId === record.id ? 'playing' : ''}`}
                          onClick={() => playRecording(record)}
                        >
                          {playingId === record.id ? '⏸️ Playing' : '▶️ Play'}
                        </button>
                      ) : (
                        <span className="no-recording">No recording</span>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </main>
    </div>
  );
}

export default App;
