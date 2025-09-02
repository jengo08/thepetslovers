<!-- TPL: INICIO tpl-navbar.js (FIX: sin etiquetas <script> internas) -->
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
<!-- TPL: FIN tpl-navbar.js -->
