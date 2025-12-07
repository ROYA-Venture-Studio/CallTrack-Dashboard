// Run with: node create-admin.js
import { initializeApp } from 'firebase/app';
import { getAuth, createUserWithEmailAndPassword } from 'firebase/auth';

const firebaseConfig = {
  apiKey: "AIzaSyDtkw077MO4x7x5IXT2PZa-rQFLbvz_l_M",
  authDomain: "call-track-164b6.firebaseapp.com",
  projectId: "call-track-164b6",
  storageBucket: "call-track-164b6.firebasestorage.app",
  messagingSenderId: "865867377848",
  appId: "1:865867377848:web:YOUR_WEB_APP_ID"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);

const email = process.argv[2] || 'admin@calltrack.app';
const password = process.argv[3] || 'CallTrack2024!';

createUserWithEmailAndPassword(auth, email, password)
  .then((userCredential) => {
    console.log('✅ Admin user created successfully!');
    console.log('Email:', email);
    console.log('Password:', password);
    console.log('UID:', userCredential.user.uid);
    process.exit(0);
  })
  .catch((error) => {
    console.error('❌ Error:', error.message);
    process.exit(1);
  });
