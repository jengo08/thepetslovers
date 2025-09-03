/* TPL: INICIO BLOQUE NUEVO [tpl-navbar.js con persistencia global de sesión] */
(function () {
  // 👉 Cambia esta ruta si tu perfil tuviera otro nombre
  var PROFILE_URL = 'mi-cuenta.html';

  // Fallback 1:1 de la barra (por si falla el fetch de tpl-navbar.html)
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

  // ---- helpers de montaje/inyección
  function getMount() {
    var el = document.getElementById('tpl-navbar');
    if (el) return el;
    var div = document.createElement('div');
    div.id = 'tpl-navbar';
    if (document.body.firstChild) document.body.insertBefore(div, document.body.firstChild);
    else document.body.appendChild(div);
    return div;
  }
  function injectHTML(html) {
    var mount = getMount();
    if (!mount) return;
    mount.outerHTML = html;
    requestAnimationFrame(applySessionState);
  }

  // ---- estado de sesión unificado
  // Regla: si hay Firebase, nos “anclamos” a onAuthStateChanged y
  // sincronizamos un flag localStorage para que el resto de páginas lo lean.
  var AUTH_FLAG = 'tplAuth'; // '1' si hay sesión
  function isLoggedFlag() {
    return localStorage.getItem(AUTH_FLAG) === '1';
  }
  function setLoggedFlag(v) {
    if (v) localStorage.setItem(AUTH_FLAG, '1');
    else   localStorage.removeItem(AUTH_FLAG);
  }

  // Detección suave
  function isLoggedInSoft() {
    try { if (window.firebase?.auth) return !!window.firebase.auth().currentUser; } catch(e){}
    return isLoggedFlag();
  }

  // Oculta cualquier “Cerrar sesión” (por si existiera en alguna página)
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

  // Aplica el estado al botón derecho del navbar
  function setLoginButton(logged) {
    var btn = document.querySelector('.login-button');
    if (!btn) return;
    if (logged) {
      btn.textContent = 'Mi perfil';
      btn.setAttribute('href', PROFILE_URL);
      btn.setAttribute('aria-label', 'Ir a mi perfil');
    } else {
      btn.textContent = 'Iniciar sesión';
      btn.setAttribute('href', 'iniciar-sesion.html');
      btn.setAttribute('aria-label', 'Iniciar sesión');
    }
  }

  function applySessionState() {
    hideLogoutButtons();               // Nunca mostrar “Cerrar sesión” en barra
    setLoginButton(isLoggedInSoft());  // Pinta según flag o Firebase actual

    // Si hay Firebase, sincroniza flag y UI en tiempo real
    try {
      if (window.firebase?.auth) {
        window.firebase.auth().onAuthStateChanged(function (user) {
          var logged = !!user;
          setLoggedFlag(logged);     // <- clave: persistencia global entre páginas
          hideLogoutButtons();
          setLoginButton(logged);
        });
      }
    } catch(e){}

    // Si se cambia el flag desde otra pestaña/página, refrescamos el botón
    window.addEventListener('storage', function (ev) {
      if (ev.key === AUTH_FLAG) {
        setLoginButton(isLoggedFlag());
      }
    });
  }

  // Carga el partial maestro (si falla, usa fallback idéntico a Index)
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
