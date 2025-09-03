/* TPL: Navbar unificada + login state (sin botón de cerrar sesión)
   - Mostrar "Iniciar sesión" si no hay sesión
   - Mostrar "Mi perfil" si hay sesión -> resuelve ruta existente (mi-perfil.html / mi-cuenta.html / perfil.html)
   - Sin "Cerrar sesión" en la barra
   - Misma estructura que Index
*/

(function () {
  // --- CONFIG BÁSICA
  var BRAND = {
    logo: 'images/logo.png.png',
    links: [
      { href: 'como-funciona.html', label: 'Cómo funciona' },
      { href: 'servicios.html', label: 'Servicios' },
      { href: 'index.html#contactanos', label: 'Contáctanos' },
      { href: 'index.html#hazte-cuidador', label: 'Conviértete en cuidador' }
    ]
  };

  // --- RENDER NAV
  function renderNavbar(container) {
    var navHTML = [
      '<nav class="navbar">',
        '<div class="logo"><a href="index.html"><img src="' + BRAND.logo + '" alt="The Pets Lovers"></a></div>',
        '<a href="index.html" class="home-button">Inicio</a>',
        '<ul class="nav-links">',
          BRAND.links.map(function(l){ return '<li><a href="'+l.href+'">'+l.label+'</a></li>'; }).join(''),
        '</ul>',
        '<a class="login-button" href="iniciar-sesion.html">Iniciar sesión</a>',
      '</nav>'
    ].join('');

    if (container) {
      container.innerHTML = navHTML;
    } else {
      // Si no hay #tpl-navbar, intenta reemplazar una .navbar existente
      var existing = document.querySelector('.navbar');
      if (existing && existing.parentNode) {
        var wrapper = document.createElement('div');
        wrapper.innerHTML = navHTML;
        existing.parentNode.replaceChild(wrapper.firstChild, existing);
      } else {
        // Como último recurso, inyecta al comienzo del body
        var fallback = document.createElement('div');
        fallback.innerHTML = navHTML;
        document.body.insertBefore(fallback.firstChild, document.body.firstChild);
      }
    }

    // Marcar aria-current en el enlace activo
    try {
      var here = location.pathname.replace(/\/+$/, '').split('/').pop() || 'index.html';
      var anchors = document.querySelectorAll('.navbar a[href]');
      anchors.forEach(function(a){
        var href = a.getAttribute('href');
        // Coincidimos por archivo o por hash en index
        var file = (href || '').split('#')[0] || '';
        if (!file || file === '#') return;
        var fileOnly = file.split('/').pop();
        if (fileOnly === here) a.setAttribute('aria-current','page');
      });
    } catch(e){}
  }

  // --- RESOLVER URL DE PERFIL
  var PROFILE_URL_LS_KEY = 'tpl_profile_url_cache';
  async function resolveProfileUrl() {
    // usa caché si existe
    try {
      var cached = localStorage.getItem(PROFILE_URL_LS_KEY);
      if (cached) return cached;
    } catch(e){}

    var candidates = ['mi-perfil.html', 'mi-cuenta.html', 'perfil.html'];
    for (var i=0;i<candidates.length;i++){
      var p = candidates[i];
      try {
        // HEAD puede estar limitado en algunos hosts -> fallback a GET liviano
        var res = await fetch(p, { method: 'HEAD', cache: 'no-store' });
        if (!res.ok) {
          // Fallback GET
          res = await fetch(p, { method: 'GET', cache: 'no-store' });
        }
        if (res && res.ok) {
          try { localStorage.setItem(PROFILE_URL_LS_KEY, p); } catch(e){}
          return p;
        }
      } catch(e){}
    }
    // por defecto
    return 'mi-perfil.html';
  }

  // --- ACTUALIZAR BOTÓN DERECHO SEGÚN SESIÓN
  async function setLoggedUI(isLogged) {
    var btn = document.querySelector('.navbar .login-button');
    if (!btn) return;

    if (!isLogged) {
      btn.textContent = 'Iniciar sesión';
      btn.setAttribute('href', 'iniciar-sesion.html');
      btn.removeAttribute('rel');
      return;
    }
    // Logueada -> Mi perfil
    btn.textContent = 'Mi perfil';
    btn.setAttribute('href', await resolveProfileUrl());
    btn.setAttribute('rel', 'nofollow');
  }

  // --- INICIALIZAR
  renderNavbar(document.getElementById('tpl-navbar'));

  // ==========================
  //  DETECCIÓN DE SESIÓN
  // ==========================
  // 1) Señal con Firebase (si está disponible o la cargamos)
  // 2) Heurística ligera si aún no podemos leer Firebase (revisa authUser en localStorage)
  var firebaseReady = false;

  function heuristicIsLogged() {
    // Busca claves de auth de Firebase en localStorage (persisten entre páginas)
    try {
      for (var i=0;i<localStorage.length;i++){
        var k = localStorage.key(i);
        if (k && k.indexOf('firebase:authUser:') === 0) {
          var v = localStorage.getItem(k);
          if (v && v.indexOf('"uid":') !== -1) return true;
        }
      }
    } catch(e){}
    return false;
  }

  // Aplica heurística inicial (por si Firebase tarda)
  setLoggedUI(heuristicIsLogged());

  // Intentamos cargar Firebase si no está
  var firebaseConfig = {
    apiKey: "AIzaSyDW73aFuz2AFS9VeWg_linHIRJYN4YMgTk",
    authDomain: "thepetslovers-c1111.firebaseapp.com",
    projectId: "thepetslovers-c1111",
    storageBucket: "thepetslovers-c1111.appspot.com",
    messagingSenderId: "415914577533",
    appId: "1:415914577533:web:0b7a056ebaa4f1de28ab14",
    measurementId: "G-FXPD69KXBG"
  };

  function loadScriptOnce(src) {
    return new Promise(function (resolve, reject) {
      if ([].some.call(document.scripts, s => s.src === src)) return resolve();
      var s = document.createElement('script');
      s.src = src; s.defer = true; s.onload = resolve; s.onerror = reject;
      document.head.appendChild(s);
    });
  }

  async function ensureFirebase() {
    if (window.firebase && firebase.apps && firebase.apps.length) return;
    // Cargamos compat si hace falta
    if (typeof window.firebase === 'undefined') {
      await loadScriptOnce('https://www.gstatic.com/firebasejs/10.12.5/firebase-app-compat.js');
      await loadScriptOnce('https://www.gstatic.com/firebasejs/10.12.5/firebase-auth-compat.js');
    }
    if (firebase.apps.length === 0) {
      firebase.initializeApp(firebaseConfig);
    }
  }

  (async function initAuthListener(){
    try {
      await ensureFirebase();
      firebaseReady = true;
      var auth = firebase.auth();
      // Aseguramos persistencia local (una sola vez)
      try { await auth.setPersistence(firebase.auth.Auth.Persistence.LOCAL); } catch(e){}

      auth.onAuthStateChanged(function(user){
        setLoggedUI(!!user);
      });
    } catch(e) {
      // Si Firebase no carga, nos quedamos con la heurística
      setLoggedUI(heuristicIsLogged());
    }
  })();
})();
