/* TPL: INICIO BLOQUE NUEVO [tpl-navbar.js corregido y robusto] */
(function () {
  // HTML de fallback idéntico al de Index (por si el fetch falla)
  var FALLBACK_HTML = `
  <nav class="navbar">
    <div class="logo">
      <a href="index.html">
        <img src="images/logo.png.png" alt="The Pets Lovers Logo">
      </a>
    </div>
    <a href="index.html" class="home-button tpl-home-offset">Inicio</a>
    <ul class="nav-links">
      <li><a href="como-funciona.html">Cómo funciona</a></li>
      <li><a href="servicios.html">Servicios</a></li>
      <li><a href="index.html#contactanos">Contáctanos</a></li>
      <li><a href="trabaja-con-nosotros.html">Conviértete en cuidador</a></li>
    </ul>
    <a class="login-button" href="iniciar-sesion.html">Iniciar sesión</a>
  </nav>
  `;

  function inject(html) {
    var mount = document.getElementById("tpl-navbar");
    if (!mount) return;
    mount.outerHTML = html;
  }

  function tryInjectFallback() {
    inject(FALLBACK_HTML);
  }

  function injectNavbar() {
    var mount = document.getElementById("tpl-navbar");
    if (!mount) return;

    // Carga del partial maestro (como antes)
    fetch("tpl-navbar.html", { cache: "no-cache" })
      .then(function (r) {
        if (!r.ok) throw new Error("HTTP " + r.status);
        return r.text();
      })
      .then(function (html) {
        inject(html);
      })
      .catch(function () {
        // Si falla (404, ruta mal, etc.), ponemos la barra EXACTA de Index
        tryInjectFallback();
      });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", injectNavbar);
  } else {
    injectNavbar();
  }
})();
/* TPL: FIN BLOQUE NUEVO */
