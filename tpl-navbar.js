/* TPL Navbar — versión final y estable para todas las páginas */
(function(){
  // ========= CONFIG =========
  // Email(s) de admin para mostrar “Mi panel”
  var ADMIN_EMAILS = ['4b.jenny.gomez@gmail.com']; // añade aquí tu email si es otro
  var PANEL_URL   = 'tpl-candidaturas-admin.html';
  var PROFILE_URL = 'perfil.html'; // SIEMPRE este

  // ========= HELPERS =========
  function normEmail(s){ return String(s||'').trim().toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,''); }
  var ADMIN_SET = new Set(ADMIN_EMAILS.map(normEmail));
  function isAdminEmail(email){ return ADMIN_SET.has(normEmail(email)); }

  function buildHTML(){
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

  function injectNavbar(){
    var host = document.getElementById('tpl-navbar');
    var html = buildHTML();
    if (host) { host.innerHTML = html; }
    else {
      var wrap = document.createElement('div');
      wrap.id = 'tpl-navbar';
      wrap.innerHTML = html;
      document.body.insertBefore(wrap, document.body.firstChild);
    }
  }

  function setBtn(text, href){
    var a = document.getElementById('tpl-login-link');
    if (!a) return;
    a.textContent = text;
    a.setAttribute('href', href);
  }

  function updateBtn(user){
    if (!user){
      setBtn('Iniciar sesión','iniciar-sesion.html?next='+encodeURIComponent(PROFILE_URL));
      return;
    }
    if (isAdminEmail(user.email)) setBtn('Mi panel', PANEL_URL);
    else setBtn('Mi perfil', PROFILE_URL);
  }

  // ========= FIREBASE (opcional) =========
  function loadOnce(src){
    return new Promise(function(res, rej){
      if ([...document.scripts].some(s => s.src === src)) return res();
      var s = document.createElement('script');
      s.src = src; s.defer = true; s.onload = res; s.onerror = rej;
      document.head.appendChild(s);
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
    if (firebase.apps.length === 0){ try{ firebase.initializeApp(cfg); }catch(_){ /* ignore */ } }
    return firebase.auth ? firebase.auth() : null;
  }

  // ========= START =========
  function start(){
    // 1) Pinta SIEMPRE la barra (evita “barra borrada”)
    injectNavbar();
    // 2) Estado por defecto hasta saber si hay sesión
    setBtn('Iniciar sesión','iniciar-sesion.html?next='+encodeURIComponent(PROFILE_URL));

    // 3) Si hay Firebase, actualiza el botón al vuelo (usuario/admin)
    (async function(){
      try{
        await ensureFirebase();
        var auth = initFirebase();
        if (!auth) return;
        updateBtn(auth.currentUser);
        auth.onAuthStateChanged(updateBtn);
      }catch(_){
        // Si falla Firebase, la barra sigue visible con el botón por defecto
      }
    })();
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start);
  else start();
})();
