(function () {
  function highlightActiveLink() {
    var path = location.pathname.split('/').pop() || 'index.html';
    document.querySelectorAll('.nav-links a, .home-button').forEach(function (a) {
      var href = a.getAttribute('href'); if (!href) return;
      var file = href.split('#')[0] || '';
      if ((file && file === path) || (!file && path === 'index.html')) {
        a.classList.add('active'); // opcional, si tienes estilos para .active
      }
    });
  }

  function injectNavbar() {
    var mount = document.getElementById('tpl-navbar');
    if (!mount) return;

    // intenta rutas seguras (raíz y relativo)
    var paths = ['tpl-navbar.html', './tpl-navbar.html', '/tpl-navbar.html'];

    paths.reduce(function(chain, path){
      return chain.catch(function(){
        return fetch(path, { cache: 'no-store' }).then(function(res){
          if(!res.ok) throw new Error('HTTP '+res.status+' en '+path);
          return res.text();
        });
      });
    }, Promise.reject())
    .then(function (html) {
      mount.outerHTML = html;
      highlightActiveLink();
    })
    .catch(function (err) {
      console.error('TPL NAVBAR: No se pudo cargar la navbar.', err);
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', injectNavbar);
  } else {
    injectNavbar();
  }
})();
