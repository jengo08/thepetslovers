/* tpl-navbar.js — Navbar unificada, navegación robusta y estado de sesión
   - Inyecta el HTML del navbar en #tpl-navbar (o lo crea si falta)
   - Carga Firebase (compat) si no está, y aplica auth state (signed-in/out)
   - Fuerza la navegación de enlaces del navbar (captura) para evitar bloqueos
   - Respeta el diseño: mismas clases y estructura que tu fallback
*/

(function () {
  const MOUNT_ID = 'tpl-navbar';

  // Anti-flicker: oculta elementos con data-auth-visible mientras resolvemos sesión
  try { document.documentElement.classList.add('tpl-auth-boot'); } catch (_) {}

  // --- Config Firebase (usa global si la hay) ---
  const DEFAULT_FB = {
    apiKey: "AIzaSyDW73aFuz2AFS9VeWg_linHIRJYN4YMgTk",
    authDomain: "thepetslovers-c1111.firebaseapp.com",
    projectId: "thepetslovers-c1111",
    storageBucket: "thepetslovers-c1111.appspot.com",
    messagingSenderId: "415914577533",
    appId: "1:415914577533:web:0b7a056ebaa4f1de28ab14",
    measurementId: "G-FXPD69KXBG"
  };
  const FB_CONF = (window.TPL_FIREBASE_CONFIG && typeof window.TPL_FIREBASE_CONFIG === 'object')
    ? window.TPL_FIREBASE_CONFIG
    : DEFAULT_FB;

  // --- Helper: cargar scripts dinámicamente ---
  function loadScript(src) {
    return new Promise((res, rej) => {
      const s = document.createElement('script');
      s.src = src;
      s.async = true;
      s.onload = () => res();
      s.onerror = () => rej(new Error('load ' + src));
      document.head.appendChild(s);
    });
  }
  async function ensureFirebase() {
    if (window.firebase && firebase.auth) return;
    // Cargamos compat v10 (app + auth). Si ya están, no pasa nada.
    await loadScript('https://www.gstatic.com/firebasejs/10.12.5/firebase-app-compat.js');
    await loadScript('https://www.gstatic.com/firebasejs/10.12.5/firebase-auth-compat.js');
    if (firebase.apps.length === 0) firebase.initializeApp(FB_CONF);
  }

  // --- HTML del navbar (idéntico a tu marcado/clases) ---
  const NAV_HTML = `
    <nav class="navbar" role="navigation" aria-label="Principal">
      <div class="logo">
        <a href="index.html" id="tpl-logo-link" aria-label="Inicio">
          <img src="images/logo.png.png" alt="The Pets Lovers">
        </a>
      </div>
      <a href="index.html" class="home-button">Inicio</a>
      <ul class="nav-links">
        <li><a href="como-funciona.html">Cómo funciona</a></li>
        <li><a href="servicios.html">Servicios</a></li>
        <li><a href="index.html#contactanos">Contáctanos</a></li>
        <li><a href="index.html#hazte-cuidador">Conviértete en cuidador</a></li>
      </ul>

      <!-- Estado no autenticado -->
      <a class="login-button"
         id="tpl-login-out"
         data-auth-visible="signed-out"
         href="iniciar-sesion.html?next=perfil.html">Iniciar sesión</a>

      <!-- Estado autenticado -->
      <a class="login-button"
         id="tpl-login-in"
         data-auth-visible="signed-in"
         href="perfil.html"
         style="display:none">Mi perfil</a>
    </nav>
  `;

  // --- Montaje seguro ---
  function mountNavbar() {
    let host = document.getElementById(MOUNT_ID);
    if (!host) {
      host = document.createElement('div');
      host.id = MOUNT_ID;
      // Si no existe el contenedor, lo insertamos al principio del <body>
      document.body.insertBefore(host, document.body.firstChild);
    }
    host.innerHTML = NAV_HTML;
    return host;
  }

  // --- Marca aria-current según la página ---
  function markActiveLinks(host) {
    try {
      const file = (location.pathname.split('/').pop() || 'index.html').toLowerCase();
      (host.querySelectorAll('.navbar a') || []).forEach(a => {
        const href = (a.getAttribute('href') || '').toLowerCase();
        const isIndex = (file === '' || file === '/' || file === 'index.html');
        const match =
          (isIndex && href === 'index.html') ||
          (!isIndex && (href.endsWith(file) || (href.includes('#') && href.split('#')[0].endsWith(file))));
        if (match) a.setAttribute('aria-current', 'page');
      });
    } catch (_) {}
  }

  // --- Navegación a prueba de bloqueos (captura) ---
  function wireHardNavigation(host) {
    const anchors = host.querySelectorAll('.navbar a[href]');
    anchors.forEach(a => {
      a.addEventListener('click', function (e) {
        // respetamos combinaciones (Ctrl/Meta…), botón medio, etc.
        if (e.defaultPrevented || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button !== 0) return;
        const url = a.getAttribute('href');
        if (!url || url.startsWith('javascript:')) return;

        // Si estamos en index y el enlace es a un ancla de index -> scroll suave
        const onIndex = (/\/?$/.test(location.pathname) || /index\.html$/i.test(location.pathname));
        if (onIndex && /^index\.html#/.test(url)) {
          e.preventDefault();
          const id = url.split('#')[1];
          const target = document.getElementById(id);
          if (target) { target.scrollIntoView({ behavior: 'smooth' }); return; }
        }

        // En cualquier otro caso, navegamos sí o sí
        e.preventDefault();
        location.href = a.href;
      }, true); // captura
    });
  }

  // --- Mostrar/ocultar según sesión ---
  function setAuthVisibility(host, signedIn) {
    const show = (sel, vis) => {
      host.querySelectorAll(sel).forEach(el => {
        el.style.display = vis ? '' : 'none';
        el.setAttribute('aria-hidden', vis ? 'false' : 'true');
      });
    };
    show('[data-auth-visible="signed-in"]', !!signedIn);
    show('[data-auth-visible="signed-out"]', !signedIn);
  }

  // --- Quita anti-flicker (con salvaguarda) ---
  function endBoot() {
    try { document.documentElement.classList.remove('tpl-auth-boot'); } catch (_) {}
  }
  // Salvaguarda por si algo tarda demasiado
  setTimeout(endBoot, 2000);

  // --- Init secuencia ---
  function init() {
    const host = mountNavbar();
    markActiveLinks(host);
    wireHardNavigation(host);

    // Si no hay Firebase, mostramos como "no autenticado" sin bloquear nada
    ensureFirebase().then(() => {
      const auth = firebase.auth();
      // init app si no estaba (por seguridad)
      if (firebase.apps.length === 0) firebase.initializeApp(FB_CONF);

      auth.onAuthStateChanged(user => {
        setAuthVisibility(host, !!user);

        // Ajusta los HREF por si acaso
        const btnIn = host.querySelector('#tpl-login-in');
        const btnOut = host.querySelector('#tpl-login-out');
        if (btnIn) btnIn.href = 'perfil.html';
        if (btnOut) btnOut.href = 'iniciar-sesion.html?next=perfil.html';

        endBoot();
      });

      // fallback inmediato por si el callback tarda
      setTimeout(() => { endBoot(); }, 1200);
    }).catch(() => {
      // Sin Firebase: mostramos estado "signed-out"
      const host = document.getElementById(MOUNT_ID);
      if (host) setAuthVisibility(host, false);
      endBoot();
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
