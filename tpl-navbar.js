/* TPL: INICIO tpl-navbar.js (inyecta navbar + login dinámico + auth global) */
(function () {
  // ---------- UTILIDADES ----------
  function once(id) { return !!document.querySelector(id); }

  function loadScript(src, attrs) {
    return new Promise(function (resolve, reject) {
      if (document.querySelector('script[src="' + src + '"]')) return resolve('already');
      var s = document.createElement('script');
      s.src = src;
      if (attrs) Object.keys(attrs).forEach(function(k){ s.setAttribute(k, attrs[k]); });
      s.onload = function(){ resolve(src); };
      s.onerror = function(){ reject(new Error('No se pudo cargar: ' + src)); };
      document.head.appendChild(s);
    });
  }

  function initFirebaseIfConfig() {
    try {
      if (!window.firebase || !firebase.apps) return false;
      // Espera una config global en window.TPL_FIREBASE_CONFIG (opcional, centralizada)
      if (firebase.apps.length) return true;
      if (window.TPL_FIREBASE_CONFIG) {
        firebase.initializeApp(window.TPL_FIREBASE_CONFIG);
        return true;
      }
    } catch(e){ console.warn('TPL Firebase init aviso:', e); }
    return false;
  }

  // ---------- RESALTAR ENLACE ACTIVO ----------
  function highlightActiveLink() {
    var path = location.pathname.split('/').pop() || 'index.html';
    document.querySelectorAll('.nav-links a, .home-button').forEach(function (a) {
      var href = a.getAttribute('href'); if (!href) return;
      var file = href.split('#')[0] || '';
      if ((file && file === path) || (!file && path === 'index.html')) {
        a.classList.add('active'); // se verá si tienes CSS para .active
      }
    });
  }

  // ---------- NAVBAR ----------
  function injectNavbar() {
    var mount = document.getElementById('tpl-navbar');
    if (!mount) return Promise.resolve('no-mount');

    return fetch('tpl-navbar.html', { cache: 'no-store' })
      .then(function (res) { return res.text(); })
      .then(function (html) {
        mount.outerHTML = html;
        highlightActiveLink();
      })
      .catch(function (err) {
        console.error('TPL: Error al cargar la navbar:', err);
      });
  }

  // ---------- AJUSTE BOTONES LOGIN / PERFIL ----------
  function authifyLinks() {
    var hasFirebase = (typeof firebase !== 'undefined' && firebase.apps && firebase.apps.length && firebase.auth);
    var auth = hasFirebase ? firebase.auth() : null;

    function setLoggedOut(el){
      if (!el) return;
      el.textContent = 'Iniciar sesión';
      var next = encodeURIComponent('perfil.html');
      el.setAttribute('href', 'iniciar-sesion.html?next=' + next);
      if (el.tagName.toLowerCase() === 'button') {
        el.onclick = function(){ location.href = 'iniciar-sesion.html?next=' + next; };
      }
    }

    function setLoggedIn(el){
      if (!el) return;
      el.textContent = 'Mi perfil';
      el.setAttribute('href', 'perfil.html');
      if (el.tagName.toLowerCase() === 'button') {
        el.onclick = function(){ location.href = 'perfil.html'; };
      }
    }

    function applyState(user){
      // Botón principal (clase .login-button) + cualquier botón con ese texto
      var nodes = Array.from(document.querySelectorAll('a.login-button, button.login-button'))
        .concat(Array.from(document.querySelectorAll('a,button')).filter(function(n){
          var t = (n.textContent||'').trim().toLowerCase();
          return t === 'iniciar sesión' || t === 'inicio de sesión' || t === 'inicio sesión';
        }));
      nodes.forEach(function(n){ user ? setLoggedIn(n) : setLoggedOut(n); });
    }

    // Estado inicial (si no hay Firebase aún, mira localStorage como fallback)
    var logged = localStorage.getItem('tpl-auth') === '1';
    applyState(logged ? {} : null);

    if (auth) {
      auth.onAuthStateChanged(function(user){
        // Guarda un flag simple para otras pestañas
        localStorage.setItem('tpl-auth', user ? '1' : '0');
        applyState(user);
      });
    }

    // Sincroniza cambios entre pestañas
    window.addEventListener('storage', function(e){
      if (e.key === 'tpl-auth') applyState(e.newValue === '1' ? {} : null);
    });
  }

  // ---------- INYECCIÓN DE AUTH GLOBAL ----------
  function ensureAuthScripts() {
    // 1) Cargar SDKs de Firebase si no están
    var p = Promise.resolve();
    if (!window.firebase) {
      p = p.then(function(){
        return loadScript('https://www.gstatic.com/firebasejs/8.10.1/firebase-app.js');
      }).then(function(){
        return loadScript('https://www.gstatic.com/firebasejs/8.10.1/firebase-auth.js');
      });
    }

    // 2) Inicializar Firebase si tenemos config global
    p = p.then(function(){
      initFirebaseIfConfig();
    });

    // 3) Cargar tpl-auth.js (control unificado de visibilidad por data-attributes)
    p = p.then(function(){
      if (!document.querySelector('script[src="tpl-auth.js"]')) {
        return loadScript('tpl-auth.js');
      }
    });

    return p.catch(function(e){
      console.warn('TPL auth: no se pudo completar la carga de auth:', e);
    });
  }

  // ---------- ARRANQUE ----------
  function boot() {
    // Inyecta navbar → asegura auth scripts → ajusta botones
    injectNavbar()
      .then(function(){
        return ensureAuthScripts();
      })
      .then(function(){
        authifyLinks();
      });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }
})();
/* TPL: FIN tpl-navbar.js */
