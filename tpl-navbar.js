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
  <!-- TPL: INICIO BLOQUE NUEVO [Navbar: botón auth dinámico + destinos] -->
<script>
// Este bloque debe vivir dentro de tpl-navbar.js (no en HTML).
(function(){
  // Intentamos detectar Firebase Auth si está presente.
  var hasFirebase = (typeof firebase !== 'undefined' && firebase.apps && firebase.apps.length && firebase.auth);
  var auth = hasFirebase ? firebase.auth() : null;

  function findAuthButton(){
    // 1) Preferimos un botón/enlace con data-auth-link (si decides añadir ese atributo al botón).
    var el = document.querySelector('[data-auth-link]');
    if (el) return el;

    // 2) Si no, buscamos en el navbar algún botón o enlace cuyo texto sea "Inicio de sesión".
    var nav = document.getElementById('tpl-navbar') || document.querySelector('nav') || document.body;
    var candidates = nav.querySelectorAll('a,button');
    var target = null;
    candidates.forEach(function(c){
      var t = (c.textContent || '').trim().toLowerCase();
      if (!target && (t === 'inicio de sesión' || t === 'iniciar sesión' || t === 'inicio sesión')){
        target = c;
      }
    });
    return target;
  }

  function setAuthButtonLoggedOut(btn){
    if (!btn) return;
    btn.textContent = 'Iniciar sesión';
    // Si llega desde cualquier página, al terminar irá a perfil.html
    var next = encodeURIComponent(location.pathname.replace(/^\//,''));
    // Enlace estándar a la página de login
    btn.setAttribute('href', 'inicio-sesion.html?next=perfil.html');
    // Si es <button>, añadimos click
    if (btn.tagName.toLowerCase() === 'button'){
      btn.onclick = function(){ location.href = 'inicio-sesion.html?next=perfil.html'; };
    }
  }

  function setAuthButtonLoggedIn(btn){
    if (!btn) return;
    btn.textContent = 'Mi perfil';
    btn.setAttribute('href', 'perfil.html');
    if (btn.tagName.toLowerCase() === 'button'){
      btn.onclick = function(){ location.href = 'perfil.html'; };
    }
  }

  function applyState(user){
    var btn = findAuthButton(); if (!btn) return;
    if (user){ setAuthButtonLoggedIn(btn); }
    else { setAuthButtonLoggedOut(btn); }
  }

  // Con Firebase: reaccionamos a cambios reales de sesión
  if (auth){
    auth.onAuthStateChanged(applyState);
  } else {
    // Fallback sin Firebase (usando tu flag de reserva.html)
    var logged = localStorage.getItem('tpl-auth') === '1';
    applyState(logged ? {} : null);
    // Observamos cambios en localStorage por si otra pestaña inicia/cierra sesión
    window.addEventListener('storage', function(e){
      if (e.key === 'tpl-auth'){
        var l = e.newValue === '1';
        applyState(l ? {} : null);
      }
    });
  }
})();
</script>
<!-- TPL: FIN BLOQUE NUEVO -->

