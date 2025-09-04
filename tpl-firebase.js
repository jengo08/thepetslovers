// TPL: INICIO BLOQUE NUEVO [tpl-firebase.js — Inicialización Firebase para navegador]
// SDKs desde CDN (válidos en navegador, sin bundlers)
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.3/firebase-app.js";
import { getAnalytics } from "https://www.gstatic.com/firebasejs/10.12.3/firebase-analytics.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/10.12.3/firebase-auth.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/10.12.3/firebase-firestore.js";
import { getStorage } from "https://www.gstatic.com/firebasejs/10.12.3/firebase-storage.js";

// Tu configuración (tal cual me la pasaste)
const firebaseConfig = {
  apiKey: "AIzaSyDW73aFuz2AFS9VeWg_linHIRJYN4YMgTk",
  authDomain: "thepetslovers-c1111.firebaseapp.com",
  projectId: "thepetslovers-c1111",
  storageBucket: "thepetslovers-c1111.firebasestorage.app",
  messagingSenderId: "415914577533",
  appId: "1:415914577533:web:0b7a056ebaa4f1de28ab14",
  measurementId: "G-FXPD69KXBG"
};

// Inicializa Firebase
const app = initializeApp(firebaseConfig);

// Analytics opcional (si falla, seguimos igual)
try { getAnalytics(app); } catch { /* noop */ }

// Expón en window para que otros scripts puedan usarlo
window.firebaseConfig = firebaseConfig;
window.firebaseApp = app;
window.tplFirebase = { getAuth, getFirestore, getStorage };

console.log('[TPL] Firebase inicializado:', app?.name || 'ok');
// TPL: FIN BLOQUE NUEVO
