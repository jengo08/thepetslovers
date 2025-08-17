<!-- TPL: INICIO tpl-navbar.js -->
<script>
(function () {
  function highlightActiveLink() {
    var path = location.pathname.split('/').pop() || 'index.html';
    document.querySelectorAll('.nav-links a, .home-button').forEach(function (a) {
      var href = a.getAttribute('href'); if (!href) return;
      var file = href.split('#')[0] || '';
      if ((file && file === path) || (!file && path === 'index.html')) {
        a.classList.add('active'); // solo tendrá efecto si ya tienes estilos para .active
      }
    });
  }

  function injectNavbar() {
    var mount = document.getElementById('tpl-navbar');
    if (!mount) return; // si una página no lo tiene, no pasa nada

    fetch('tpl-navbar.html', { cache: 'no-store' })
      .then(function (res) { return res.text(); })
      .then(function (html) {
        // Sustituimos el contenedor por la navbar
        mount.outerHTML = html;
        // Resaltar enlace activo tras inyectar
        highlightActiveLink();
      })
      .catch(function (err) {
        console.error('TPL: Error al cargar la navbar:', err);
      });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', injectNavbar);
  } else {
    injectNavbar();
  }
})();
</script>
<!-- TPL: FIN tpl-navbar.js -->
