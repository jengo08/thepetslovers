(function () {
  function setYear() {
    document.querySelectorAll('.year-span').forEach(function (s) {
      s.textContent = new Date().getFullYear();
    });
  }

  function injectFooter() {
    var mount = document.getElementById('tpl-footer');
    if (!mount) return;

    var paths = ['tpl-footer.html', './tpl-footer.html', '/tpl-footer.html'];

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
