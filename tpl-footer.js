<!-- TPL: INICIO tpl-footer.js -->
<script>
(function () {
  function setYear() {
    document.querySelectorAll('.year-span').forEach(function (s) {
      s.textContent = new Date().getFullYear();
    });
  }

  function injectFooter() {
    var mount = document.getElementById('tpl-footer');
    if (!mount) return;

    fetch('tpl-footer.html', { cache: 'no-store' })
      .then(function (res) { return res.text(); })
      .then(function (html) {
        mount.outerHTML = html;
        setYear();
      })
      .catch(function (err) {
        console.error('TPL: Error al cargar el footer:', err);
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
