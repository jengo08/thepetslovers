/* TPL NAVBAR – inyector unificado (sin tocar diseño) */
(function () {
  // Oculta estados firmados/no firmados mientras se resuelve la sesión (evita parpadeo)
  try { document.documentElement.classList.add('tpl-auth-boot'); } catch (e) {}

  // --- CONFIG BÁSICA ---
  var PROFILE_URL = 'perfil.html';
  var PANEL_URL   = 'tpl-candidaturas-admin.html';

  // Admins (normalizados)
  var ADMIN_EMAILS = ['4b.jenny.gomez@gmail.com'];
  function norm(s){ return String(s||'').trim().toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g,''); }
  var ADMIN_SET = {};
  ADMIN_EMAILS.forEach(function(e){ ADMIN_SET[norm(e)] = true; });
  function isAdmin(user){ return !!(user && user.email && ADMIN_SET[norm(user.email)]); }

  // Firebase cfg: usa la global si existe; si no, esta
  var FALLBACK_FIREBASE_CONFIG = {
    apiKey: "AIzaSyDW73aFuz2AFS9VeWg_linHIRJYN4YMgTk",
    authDomain: "thepetslovers-c1111.firebaseapp.com",
    projectId: "thepetslovers-c1111",
    storageBucket: "thepetslovers-c1111.appspot.com",
    messagingSenderId: "415914577533",
    appId: "1:415914577533:web:0b7a056ebaa4f1de28ab14",
    measurementId: "G-FXPD69KXBG"
  };
  function cfg(){ return (window.TPL_FIREBASE_CONFIG || FALLBACK_FIREBASE_CONFIG); }

  // --- UTILIDADES ---
  function loadScript(src){
    return new Promise(function(res, rej){
      var s = document.createElement('script');
      s.src = src; s.async = true; s.defer = true;
      s.onload = res; s.onerror = rej;
      document.head.appendChild(s);
    });
  }
  async function ensureFirebase(){
    if (window.firebase && firebase.apps) return;
    await loadScript('https://www.gstatic.com/firebasejs/10.12.5/firebase-app-compat.js');
    await loadScript('https://www.gstatic.com/firebasejs/10.12.5/firebase-auth-compat.js');
  }
  function initFirebase(){
    try{
      if (!window.firebase) return null;
      if (!firebase.apps.length) firebase.initializeApp(cfg());
      return firebase.auth();
    }catch(e){ return null; }
  }

  // --- RENDER NAVBAR ---
  function hostEl(){
    var host = document.getElementById('tpl-navbar');
    if (!host){
      host = document.createElement('div');
      host.id = 'tpl-navbar';
      document.body.insertBefore(host, document.body.firstChild);
    }
    return host;
  }

  function renderShell(){
    var html = ''
    + '<nav class="navbar">'
    + '  <div class="logo">'
    + '    <a href="index.html"><img src="images/logo.png.png" alt="The Pets Lovers"></a>'
    + '  </div>'
    + '  <a href="index.html" class="home-button tpl-home-offset">Inicio</a>'
    + '  <ul class="nav-links">'
    + '    <li><a href="como-funciona.html">Cómo funciona</a></li>'
    + '    <li><a href="servicios.html">Servicios</a></li>'
    + '    <li><a href="trabaja-con-nosotros.html">Conviértete en cuidador</a></li>'
    + '    <li><a href="ayuda.html">¿Necesitas ayuda?</a></li>'
    + '  </ul>'
    + '  <!-- Estado no logueado -->'
    + '  <a class="login-button" data-auth-visible="signed-out"'
    + '     href="iniciar-sesion.html?next=perfil.html">Iniciar sesión</a>'
    + '  <!-- Estado logueado -->'
    + '  <a class="login-button" id="tpl-account-link" data-auth-visible="signed-in"'
    + '     href="perfil.html" style="display:none">Mi perfil</a>'
    + '</nav>';
    hostEl().innerHTML = html;
  }

  function toggleAuthVisibility(logged){
    var signedIn  = document.querySelectorAll('[data-auth-visible="signed-in"]');
    var signedOut = document.querySelectorAll('[data-auth-visible="signed-out"]');
    for (var i=0;i<signedIn.length;i++) { signedIn[i].style.display  = logged ? '' : 'none'; }
    for (var j=0;j<signedOut.length;j++){ signedOut[j].style.display = logged ? 'none' : ''; }
  }

  function updateAccountLink(user){
    var link = document.getElementById('tpl-account-link');
    if (!link) return;
    if (user){
      if (isAdmin(user)){
        // SIEMPRE "Mi panel" para admin (también en index)
        link.textContent = 'Mi panel';
        link.setAttribute('href', PANEL_URL);
      } else {
        link.textContent = 'Mi perfil';
        link.setAttribute('href', PROFILE_URL); // siempre perfil.html
      }
    }
  }

  function ready(){ try{ document.documentElement.classList.remove('tpl-auth-boot'); }catch(e){} }

  // --- BOOT ---
  (async function boot(){
    renderShell(); // pinta ya (no bloquea)
    try{
      await ensureFirebase();
      var auth = initFirebase();

      // Primer dibujo con estado actual (por si ya hay sesión cacheada)
      var u = auth && auth.currentUser || null;
      toggleAuthVisibility(!!u);
      updateAccountLink(u);
      ready();

      // Y escucha cambios (esto arregla el caso de index que te mostraba "Mi perfil" hasta que llegue el user)
      if (auth && auth.onAuthStateChanged){
        auth.onAuthStateChanged(function(user){
          toggleAuthVisibility(!!user);
          updateAccountLink(user);
        });
      }
    } catch(e){
      // Si algo falla con Firebase, que el sitio siga funcionando (modo desconectado)
      toggleAuthVisibility(false);
      ready();
    }
  })();

})();
