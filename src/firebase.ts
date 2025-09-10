// Import the functions you need from the SDKs you need
import { initializeApp } from "firebase/app";
import { getAuth, GoogleAuthProvider } from "firebase/auth";
import { getFirestore } from "firebase/firestore";

// TODO: Add SDKs for Firebase products that you want to use
// https://firebase.google.com/docs/web/setup#available-libraries

// Your web app's Firebase configuration
const firebaseConfig = {
  apiKey: "AIzaSyACLF-q-cLOvCIkl7zN_4HlGZhcTPZ3ch8",
  authDomain: "craving-bites-inventory.firebaseapp.com",
  projectId: "craving-bites-inventory",
  storageBucket: "craving-bites-inventory.firebasestorage.app",
  messagingSenderId: "573496344486",
  appId: "1:573496344486:web:6fbf03f28bdc59a18dd967"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);

export const auth = getAuth(app);
export const provider = new GoogleAuthProvider();
export const db = getFirestore(app);
export default app;