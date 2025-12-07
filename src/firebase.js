import { initializeApp } from 'firebase/app';
import { getFirestore } from 'firebase/firestore';
import { getAuth } from 'firebase/auth';
import { getStorage } from 'firebase/storage';

const firebaseConfig = {
  apiKey: 'AIzaSyBSx7vWdy8ZEhslWJBLd5TXuFN8dqYd4gw',
  authDomain: 'saaed-track-15ced.firebaseapp.com',
  projectId: 'saaed-track-15ced',
  storageBucket: 'saaed-track-15ced.firebasestorage.app',
  messagingSenderId: '368820343566',
  appId: '1:368820343566:web:30bbea6aefa945784cbd5f',
};

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);
export const auth = getAuth(app);
export const storage = getStorage(app);
