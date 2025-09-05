/* TPL Navbar — estable, idempotente y sin bucles */
(function(){
  // Evita dobles ejecuciones si el script se incluye dos veces
  if (window.__TPL_NAVBAR_RUNNING__) return;
  window.__TPL_NAVBAR_RUNNING__ = true;

  // ========= CONFIG =========
  var ADMIN_EMAILS = ['4b.jenny.gomez@gmail.com'];    // admin(s)
  var PANEL_URL    = 'tpl-candidaturas-admin.html';   // tu panel
  var PROFILE_URL  = 'perfil.html';                   // SIEMPRE este para usuarios

  // ========= HELPERS =========
  function normEmail(s){
    return String(s||'').trim().toLowerCase()
      .normalize('NFD').replace(/[\u0300-\u036f]/g,'');
  }
  var ADMIN_SET = new Set(ADMIN_EMAILS.map(normEmail));
  function isAdminEmail(email){ return ADMIN_SET.has(normEmail(email)); }
  var IS_HOME = /(\/|^)index\.html?$/.test(location.pathname) || location.pathname === '/';

  function htmlNavbar(){
    return [
      '<nav class="navbar">',
        '<div class="logo">',
          '<a href="index.html"><img src="images/logo.png.png" alt="The Pets Lovers"></a>',
        '</div>',
        '<a href="index.html" class="home-button">Inicio</a>',
        '<ul class="nav-links">',
          '<li><a href="como-funciona.html">Cómo funciona</a></li>',
          '<li><a href="servicios.html">Servicios</a></li>',
          '<li><a href="trabaja-con-nosotros.html">Conviértete en cuidador</a></li>',
          '<li><a href="ayuda.html">¿Necesitas ayuda?</a></li>',
        '</ul>',
        '<a id="tpl-login-link" class="login-button" href="iniciar-sesion.html?next=perfil.html">Iniciar sesión</a>',
      '</nav>'
    ].join('');
  }

  function injectNavbarOnce(){
    var host = document.getElementById('tpl-navbar');
    var html = htmlNavbar();
    if (host){
      // Solo escribe si está vacío o distinto (evita parpadeos)
      if (host.innerHTML.trim() !== html) host.innerHTML = html;
    } else {
      var wrap = document.createElement('div');
      wrap.id = 'tpl-navbar';
      wrap.innerHTML = html;
      document.body.insertBefore(wrap, document.body.firstChild);
    }
  }

  function setBtn(text, href){
    var a = document.getElementById('tpl-login-link');
    if (!a) return;
    // Evita cambios innecesarios (corta “peleas” con otros scripts)
    if (a.textContent.trim() !== text) a.textContent = text;
    if (a.getAttribute('href') !== href) a.setAttribute('href', href);
  }

  // Botón por defecto hasta saber si hay sesión
  function setDefaultBtn(){ setBtn('Iniciar sesión','iniciar-sesion.html?next='+encodeURIComponent(PROFILE_URL)); }

  // Actualiza según usuario
  function updateBtn(user){
    if (!user){ setDefaultBtn(); return; }
    var admin = isAdminEmail(user.email);
    if (admin){
      // La diosa pidió: en INDEX siempre “Mi panel” al ser admin
      setBtn('Mi panel', PANEL_URL);
    } else {
      setBtn('Mi perfil', PROFILE_URL);
    }
  }

  // Carga Firebase solo si hace falta y sin duplicar
  function loadOnce(src){
    return new Promise(function(res, rej){
      var already = Array.prototype.some.call(document.scripts, function(s){
        return s.src === src;
      });
      if (already) return res();
      var el = document.createElement('script');
      el.src = src; el.defer = true;
      el.onload = res; el.onerror = rej;
      document.head.appendChild(el);
    });
  }

  async function ensureFirebase(){
    if (typeof firebase !== 'undefined' && firebase.app) return;
    await loadOnce('https://www.gstatic.com/firebasejs/10.12.5/firebase-app-compat.js');
    await loadOnce('https://www.gstatic.com/firebasejs/10.12.5/firebase-auth-compat.js');
  }

  function initFirebase(){
    if (typeof firebase === 'undefined') return null;
    var cfg = window.TPL_FIREBASE_CONFIG || {
      apiKey:"AIzaSyDW73aFuz2AFS9VeWg_linHIRJYN4YMgTk",
      authDomain:"thepetslovers-c1111.firebaseapp.com",
      projectId:"thepetslovers-c1111",
      storageBucket:"thepetslovers-c1111.appspot.com",
      messagingSenderId:"415914577533",
      appId:"1:415914577533:web:0b7a056ebaa4f1de28ab14",
      measurementId:"G-FXPD69KXBG"
    };
    if (firebase.apps.length === 0){
      try{ firebase.initializeApp(cfg); }catch(_){}
    }
    return firebase.auth ? firebase.auth() : null;
  }

  // Arranque seguro (sin observers ni reemplazos continuos)
  function start(){
    injectNavbarOnce();
    setDefaultBtn();

    (async function(){
      try{
        await ensureFirebase();
        var auth = initFirebase();
        if (!auth) return;

        // 1) Actualiza ya con el usuario actual
        updateBtn(auth.currentUser);

        // 2) Y en cuanto cambie el estado
        auth.onAuthStateChanged(function(u){
          updateBtn(u);
          // Refuerzo: si eres admin y estás en index, re-afirma “Mi panel” tras 300ms (evita carreras)
          if (IS_HOME && u && isAdminEmail(u.email)){
            setTimeout(function(){ setBtn('Mi panel', PANEL_URL); }, 300);
          }
        });
      }catch(_){
        // Si Firebase falla, el navbar sigue visible con el botón por defecto
      }
    })();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', start);
  } else {
    start();
  }
})();
