// firebase.ts
import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";
import { getAuth } from "firebase/auth";

const firebaseConfig = {
  apiKey: "AIzaSyBApQE8wyqZeQ1WlgI9racTVXW4e5GBB1M",
  authDomain: "marcenpro-50ad6.firebaseapp.com",
  projectId: "marcenpro-50ad6",
  storageBucket: "marcenpro-50ad6.firebasestorage.app",
  messagingSenderId: "100803672666",
  appId: "1:100803672666:web:4181d886b60cee4b357663"
};

const app = initializeApp(firebaseConfig);

export const db   = getFirestore(app);
export const auth = getAuth(app);
export default app;