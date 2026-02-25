import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
import { getStorage } from 'firebase/storage';

const firebaseConfig = {
  apiKey: "AIzaSyCSqeWyyDGX8EZcNmrBTb92_c93TA0jnik",
  authDomain: "call-track-164b6.firebaseapp.com",
  projectId: "call-track-164b6",
  storageBucket: "call-track-164b6.firebasestorage.app",
  messagingSenderId: "865867377848",
  appId: "1:865867377848:web:21fb506b37a39b774e984d",
  measurementId: "G-62GG17LZZC"
};


const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);
export const storage = getStorage(app);
