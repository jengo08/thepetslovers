<!-- TPL: INICIO BLOQUE NUEVO [tpl-auth.js] -->
<script>
// ===== The Pets Lovers · Control unificado de sesión =====
// Requisitos: tu inicialización de Firebase ya cargada ANTES de este script.
// Este script NO cambia tu diseño; solo alterna visibilidad por data-attributes.

(function(){
  // 1) Utilidad: ocultar/mostrar por estado
  function applyAuthVisibility(user){
    var signedIn = !!user;
    var nodes = document.querySelectorAll('[data-auth-visible]');
    nodes.forEach(function(el){
      var want = el.getAttribute('data-auth-visible'); // 'signed-in' | 'signed-out'
      var show = (want === 'signed-in') ? signedIn : !signedIn;
      el.style.display = show ? '' : 'none';
    });

    // Levantar bloqueo de boot una vez que sabemos el estado real
    document.documentElement.classList.remove('tpl-auth-boot');

    // Si hay contenedores que deben “activar” comportamientos cuando hay usuario:
    if (signedIn) {
      // Puedes leer UID/email si lo necesitas
      // console.log('UID', user.uid, 'Email', user.email);
    }
  }

  // 2) Cerrar sesión (enlace/btn con id="tpl-logout")
  function wireLogout(){
    var btn = document.getElementById('tpl-logout');
    if (!btn) return;
    btn.addEventListener('click', function(e){
      e.preventDefault();
      if (!window.firebase || !firebase.auth) return;
      firebase.auth().signOut()
      .then(function(){
        // Evitar estados cacheados de la página
        if ('caches' in window) { caches.keys().then(keys => keys.forEach(k => caches.delete(k))); }
        // Forzar refresco duro del DOM actual
        location.reload();
      })
      .catch(function(err){ console.error('Logout error:', err); });
    });
  }

  // 3) Login con Google (botón con id="tpl-google-login" o clase)
  function wireGoogleLogin(){
    var btns = document.querySelectorAll('#tpl-google-login, .tpl-google-login');
    if (!btns.length) return;
    btns.forEach(function(btn){
      btn.addEventListener('click', function(e){
        e.preventDefault();
        if (!window.firebase || !firebase.auth) return;
        var provider = new firebase.auth.GoogleAuthProvider();
        // Persistencia local para que nuevas pestañas reconozcan la sesión
        firebase.auth().setPersistence(firebase.auth.Auth.Persistence.LOCAL)
        .then(function(){ return firebase.auth().signInWithPopup(provider); })
        .then(function(res){
          // Opcional: redirigir a donde tenga sentido
          var to = btn.getAttribute('data-success-redirect');
          if (to) location.href = to;
        })
        .catch(function(err){ console.error('Google login error:', err); });
      });
    });
  }

  // 4) Protección contra “flash” de UI incorrecto
  function addBootClass(){
    // Se quita cuando llega onAuthStateChanged
    document.documentElement.classList.add('tpl-auth-boot');
  }

  // 5) Arranque
  function init(){
    addBootClass();
    wireLogout();
    wireGoogleLogin();

    if (!window.firebase || !firebase.auth){
      console.error('Firebase Auth no encontrado. Asegúrate de cargar el SDK y la config ANTES de tpl-auth.js');
      // Aun así, liberamos boot para no dejar la página ciega:
      document.documentElement.classList.remove('tpl-auth-boot');
      return;
    }

    // Escucha centralizada del estado real
    firebase.auth().onAuthStateChanged(function(user){
      applyAuthVisibility(user);
    });
  }

  // DOM listo
  if (document.readyState === 'loading'){
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
</script>
<!-- TPL: FIN BLOQUE NUEVO -->
