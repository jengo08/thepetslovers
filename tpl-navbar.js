/* TPL: INICIO tpl-navbar.js (con login dinámico) */
(function () {
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

  function injectNavbar() {
    var mount = document.getElementById('tpl-navbar');
    if (!mount) return;

    fetch('tpl-navbar.html', { cache: 'no-store' })
      .then(function (res) { return res.text(); })
      .then(function (html) {
        mount.outerHTML = html;
        highlightActiveLink();
        authifyLinks(); // 🔑 añadimos gestión de login al terminar de inyectar
      })
      .catch(function (err) {
        console.error('TPL: Error al cargar la navbar:', err);
      });
  }

  // === NUEVO: ajustar el botón de login/perfil ===
  function authifyLinks() {
    var hasFirebase = (typeof firebase !== 'undefined' && firebase.apps && firebase.apps.length && firebase.auth);
    var auth = hasFirebase ? firebase.auth() : null;

    function setLoggedOut(el){
      if (!el) return;
      el.textContent = 'Iniciar sesión';
      var next = encodeURIComponent('perfil.html');
      el.setAttribute('href', 'inicio-sesion.html?next=' + next);
      if (el.tagName.toLowerCase() === 'button') {
        el.onclick = function(){ location.href = 'inicio-sesion.html?next=' + next; };
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
      var nodes = Array.from(document.querySelectorAll('a.login-button, button.login-button'))
        .concat(Array.from(document.querySelectorAll('a,button')).filter(function(n){
          var t = (n.textContent||'').trim().toLowerCase();
          return t === 'iniciar sesión' || t === 'inicio de sesión' || t === 'inicio sesión';
        }));
      nodes.forEach(function(n){ user ? setLoggedIn(n) : setLoggedOut(n); });
    }

    // Estado inicial (fallback localStorage si no hay Firebase)
    var logged = localStorage.getItem('tpl-auth') === '1';
    applyState(logged ? {} : null);

    if (auth) {
      auth.onAuthStateChanged(applyState);
    }

    window.addEventListener('storage', function(e){
      if (e.key === 'tpl-auth') applyState(e.newValue === '1' ? {} : null);
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', injectNavbar);
  } else {
    injectNavbar();
  }
})();
/* TPL: FIN tpl-navbar.js */
