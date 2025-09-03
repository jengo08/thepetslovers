/* ===========================
   TPL: INICIO BLOQUE NUEVO [Modal de reservas inline + Formspree + Firebase Firestore]
   =========================== */
(function () {
  'use strict';

  // -------- AJUSTA AQUÍ TU ENDPOINT DE FORMSPREE --------
  const FORMSPREE_ENDPOINT = 'https://formspree.io/f/mpwjjoyq';
  // ------------------------------------------------------

  // --- Mapeo de servicios (clave -> etiqueta visible) ---
  const SERVICE_LABELS = {
    "guarderia-dia": "Guardería de día",
    "visitas": "Visitas a domicilio (gatos)",
    "alojamiento": "Alojamiento nocturno",
    "paseos": "Paseos",
    "transporte": "Transporte",
    "bodas": "Bodas",
    "postoperatorio": "Postoperatorio",
    "exoticos": "Exóticos"
  };

  // --- CSS mínimo del modal (no toca tu CSS global) ---
  const CSS_ID = 'tpl-modal-styles';
  if (!document.getElementById(CSS_ID)) {
    const style = document.createElement('style');
    style.id = CSS_ID;
    style.textContent = `
      .tpl-modal{position:fixed;inset:0;z-index:9999;display:none}
      .tpl-modal[aria-hidden="false"]{display:block}
      .tpl-modal__backdrop{position:absolute;inset:0;background:rgba(0,0,0,.45)}
      .tpl-modal__dialog{position:relative;max-width:640px;margin:5vh auto;background:#fff;border-radius:12px;padding:18px;box-shadow:0 10px 30px rgba(0,0,0,.2)}
      .tpl-modal__header{display:flex;align-items:center;justify-content:space-between;gap:8px;margin-bottom:8px}
      .tpl-modal__title{font-size:1.1rem;font-weight:700;margin:0;color:var(--color-texto, #333)}
      .tpl-modal__close{appearance:none;border:none;background:#f3f3f3;border-radius:8px;padding:8px 10px;cursor:pointer}
      .tpl-modal__close:hover{background:#e9e9e9}
      .tpl-form{display:grid;gap:12px}
      @media (min-width:760px){.tpl-form{grid-template-columns:1fr 1fr}}
      .tpl-form .full{grid-column:1 / -1}
      .tpl-input,.tpl-select,.tpl-textarea{width:100%;padding:10px;border:1px solid #ddd;border-radius:8px;font:inherit}
      .tpl-submit{background:var(--color-principal,#339496);color:#fff;border:none;border-radius:8px;padding:12px 16px;font-weight:700;cursor:pointer}
      .tpl-submit:hover{background:#2a7e80}
      .tpl-help{font-size:.9rem;color:#555}
    `;
    document.head.appendChild(style);
  }

  // --- Crear modal una sola vez ---
  let modal = document.getElementById('tpl-modal-reserva');
  if (!modal) {
    modal = document.createElement('div');
    modal.className = 'tpl-modal';
    modal.id = 'tpl-modal-reserva';
    modal.setAttribute('aria-hidden', 'true');
    modal.innerHTML = `
      <div class="tpl-modal__backdrop" data-close></div>
      <div class="tpl-modal__dialog" role="dialog" aria-modal="true" aria-labelledby="tpl-modal-title">
        <div class="tpl-modal__header">
          <h3 class="tpl-modal__title" id="tpl-modal-title">Reserva rápida</h3>
          <button class="tpl-modal__close" type="button" aria-label="Cerrar" data-close>✕</button>
        </div>
        <form id="tpl-reserva-form" class="tpl-form" action="#" method="post" novalidate>
          <input type="hidden" id="tpl-servicio" name="servicio" value="">
          <div class="full">
            <label for="tpl-servicio-select">Servicio</label>
            <select id="tpl-servicio-select" class="tpl-select" required>
              <option value="" disabled selected>Selecciona un servicio</option>
              ${Object.entries(SERVICE_LABELS).map(([k,v]) => `<option value="${k}">${v}</option>`).join('')}
            </select>
          </div>

          <!-- SOLO para VISITAS GATOS -->
          <div id="tpl-visitas-block" class="full" style="display:none">
            <div class="tpl-form">
              <div>
                <label for="tpl-visitas-duracion">Duración de la visita (gatos)</label>
                <select id="tpl-visitas-duracion" name="visitas_duracion" class="tpl-select">
                  <option value="60">60 minutos</option>
                  <option value="90">90 minutos</option>
                </select>
              </div>
              <div>
                <label for="tpl-visitas-diarias">Visitas diarias</label>
                <select id="tpl-visitas-diarias" name="visitas_diarias" class="tpl-select">
                  <option value="1">1 visita al día</option>
                  <option value="2">2 visitas al día</option>
                </select>
                <small class="tpl-help">La 2ª visita del día es de medicación y se tarifica como tal.</small>
              </div>
            </div>
          </div>
          <!-- FIN SOLO VISITAS GATOS -->

          <div>
            <label for="tpl-fecha">Fecha</label>
            <input type="date" id="tpl-fecha" name="fecha" class="tpl-input" required>
          </div>
          <div>
            <label for="tpl-hora">Hora estimada</label>
            <input type="time" id="tpl-hora" name="hora" class="tpl-input" required>
          </div>
          <div>
            <label for="tpl-nombre">Tu nombre</label>
            <input type="text" id="tpl-nombre" name="nombre" class="tpl-input" placeholder="Nombre y apellidos" required>
          </div>
          <div>
            <label for="tpl-telefono">Teléfono</label>
            <input type="tel" id="tpl-telefono" name="telefono" class="tpl-input" inputmode="tel" placeholder="+34 ..." required>
          </div>
          <div class="full">
            <label for="tpl-direccion">Dirección (si aplica)</label>
            <input type="text" id="tpl-direccion" name="direccion" class="tpl-input" placeholder="Calle, nº, localidad">
          </div>
          <div class="full">
            <label for="tpl-notas">Notas</label>
            <textarea id="tpl-notas" name="notas" class="tpl-textarea" rows="3" placeholder="Hábitos, medicación, pautas del adiestrador..."></textarea>
          </div>
          <div class="full" style="display:flex;gap:10px;align-items:center;flex-wrap:wrap">
            <button type="submit" class="tpl-submit">Enviar solicitud</button>
            <span class="tpl-help">Al enviar, te contactaremos para confirmar disponibilidad y el/la cuidador/a más adecuado/a.</span>
          </div>
        </form>
      </div>
    `;
    document.body.appendChild(modal);
  }

  // --- Referencias ---
  const els = {
    modal,
    closeBtn: modal.querySelector('.tpl-modal__close'),
    form: modal.querySelector('#tpl-reserva-form'),
    servicioHidden: modal.querySelector('#tpl-servicio'),
    servicioSelect: modal.querySelector('#tpl-servicio-select'),
    fecha: modal.querySelector('#tpl-fecha'),
    hora: modal.querySelector('#tpl-hora'),
    title: modal.querySelector('#tpl-modal-title'),
    visitasBlock: modal.querySelector('#tpl-visitas-block')
  };

  // --- Utilidades fecha/hora ---
  function setMinDateToday() {
    const t = new Date();
    els.fecha.min = `${t.getFullYear()}-${String(t.getMonth()+1).padStart(2,'0')}-${String(t.getDate()).padStart(2,'0')}`;
  }
  function roundTimeToNextQuarter() {
    const d = new Date();
    d.setMinutes(d.getMinutes() + (15 - (d.getMinutes()%15))%15, 0, 0);
    els.hora.value = d.toTimeString().slice(0,5);
  }

  // --- Helpers ---
  function labelFromKey(key) { return SERVICE_LABELS[key] || key || 'Servicio'; }
  function syncVisitFields() {
    const isVisitas = (els.servicioSelect.value === 'visitas');
    if (els.visitasBlock) els.visitasBlock.style.display = isVisitas ? 'block' : 'none';
  }
  function preselectService(key) {
    if (!key) return;
    els.servicioHidden.value = key;
    els.servicioSelect.value = key;
    els.title.textContent = `Reserva rápida — ${labelFromKey(key)}`;
    syncVisitFields();
  }
  function openModal(key) {
    preselectService(key);
    setMinDateToday();
    roundTimeToNextQuarter();
    els.modal.setAttribute('aria-hidden','false');
    setTimeout(()=> els.servicioSelect.focus(), 0);
    document.documentElement.style.overflow = 'hidden'; // bloquear fondo
  }
  function closeModal() {
    els.modal.setAttribute('aria-hidden','true');
    document.documentElement.style.overflow = '';
  }

  // --- Cierre del modal ---
  modal.addEventListener('click', (e)=> { if (e.target.matches('[data-close]')) closeModal(); });
  els.closeBtn.addEventListener('click', closeModal);
  document.addEventListener('keydown', (e)=> { if (e.key === 'Escape' && modal.getAttribute('aria-hidden') === 'false') closeModal(); });
  els.servicioSelect.addEventListener('change', syncVisitFields);

  // --- Envío a Formspree + Firebase ---
  els.form.addEventListener('submit', async (e)=> {
    e.preventDefault();

    const payload = Object.fromEntries(new FormData(els.form).entries());
    // 1) Guardar en Firebase Firestore (si está disponible o si tenemos config)
    try {
      await ensureFirebaseModuleReady();
      window.dispatchEvent(new CustomEvent('tpl:reserva', { detail: payload }));
    } catch (err) {
      console.warn('TPL: Firebase no disponible, continuamos solo con Formspree.', err);
    }

    // 2) Enviar a Formspree (correo)
    try {
      const fd = new FormData();
      // Campos “bonitos” para el email
      fd.append('Servicio', labelFromKey(payload.servicio));
      fd.append('Fecha', payload.fecha || '');
      fd.append('Hora', payload.hora || '');
      fd.append('Nombre', payload.nombre || '');
      fd.append('Teléfono', payload.telefono || '');
      fd.append('Dirección', payload.direccion || '');
      fd.append('Notas', payload.notas || '');
      if (payload.servicio === 'visitas') {
        fd.append('Duración (min)', payload.visitas_duracion || '');
        fd.append('Visitas diarias', payload.visitas_diarias || '');
      }
      // Marca interna
      fd.append('_subject', 'Nueva reserva rápida — The Pets Lovers');
      fd.append('_template', 'table');

      await fetch(FORMSPREE_ENDPOINT, { method: 'POST', body: fd, mode: 'cors' });
      alert('¡Gracias! Hemos recibido tu solicitud. Te contactaremos para confirmar.');
      closeModal();
      els.form.reset();
      syncVisitFields();
    } catch (err) {
      console.error('TPL: Error enviando a Formspree:', err);
      alert('Tu solicitud no pudo enviarse por email. Inténtalo de nuevo en unos minutos o contáctanos por WhatsApp.');
    }
  });

  // --- API global para abrir desde botones: onclick="abrirReserva('guarderia-dia')" ---
  window.abrirReserva = function(key){ openModal(key); };

  // --- Interceptor de enlaces relevantes ---
  document.addEventListener('click', function(e){
    const a = e.target.closest('a'); if (!a) return;

    // 1) Hash clásico
    if (a.getAttribute('href') === '#reserva-rapida') {
      e.preventDefault();
      openModal('guarderia-dia');
      return;
    }

    // 2) Links a reserva.html (con o sin ?servicio=)
    const href = a.getAttribute('href') || '';
    if (href.startsWith('reserva.html')) {
      e.preventDefault();
      const params = new URLSearchParams((href.split('?')[1]||''));
      const key = params.get('servicio') || guessServiceFromContext(a) || 'guarderia-dia';
      openModal(key);
    }
  });

  // --- Deducción del servicio por contexto de tarjeta (fallback) ---
  function guessServiceFromContext(anchor) {
    const card = anchor.closest('.service-card');
    const h3 = card ? card.querySelector('h3') : null;
    const txt = (h3 ? h3.textContent : '').toLowerCase();
    if (txt.includes('guardería')) return 'guarderia-dia';
    if (txt.includes('visitas')) return 'visitas';
    if (txt.includes('alojamiento')) return 'alojamiento';
    if (txt.includes('paseos')) return 'paseos';
    if (txt.includes('transporte')) return 'transporte';
    if (txt.includes('bodas')) return 'bodas';
    if (txt.includes('post')) return 'postoperatorio';
    if (txt.includes('exót') || txt.includes('exot')) return 'exoticos';
    return '';
  }

  // --- Auto-abrir si la URL actual trae ?servicio= ---
  (function autoOpenFromQuery(){
    try {
      const params = new URLSearchParams(location.search);
      const key = params.get('servicio');
      if (key) openModal(key);
    } catch(e){}
  })();

  // ============================================
  //  CARGA DEL MÓDULO FIREBASE (solo si hace falta)
  //  - Inyectamos un <script type="module"> que escucha el evento 'tpl:reserva'
  //  - Reutiliza la app existente (getApps), o usa window.__TPL_FIREBASE_CONFIG
  // ============================================
  let firebaseModuleInjected = false;
  async function ensureFirebaseModuleReady() {
    if (firebaseModuleInjected) return;
    firebaseModuleInjected = true;

    const mod = document.createElement('script');
    mod.type = 'module';
    mod.textContent = `
      import { initializeApp, getApp, getApps } from "https://www.gstatic.com/firebasejs/10.12.4/firebase-app.js";
      import { getFirestore, collection, addDoc, serverTimestamp } from "https://www.gstatic.com/firebasejs/10.12.4/firebase-firestore.js";

      // Reusar app si ya existe (por tus reservas). Si no, inicializar con window.__TPL_FIREBASE_CONFIG
      let app;
      if (getApps().length) {
        app = getApp();
      } else {
        const cfg = window.__TPL_FIREBASE_CONFIG;
        if (!cfg) {
          throw new Error("No hay app Firebase ni __TPL_FIREBASE_CONFIG definido.");
        }
        app = initializeApp(cfg);
      }
      const db = getFirestore(app);

      // Escuchar el evento del modal para guardar en Firestore
      window.addEventListener('tpl:reserva', async (ev) => {
        try {
          const d = ev.detail || {};
          await addDoc(collection(db, "reservas_rapidas"), {
            ...d,
            servicio_label: (${labelFromKey.toString()})(d.servicio),
            createdAt: serverTimestamp(),
            userAgent: navigator.userAgent || '',
            page: location.href
          });
          console.log('TPL(Firebase): reserva guardada en Firestore');
        } catch (err) {
          console.warn('TPL(Firebase): no se pudo guardar la reserva:', err?.message || err);
        }
      });
    `;
    document.head.appendChild(mod);
  }

})();
/* ===========================
   TPL: FIN BLOQUE NUEVO
   =========================== */

/* ===========================
   TPL: INICIO BLOQUE NUEVO [Airbag JS mínimo para evitar pantalla en blanco]
   =========================== */
(function(){
  try {
    window.addEventListener('error', function(e){
      console.warn('TPL: error global capturado:', e.message);
    });
    window.addEventListener('unhandledrejection', function(e){
      console.warn('TPL: promesa rechazada:', (e.reason && e.reason.message) || e.reason);
    });
  } catch(_) {}
})();
/* TPL: FIN BLOQUE NUEVO */
<!-- TPL: INICIO BLOQUE NUEVO [Bootstrap Firebase + Proveedores Email/Google/Facebook/Microsoft] -->
<script>
(function(){
  // 1) TU CONFIG (ya la traías). La dejo disponible globalmente para otros módulos (p. ej. el modal de reservas).
  window.__TPL_FIREBASE_CONFIG = {
    apiKey: "AIzaSyDW73aFuz2AFS9VeWg_linHIRJYN4YMgTk",
    authDomain: "thepetslovers-c1111.firebaseapp.com",
    projectId: "thepetslovers-c1111",
    storageBucket: "thepetslovers-c1111.firebasestorage.app",
    messagingSenderId: "415914577533",
    appId: "1:415914577533:web:0b7a056ebaa4f1de28ab14",
    measurementId: "G-FXPD69KXBG"
  };

  // 2) Inyecto un módulo ES para usar el SDK modular sin build y sin romper tu JS actual.
  const mod = document.createElement('script');
  mod.type = 'module';
  mod.textContent = `
    import { initializeApp, getApps, getApp } from "https://www.gstatic.com/firebasejs/10.12.4/firebase-app.js";
    import {
      getAuth, onAuthStateChanged, signInWithEmailAndPassword, createUserWithEmailAndPassword, sendPasswordResetEmail,
      GoogleAuthProvider, FacebookAuthProvider, OAuthProvider,
      signInWithPopup, signInWithRedirect, signOut
    } from "https://www.gstatic.com/firebasejs/10.12.4/firebase-auth.js";
    import { getFirestore } from "https://www.gstatic.com/firebasejs/10.12.4/firebase-firestore.js";

    const cfg = window.__TPL_FIREBASE_CONFIG;
    let app = getApps().length ? getApp() : initializeApp(cfg);
    const auth = getAuth(app);
    const db = getFirestore(app); // por si lo necesitas en el futuro

    // Proveedores
    const providerGoogle = new GoogleAuthProvider();
    const providerFacebook = new FacebookAuthProvider();
    const providerMicrosoft = new OAuthProvider('microsoft.com');

    const isIOS = /iP(ad|hone|od)/i.test(navigator.userAgent);
    const isSafari = /^((?!chrome|android).)*safari/i.test(navigator.userAgent);

    // Exponemos una API simple para la UI (login modal/inline que pongamos)
    const listeners = [];
    onAuthStateChanged(auth, (user) => { listeners.forEach(fn => fn(user || null)); });

    async function signInProvider(provider){
      // En iOS Safari mejor redirect para evitar bloqueos de pop-up
      if (isIOS && isSafari) return signInWithRedirect(auth, provider);
      return signInWithPopup(auth, provider);
    }

    window.tplAuth = {
      // Estado
      onChange(cb){ if (typeof cb==='function') listeners.push(cb); },
      getUser(){ return auth.currentUser || null; },

      // Email/Password
      async emailSignIn(email, pass){ return signInWithEmailAndPassword(auth, email, pass); },
      async emailSignUp(email, pass){ return createUserWithEmailAndPassword(auth, email, pass); },
      async emailReset(email){ return sendPasswordResetEmail(auth, email); },

      // Sociales
      google(){ return signInProvider(providerGoogle); },
      facebook(){ return signInProvider(providerFacebook); },
      microsoft(){ return signInProvider(providerMicrosoft); },

      // Salir
      async signOut(){ return signOut(auth); }
    };

    // Utilidad opcional por si quieres mostrar/ocultar botones con data-auth-visible="in|out"
    function syncAuthVisibility(user){
      document.querySelectorAll('[data-auth-visible]').forEach(el=>{
        const mode = el.getAttribute('data-auth-visible');
        el.style.display = (mode==='in' && user) || (mode==='out' && !user) ? '' : 'none';
      });
    }
    window.tplAuth.onChange(syncAuthVisibility);
    syncAuthVisibility(auth.currentUser);
  `;
  document.head.appendChild(mod);
})();
</script>
<!-- TPL: FIN BLOQUE NUEVO -->

