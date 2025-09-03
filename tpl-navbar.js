/* TPL: INICIO BLOQUE NUEVO [tpl-navbar.js centralizado + sin “Cerrar sesión”] */
(function () {
  // Barra azul idéntica a Index usada como fallback (por si el fetch falla)
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

  function getMount() {
    var el = document.getElementById('tpl-navbar');
    if (el) return el;

    // Si no existe placeholder, lo creamos al principio del body (para no editar cada página)
    var div = document.createElement('div');
    div.id = 'tpl-navbar';
    if (document.body.firstChild) {
      document.body.insertBefore(div, document.body.firstChild);
    } else {
      document.body.appendChild(div);
    }
    return div;
  }

  function injectHTML(html) {
    var mount = getMount();
    if (!mount) return;
    // Reemplaza el placeholder por la barra
    mount.outerHTML = html;

    // Esperamos un tick y aplicamos lógica de sesión/visibilidad
    requestAnimationFrame(applySessionAndVisibility);
  }

  // ===== Lógica de sesión (suave): detecta si hay usuario y adapta el botón
  function isLoggedIn() {
    // 1) Firebase Auth si existe
    try {
      if (window.firebase?.auth) return !!window.firebase.auth().currentUser;
    } catch (e) {}

    // 2) Bandera propia opcional
    if (window.tplIsLogged === true) return true;

    // 3) LocalStorage opcional
    if (localStorage.getItem('tplAuth') === '1') return true;

    return false;
  }

  function hideLogoutButtonsAlways() {
    // Oculta cualquier variante de "Cerrar sesión" (texto o data-action)
    var candidates = [
      ...document.querySelectorAll('[data-action="logout"], .logout-button, a[href*="logout"], button[href*="logout"]'),
      ...Array.from(document.querySelectorAll('a,button')).filter(function (el) {
        var t = (el.textContent || el.innerText || '').trim().toLowerCase();
        return t === 'cerrar sesión' || t === 'cerrar sesion' || t.includes('logout') || t.includes('sign out');
      })
    ];
    candidates.forEach(function (el) {
      el.style.display = 'none';
      el.setAttribute('aria-hidden', 'true');
    });
  }

  function applySessionAndVisibility() {
    hideLogoutButtonsAlways(); // Siempre ocultamos “Cerrar sesión” como pediste

    var logged = isLoggedIn();
    var loginBtn = document.querySelector('.login-button');
    if (loginBtn) {
      if (logged) {
        loginBtn.textContent = 'Mi cuenta';
        loginBtn.setAttribute('href', 'mi-cuenta.html');
      } else {
        loginBtn.textContent = 'Iniciar sesión';
        loginBtn.setAttribute('href', 'iniciar-sesion.html');
      }
    }

    // Si usas Firebase, nos enganchamos para reaccionar cuando cambie el estado real
    try {
      if (window.firebase?.auth) {
        window.firebase.auth().onAuthStateChanged(function (user) {
          hideLogoutButtonsAlways();
          if (loginBtn) {
            if (user) {
              loginBtn.textContent = 'Mi cuenta';
              loginBtn.setAttribute('href', 'mi-cuenta.html');
            } else {
              loginBtn.textContent = 'Iniciar sesión';
              loginBtn.setAttribute('href', 'iniciar-sesion.html');
            }
          }
        });
      }
    } catch (e) {}
  }

  function injectNavbar() {
    // Cargamos el partial maestro
    fetch('tpl-navbar.html', { cache: 'no-cache' })
      .then(function (r) {
        if (!r.ok) throw new Error('HTTP ' + r.status);
        return r.text();
      })
      .then(function (html) {
        injectHTML(html);
      })
      .catch(function () {
        // Si falla, usamos la copia idéntica a Index
        injectHTML(FALLBACK_HTML);
      });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', injectNavbar);
  } else {
    injectNavbar();
  }
})();
/* TPL: FIN BLOQUE NUEVO */
