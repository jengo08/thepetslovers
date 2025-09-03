/* TPL: INICIO tpl-navbar.js (inyecta navbar + auth global, sin reescrituras) */
(function () {
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
      if (firebase.apps.length) return true;
      if (window.TPL_FIREBASE_CONFIG) {
        firebase.initializeApp(window.TPL_FIREBASE_CONFIG);
        return true;
      }
    } catch(e){ console.warn('TPL Firebase init aviso:', e); }
    return false;
  }

  function highlightActiveLink() {
    var path = location.pathname.split('/').pop() || 'index.html';
    document.querySelectorAll('.nav-links a, .home-button').forEach(function (a) {
      var href = a.getAttribute('href'); if (!href) return;
      var file = href.split('#')[0] || '';
      if ((file && file === path) || (!file && path === 'index.html')) {
        a.classList.add('active');
      }
    });
  }

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

  function ensureAuthScripts() {
    var p = Promise.resolve();
    if (!window.firebase) {
      p = p.then(function(){
        return loadScript('https://www.gstatic.com/firebasejs/8.10.1/firebase-app.js');
      }).then(function(){
        return loadScript('https://www.gstatic.com/firebasejs/8.10.1/firebase-auth.js');
      });
    }
    p = p.then(function(){ initFirebaseIfConfig(); });
    p = p.then(function(){
      if (!document.querySelector('script[src="tpl-auth.js"]')) {
        return loadScript('tpl-auth.js');
      }
    });
    return p.catch(function(e){
      console.warn('TPL auth: no se pudo completar la carga de auth:', e);
    });
  }

  function boot() {
    injectNavbar()
      .then(function(){ return ensureAuthScripts(); });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }
})();
/* TPL: FIN tpl-navbar.js */
