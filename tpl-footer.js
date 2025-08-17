<!-- TPL: INICIO tpl-footer.js -->
<script>
(function () {
  function setYear() {
    document.querySelectorAll('.year-span').forEach(function (s) {
      s.textContent = new Date().getFullYear();
    });
  }

  function tryFetch(paths) {
    // Intenta varias rutas hasta que una funcione
    return paths.reduce(function (chain, path) {
      return chain.catch(function () {
        return fetch(path, { cache: 'no-store' }).then(function (r) {
          if (!r.ok) throw new Error('HTTP '+r.status+' en '+path);
          return r.text();
        });
      });
    }, Promise.reject());
  }

  function injectFooter() {
    var mount = document.getElementById('tpl-footer');
    if (!mount) return;

    // Rutas robustas:
    //  - 'tpl-footer.html' -> para páginas en raíz
    //  - './tpl-footer.html' -> relativo seguro
    //  - '/tpl-footer.html' -> dominio raíz (útil si usas dominio propio como www.thepetslovers.es)
    var paths = ['tpl-footer.html', './tpl-footer.html', '/tpl-footer.html'];

    tryFetch(paths)
      .then(function (html) {
        mount.outerHTML = html;
        setYear();
      })
      .catch(function (err) {
        console.error('TPL FOOTER: No se pudo cargar el footer.', err);
      });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', injectFooter);
  } else {
    injectFooter();
  }
})();
</script>
<!-- TPL: FIN tpl-footer.js -->
