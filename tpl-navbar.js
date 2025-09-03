/* TPL: INICIO BLOQUE NUEVO [tpl-navbar.js centralizado + “Mi cuenta” → perfil] */
(function () {
  // 👉 Cambia esto si tu perfil tiene otra ruta (p. ej. 'perfil.html')
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

  // Garantizar punto de montaje
  function getMount() {
    var el = document.getElementById('tpl-navbar');
    if (el) return el;
    var div = document.createElement('div');
    div.id = 'tpl-navbar';
    if (document.body.firstChild) document.body.insertBefore(div, document.body.firstChild);
    else document.body.appendChild(div);
    return div;
  }

  // Inyectar HTML y luego aplicar estado de sesión
  function injectHTML(html) {
    var mount = getMount();
    if (!mount) return;
    mount.outerHTML = html;
    requestAnimationFrame(applySessionState);
  }

  // Detección “suave” de sesión
  function isLoggedIn() {
    try { if (window.firebase?.auth) return !!window.firebase.auth().currentUser; } catch(e){}
    if (window.tplIsLogged === true) return true;
    if (localStorage.getItem('tplAuth') === '1') return true;
    return false;
  }

  // Ocultar cualquier “Cerrar sesión”
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

  // Aplicar estado a la UI del botón derecho
  function setLoginButton(logged) {
    var btn = document.querySelector('.login-button');
    if (!btn) return;

    if (logged) {
      btn.textContent = 'Mi perfil';
      btn.setAttribute('href', PROFILE_URL);
      btn.setAttribute('aria-label', 'Ir a mi perfil');
      // Refuerzo por si algún script externo cambiara el href después:
      btn.addEventListener('click', function (e) {
        // Si por lo que sea el href no coincide, garantizamos la redirección correcta
        if (btn.getAttribute('href') !== PROFILE_URL) {
          e.preventDefault();
          window.location.href = PROFILE_URL;
        }
      }, { once: true });
    } else {
      btn.textContent = 'Iniciar sesión';
      btn.setAttribute('href', 'iniciar-sesion.html');
      btn.setAttribute('aria-label', 'Iniciar sesión');
    }
  }

  function applySessionState() {
    hideLogoutButtons(); // nunca mostramos “Cerrar sesión” en la barra
    setLoginButton(isLoggedIn());

    // Reaccionar a cambios reales de auth (Firebase)
    try {
      if (window.firebase?.auth) {
        window.firebase.auth().onAuthStateChanged(function (user) {
          hideLogoutButtons();
          setLoginButton(!!user);
        });
      }
    } catch(e){}
  }

  // Cargar partial maestro (si falla, usar fallback)
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
