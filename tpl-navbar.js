/* TPL: INICIO BLOQUE NUEVO [tpl-navbar.js centralizado] */
(function () {
  // Copia 1:1 de la barra de Index como Fallback (por si falla el fetch)
  var FALLBACK_HTML = '\
<nav class="navbar">\
  <div class="logo">\
    <a href="index.html">\
      <img src="images/logo.png.png" alt="The Pets Lovers Logo">\
    </a>\
  </div>\
  <a href="index.html" class="home-button tpl-home-offset">Inicio</a>\
  <ul class="nav-links">\
    <li><a href="como-funciona.html">Cómo funciona</a></li>\
    <li><a href="servicios.html">Servicios</a></li>\
    <li><a href="trabaja-con-nosotros.html">Conviértete en cuidador</a></li>\
    <li><a href="ayuda.html">¿Necesitas ayuda?</a></li>\
  </ul>\
  <a class="login-button" href="iniciar-sesion.html">Iniciar sesión</a>\
</nav>';

  // 1) Garantizar punto de montaje (si no existe, lo creamos al principio del <body>)
  function getMount() {
    var el = document.getElementById('tpl-navbar');
    if (el) return el;
    var div = document.createElement('div');
    div.id = 'tpl-navbar';
    if (document.body.firstChild) document.body.insertBefore(div, document.body.firstChild);
    else document.body.appendChild(div);
    return div;
  }

  // 2) Inyectar HTML de la barra y luego aplicar lógica de sesión
  function injectHTML(html) {
    var mount = getMount();
    if (!mount) return;
    mount.outerHTML = html;
    requestAnimationFrame(applySessionState);
  }

  // 3) Detección “suave” de sesión (Firebase si existe; si no, banderitas propias)
  function isLoggedIn() {
    try { if (window.firebase?.auth) return !!window.firebase.auth().currentUser; } catch(e){}
    if (window.tplIsLogged === true) return true;
    if (localStorage.getItem('tplAuth') === '1') return true;
    return false;
  }

  // Oculta cualquier botón de “Cerrar sesión” por si existiera en alguna página
  function hideLogoutButtons() {
    var cand = [
      ...document.querySelectorAll('[data-action="logout"], .logout-button, a[href*="logout"], button[href*="logout"]'),
      ...Array.from(document.querySelectorAll('a,button')).filter(function (el) {
        var t = (el.textContent || el.innerText || '').trim().toLowerCase();
        return t === 'cerrar sesión' || t === 'cerrar sesion' || t.includes('logout') || t.includes('sign out');
      })
    ];
    cand.forEach(function (el) { el.style.display = 'none'; el.setAttribute('aria-hidden','true'); });
  }

  // 4) Aplica el estado de sesión a la UI de la barra
  function applySessionState() {
    hideLogoutButtons(); // nunca mostramos “Cerrar sesión” en la barra

    var logged = isLoggedIn();
    var loginBtn = document.querySelector('.login-button');
    if (loginBtn) {
      if (logged) {
        loginBtn.textContent = 'Mi perfil';
        loginBtn.setAttribute('href', 'mi-cuenta.html');
      } else {
        loginBtn.textContent = 'Iniciar sesión';
        loginBtn.setAttribute('href', 'iniciar-sesion.html');
      }
    }

    // Enganche a Firebase para reaccionar a cambios reales de auth
    try {
      if (window.firebase?.auth) {
        window.firebase.auth().onAuthStateChanged(function (user) {
          hideLogoutButtons();
          var btn = document.querySelector('.login-button');
          if (!btn) return;
          if (user) { btn.textContent = 'Mi perfil'; btn.setAttribute('href','mi-cuenta.html'); }
          else      { btn.textContent = 'Iniciar sesión'; btn.setAttribute('href','iniciar-sesion.html'); }
        });
      }
    } catch(e){}
  }

  // 5) Cargar partial maestro (si falla, usamos fallback)
  function injectNavbar() {
    fetch('tpl-navbar.html', { cache: 'no-cache' })
      .then(function (r) { if (!r.ok) throw new Error('HTTP '+r.status); return r.text(); })
      .then(function (html) { injectHTML(html); })
      .catch(function () { injectHTML(FALLBACK_HTML); });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', injectNavbar);
  else injectNavbar();
})();
/* TPL: FIN BLOQUE NUEVO */
