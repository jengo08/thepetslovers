/*!
 * tpl-navbar.js — The Pets Lovers
 * Barra unificada con sesión. Ajuste pedido:
 *  - Si user es admin y está en index → botón = "Mi panel" (forzado).
 *  - Resto de páginas se quedan EXACTAMENTE como estaban.
 */
(function(){
  var NAV_CONTAINER_ID = 'tpl-navbar';

  // ==== Admins (mantén/añade correos aquí) ====
  var ADMIN_EMAILS = ['4b.jenny.gomez@gmail.com'];
  function normEmail(x){
    return String(x||'').trim().toLowerCase()
      .normalize('NFD').replace(/[\u0300-\u036f]/g,'');
  }
  var ADMIN_SET = new Set(ADMIN_EMAILS.map(normEmail));
  function isAdmin(user){ return !!(user && user.email && ADMIN_SET.has(normEmail(user.email))); }

  // ==== Detección de "estoy en home" ====
  function isHomePage(){
    var p = (location.pathname || '').toLowerCase();
    return p === '/' || p === '' || p.endsWith('/index') || p.endsWith('/index.html');
  }

  // ==== HTML (diseño intacto) ====
  var NAV_HTML =
    '<nav class="navbar">'+
      '<div class="logo">'+
        '<a href="index.html">'+
          '<img src="images/logo.png.png" alt="The Pets Lovers">'+
        '</a>'+
      '</div>'+
      '<a href="index.html" class="home-button">Inicio</a>'+
      '<ul class="nav-links">'+
        '<li><a href="como-funciona.html">Cómo funciona</a></li>'+
        '<li><a href="servicios.html">Servicios</a></li>'+
        '<li><a href="trabaja-con-nosotros.html">Conviértete en cuidador</a></li>'+
        '<li><a href="ayuda.html">¿Necesitas ayuda?</a></li>'+
      '</ul>'+
      '<a id="tpl-login-btn" class="login-button" href="iniciar-sesion.html?next=perfil.html">Iniciar sesión</a>'+
    '</nav>';

  function mountNav(){
    var host = document.getElementById(NAV_CONTAINER_ID);
    if (!host) return;
    host.innerHTML = NAV_HTML;
  }

  // ==== Botón según sesión ====
  var BTN_ID = 'tpl-login-btn';
  var URL_PANEL   = 'tpl-candidaturas-admin.html';
  var URL_PERFIL  = 'perfil.html';
  var URL_LOGIN   = 'iniciar-sesion.html?next=perfil.html';

  function setBtn(text, href){
    var btn = document.getElementById(BTN_ID);
    if (!btn) return;
    btn.textContent = text;
    btn.setAttribute('href', href);
  }

  function applyUserState(user){
    // Sin sesión
    if (!user) { setBtn('Iniciar sesión', URL_LOGIN); return; }

    // Con sesión: admin / no admin
    if (isAdmin(user)) {
      setBtn('Mi panel', URL_PANEL);
      // —— Ajuste que pediste: en INDEX, forzar Mi panel (por si alguna lógica externa lo toca) ——
      if (isHomePage()) setBtn('Mi panel', URL_PANEL);
    } else {
      setBtn('Mi perfil', URL_PERFIL);
    }
  }

  // ==== Carga Firebase compat si hace falta ====
  function loadScript(src){
    return new Promise(function(res, rej){
      var s = document.createElement('script');
      s.src = src; s.async = true; s.onload = res; s.onerror = rej;
      document.head.appendChild(s);
    });
  }

  var DEFAULT_FB = {
    apiKey: "AIzaSyDW73aFuz2AFS9VeWg_linHIRJYN4YMgTk",
    authDomain: "thepetslovers-c1111.firebaseapp.com",
    projectId: "thepetslovers-c1111",
    storageBucket: "thepetslovers-c1111.appspot.com",
    messagingSenderId: "415914577533",
    appId: "1:415914577533:web:0b7a056ebaa4f1de28ab14",
    measurementId: "G-FXPD69KXBG"
  };

  async function ensureFirebaseAuth(){
    if (window.firebase && firebase.auth) return firebase;
    // Cargar compat v10 si no está
    if (!window.firebase){
      await loadScript('https://www.gstatic.com/firebasejs/10.12.5/firebase-app-compat.js');
    }
    if (!firebase.auth){
      await loadScript('https://www.gstatic.com/firebasejs/10.12.5/firebase-auth-compat.js');
    }
    // Init si hace falta
    if (firebase.apps && firebase.apps.length === 0){
      var cfg = (window.TPL_FIREBASE_CONFIG || DEFAULT_FB);
      firebase.initializeApp(cfg);
    }
    return firebase;
  }

  // ==== Arranque ====
  mountNav();

  (async function boot(){
    try{
      var fb = await ensureFirebaseAuth();
      var auth = fb.auth();
      // Estado inmediato
      applyUserState(auth.currentUser);
      // Cambios de sesión
      auth.onAuthStateChanged(function(u){
        applyUserState(u);
      });
    }catch(e){
      // Si Firebase falla por cualquier motivo, dejamos botón de login por defecto
      setBtn('Iniciar sesión', URL_LOGIN);
    }
  })();

})();
