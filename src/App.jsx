import { useState, useEffect } from 'react';
import { signInWithEmailAndPassword, onAuthStateChanged, signOut } from 'firebase/auth';
import { collection, query, orderBy, onSnapshot, limit, doc, setDoc, getDoc } from 'firebase/firestore';
import { ref, getDownloadURL } from 'firebase/storage';
import { auth, db, storage } from './firebase';
import './App.css';

function App() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [records, setRecords] = useState([]);
  const [filteredRecords, setFilteredRecords] = useState([]);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [playingId, setPlayingId] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState('newest');
  const [audioElement, setAudioElement] = useState(null);
  const [currentAudioUrl, setCurrentAudioUrl] = useState(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [contactMappings, setContactMappings] = useState({});
  const [newContactPhone, setNewContactPhone] = useState('');
  const [newContactName, setNewContactName] = useState('');
  const recordsPerPage = 5;

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      setUser(user);
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  // Load contact mappings
  useEffect(() => {
    if (!user) return;

    const loadMappings = async () => {
      try {
        const docRef = doc(db, 'settings', 'contact_mappings');
        const docSnap = await getDoc(docRef);
        if (docSnap.exists()) {
          setContactMappings(docSnap.data() || {});
        }
      } catch (err) {
        console.error('Error loading contact mappings:', err);
      }
    };

    loadMappings();
  }, [user]);

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
      console.log('=== ALL CALL RECORDS ===');
      data.forEach((record, index) => {
        console.log(`Record ${index + 1}:`, {
          id: record.id,
          timestamp: record.timestamp,
          phoneNumber: record.phoneNumber,
          contactName: record.contactName,
          callType: record.callType,
          duration: record.duration,
          deviceId: record.deviceId,
          deviceName: record.deviceName,
          hostPhoneNumber: record.hostPhoneNumber,
          hostName: record.hostName,
          storageUrl: record.storageUrl ? 'Present' : 'Missing',
          firestoreId: record.firestoreId
        });
      });
      console.log('Total records:', data.length);
      setRecords(data);
      setFilteredRecords(data);
    });

    return () => unsubscribe();
  }, [user]);

  // Filter and sort records
  useEffect(() => {
    let filtered = [...records];

    // Apply search filter
    if (searchQuery.trim()) {
      filtered = filtered.filter(record => {
        const query = searchQuery.toLowerCase();
        const mappedHostName = contactMappings[record.hostPhoneNumber] || '';
        
        return (
          // Search in number called
          record.phoneNumber?.toLowerCase().includes(query) ||
          // Search in contact name
          record.contactName?.toLowerCase().includes(query) ||
          // Search in host phone number
          record.hostPhoneNumber?.toLowerCase().includes(query) ||
          // Search in mapped host name (from contact mappings)
          mappedHostName.toLowerCase().includes(query) ||
          // Search in actual host name (from app settings)
          record.hostName?.toLowerCase().includes(query)
        );
      });
    }

    // Apply sorting
    filtered.sort((a, b) => {
      switch (sortBy) {
        case 'newest':
          return (b.timestamp || 0) - (a.timestamp || 0);
        case 'oldest':
          return (a.timestamp || 0) - (b.timestamp || 0);
        case 'longest':
          return (b.duration || 0) - (a.duration || 0);
        case 'shortest':
          return (a.duration || 0) - (b.duration || 0);
        default:
          return 0;
      }
    });

    setFilteredRecords(filtered);
    setCurrentPage(1); // Reset to first page when filter changes
  }, [records, searchQuery, sortBy, contactMappings]);

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
    const audioUrl = record.storageUrl || record.recordingPath;
    if (!audioUrl) return;
    
    try {
      // If same recording is already loaded, do nothing (user can control via player)
      if (playingId === record.id) {
        return;
      }

      // Stop any currently playing audio
      if (audioElement) {
        audioElement.pause();
      }
      
      let url = audioUrl;
      if (!audioUrl.startsWith('http')) {
        const audioRef = ref(storage, audioUrl);
        url = await getDownloadURL(audioRef);
      }
      
      setPlayingId(record.id);
      setCurrentAudioUrl(url);
    } catch (err) {
      console.error('Error playing recording:', err);
      alert('Could not play recording');
    }
  };

  const stopAudio = () => {
    setPlayingId(null);
    setCurrentAudioUrl(null);
    setAudioElement(null);
  };

  const saveContactMapping = async (e) => {
    e.preventDefault();
    if (!newContactPhone.trim() || !newContactName.trim()) {
      alert('Please enter both phone number and name');
      return;
    }

    try {
      const updatedMappings = {
        ...contactMappings,
        [newContactPhone]: newContactName
      };
      
      await setDoc(doc(db, 'settings', 'contact_mappings'), updatedMappings);
      setContactMappings(updatedMappings);
      setNewContactPhone('');
      setNewContactName('');
      alert('Contact mapping saved successfully!');
    } catch (err) {
      console.error('Error saving contact mapping:', err);
      alert('Failed to save contact mapping');
    }
  };

  const deleteContactMapping = async (phoneNumber) => {
    if (!confirm(`Delete mapping for ${phoneNumber}?`)) return;

    try {
      const updatedMappings = { ...contactMappings };
      delete updatedMappings[phoneNumber];
      
      await setDoc(doc(db, 'settings', 'contact_mappings'), updatedMappings);
      setContactMappings(updatedMappings);
    } catch (err) {
      console.error('Error deleting contact mapping:', err);
      alert('Failed to delete contact mapping');
    }
  };

  const getHostDisplayName = (record) => {
    // Use hostName if available
    if (record.hostName) {
      return record.hostName;
    }
    
    // Otherwise use hostPhoneNumber with mapping
    if (!record.hostPhoneNumber) {
      console.warn('⚠️ Missing hostPhoneNumber in record');
      return 'Unknown';
    }
    const name = contactMappings[record.hostPhoneNumber];
    const result = name ? `${name} (${record.hostPhoneNumber})` : record.hostPhoneNumber;
    return result;
  };

  const copyToClipboard = async (url) => {
    try {
      await navigator.clipboard.writeText(url);
      alert('Link copied to clipboard!');
    } catch (err) {
      console.error('Failed to copy:', err);
      alert('Failed to copy link');
    }
  };

  // Pagination
  const indexOfLastRecord = currentPage * recordsPerPage;
  const indexOfFirstRecord = indexOfLastRecord - recordsPerPage;
  const currentRecords = filteredRecords.slice(indexOfFirstRecord, indexOfLastRecord);
  const totalPages = Math.ceil(filteredRecords.length / recordsPerPage);

  const paginate = (pageNumber) => setCurrentPage(pageNumber);

  if (loading) {
    return <div className="loading">Loading...</div>;
  }

  if (!user) {
    return (
      <div className="login-container">
        <div className="login-box">
          <h1>Call Track</h1>
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
      <header className="top-bar">
        <h1>Call Recording Dashboard</h1>
        <div className="header-right">
          <span className="user-email">{user.email}</span>
          <button onClick={handleLogout} className="logout-btn">Logout</button>
        </div>
      </header>

      <main className="main-content">
        <div className="content-wrapper">

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
            <div className="stat-card">
              <h3>Showing</h3>
              <p>{filteredRecords.length} of {records.length}</p>
            </div>
          </div>

          <div className="filters-container">
            <input
              type="text"
              placeholder="Search by host name, phone number..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="search-input"
            />
            <select 
              value={sortBy} 
              onChange={(e) => setSortBy(e.target.value)}
              className="sort-select"
            >
              <option value="newest">Newest First</option>
              <option value="oldest">Oldest First</option>
              <option value="longest">Longest Duration</option>
              <option value="shortest">Shortest Duration</option>
            </select>
          </div>

          <div className="table-container">
            <table>
              <thead>
                <tr>
                  <th>Date & Time</th>
                  <th>Host (Device Owner)</th>
                  <th>Number Called</th>
                  <th>Type</th>
                  <th>Duration</th>
                  <th>Recording</th>
                  <th>Share</th>
                </tr>
              </thead>
              <tbody>
                {currentRecords.length === 0 ? (
                  <tr>
                    <td colSpan="7" className="no-data">
                      {searchQuery ? 'No matching records found' : 'No call records yet'}
                    </td>
                  </tr>
                ) : (
                  currentRecords.map((record) => (
                    <tr key={record.id}>
                      <td>{formatDate(record.timestamp)}</td>
                      <td className="host-info">
                        <div className="host-cell">
                          <div className="host-number">{getHostDisplayName(record)}</div>
                          {record.hostPhoneNumber && <div className="device-name">{record.hostPhoneNumber}</div>}
                          {record.deviceName && <div className="device-name">{record.deviceName}</div>}
                          {record.deviceId && <div className="device-id">{record.deviceId}</div>}
                        </div>
                      </td>
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
                      <td>
                        {record.storageUrl ? (
                          <button 
                            className="share-btn"
                            onClick={() => copyToClipboard(record.storageUrl)}
                            title="Copy link to clipboard"
                          >
                            🔗 Share
                          </button>
                        ) : (
                          <span className="no-share">-</span>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="pagination">
              <button 
                onClick={() => paginate(currentPage - 1)}
                disabled={currentPage === 1}
                className="page-btn"
              >
                Previous
              </button>
              <span className="page-info">
                Page {currentPage} of {totalPages}
              </span>
              <button 
                onClick={() => paginate(currentPage + 1)}
                disabled={currentPage === totalPages}
                className="page-btn"
              >
                Next
              </button>
            </div>
          )}
        </div>

        {/* Audio Player */}
        {currentAudioUrl && (
          <div className="audio-player-container">
            <div className="audio-player">
              <span className="audio-label">Now Playing</span>
              <audio 
                controls 
                src={currentAudioUrl}
                autoPlay
                onEnded={stopAudio}
                ref={(audio) => {
                  if (audio) setAudioElement(audio);
                }}
              />
              <button className="close-player" onClick={stopAudio}>×</button>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}

export default App;
