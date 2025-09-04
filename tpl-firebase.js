<!-- TPL: INICIO BLOQUE NUEVO [tpl-firebase.js — Inicialización Firebase para navegador] -->
<script type="module">
// SDKs desde CDN (válidos en navegador, sin bundlers)
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.3/firebase-app.js";
// (Opcional) Si más adelante quieres analytics, lo dejo envainado para que no rompa nada
import { getAnalytics } from "https://www.gstatic.com/firebasejs/10.12.3/firebase-analytics.js";
// (Los usaremos en pasos siguientes, solo los expongo)
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

// Analytics (no obligatorio). Lo intento y si no se puede, sigo sin fallar la página.
try { getAnalytics(app); } catch (e) { /* noop */ }

// Expongo en window para que cualquier otro script pueda usarlo.
window.firebaseConfig = firebaseConfig;
window.firebaseApp = app;
// Atajos a los “get*” sin instanciar todavía (los usaremos después)
window.tplFirebase = { getAuth, getFirestore, getStorage };

console.log('[TPL] Firebase inicializado:', app?.name || 'ok');
</script>
<!-- TPL: FIN BLOQUE NUEVO -->
