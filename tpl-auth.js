<!-- TPL: INICIO BLOQUE NUEVO [tpl-auth.js — Control unificado de sesión en navbar + visibilidad] -->
<script>
(function(){
  'use strict';

  // ===== AJUSTES =====
  var ADMIN_EMAILS = ['gestion@thepetslovers.es']; // añade más si necesitas
  var URLS = {
    PROFILE: 'perfil.html',
    ADMIN_PANEL: 'tpl-candidaturas-admin.html',
    LOGIN: '/iniciar-sesion.html',
    INDEX: 'index.html'
  };

  // Encontrar todos los <a class="login-button">
  function findLoginButtons(){
    return Array.prototype.slice.call(document.querySelectorAll('a.login-button'));
  }

  // Cambiar texto y href del botón en TODAS las navbars presentes
  function setButtonState(state){
    var btns = findLoginButtons();
    for(var i=0;i<btns.length;i++){
      var btn = btns[i];
      if(state === 'guest'){
        btn.textContent = 'Iniciar sesión';
        btn.setAttribute('href', URLS.LOGIN);
        btn.classList.add('tpl-guest');
        btn.classList.remove('tpl-logged');
      } else if(state === 'user'){
        btn.textContent = 'Mi perfil';
        btn.setAttribute('href', URLS.PROFILE);
        btn.classList.add('tpl-logged');
        btn.classList.remove('tpl-guest');
      } else if(state === 'admin'){
        btn.textContent = 'Mi panel';
        btn.setAttribute('href', URLS.ADMIN_PANEL);
        btn.classList.add('tpl-logged');
        btn.classList.remove('tpl-guest');
      }
    }
  }

  // Si la navbar se inyecta tarde (p. ej. con tpl-navbar.js), repintamos al aparecer
  function attachObserver(getCurrentState){
    try{
      var obs = new MutationObserver(function(){ setButtonState(getCurrentState()); });
      obs.observe(document.documentElement, { childList:true, subtree:true });
    }catch(_){}
  }

  // ======== VISIBILIDAD por data-auth-visible (lo que ya tenías) ========
  // Alterna elementos con data-auth-visible="signed-in" | "signed-out"
  function applyAuthVisibility(user){
    var signedIn = !!user && !user.isAnonymous; // SIN anónimo
    var nodes = document.querySelectorAll('[data-auth-visible]');
    for(var i=0;i<nodes.length;i++){
      var el = nodes[i];
      var want = el.getAttribute('data-auth-visible'); // 'signed-in' | 'signed-out'
      var show = (want === 'signed-in') ? signedIn : !signedIn;
      el.style.display = show ? '' : 'none';
    }
    document.documentElement.classList.remove('tpl-auth-boot');
  }

  // ======== Cerrar sesión ========
  function performLogout(){
    if (!window.firebase || !firebase.auth) {
      // Sin Firebase, al menos devolvemos UI y redirigimos
      setButtonState('guest');
      window.location.href = URLS.INDEX;
      return;
    }
    firebase.auth().signOut()
      .catch(function(err){ console.warn('[TPL auth] signOut:', err); })
      .then(function(){
        // Limpieza opcional de caches
        if ('caches' in window) {
          return caches.keys().then(function(keys){
            return Promise.all(keys.map(function(k){ return caches.delete(k); }));
          });
        }
      })
      .finally(function(){
        setButtonState('guest');
        window.location.href = URLS.INDEX; // SIEMPRE a inicio
      });
  }

  // Botón con id="tpl-logout"
  function wireLogout(){
    var btn = document.getElementById('tpl-logout');
    if (btn){
      btn.addEventListener('click', function(e){ e.preventDefault(); performLogout(); });
    }
    // API global por si quieres llamarlo desde cualquier enlace
    window.TPL_LOGOUT = performLogout;
  }

  // ======== Login con Google (lo que ya tenías) ========
  function wireGoogleLogin(){
    var btns = document.querySelectorAll('#tpl-google-login, .tpl-google-login');
    if (!btns.length) return;
    Array.prototype.forEach.call(btns, function(btn){
      btn.addEventListener('click', function(e){
        e.preventDefault();
        if (!window.firebase || !firebase.auth) return;
        var provider = new firebase.auth.GoogleAuthProvider();
        firebase.auth().setPersistence(firebase.auth.Auth.Persistence.LOCAL)
          .then(function(){ return firebase.auth().signInWithPopup(provider); })
          .then(function(){
            var to = new URLSearchParams(location.search).get('next') || btn.getAttribute('data-success-redirect');
            if (to) location.href = to;
          })
          .catch(function(err){ console.error('Google login error:', err); });
      });
    });
  }

  // Estado derivado del usuario → 'guest' | 'user' | 'admin'
  function stateFromUser(user){
    if(!user || user.isAnonymous) return 'guest'; // SIN anónimo
    var email = (user.email || '').toLowerCase();
    return ADMIN_EMAILS.indexOf(email) >= 0 ? 'admin' : 'user';
  }

  // ======== INIT ========
  function init(){
    document.documentElement.classList.add('tpl-auth-boot');

    wireLogout();
    wireGoogleLogin();

    // Estado por defecto: visitante
    setButtonState('guest');

    if (!window.firebase || !firebase.auth){
      console.error('Firebase Auth no encontrado. Carga el SDK + init ANTES de tpl-auth.js');
      document.documentElement.classList.remove('tpl-auth-boot');
      return;
    }

    // Pintar según sesión
    firebase.auth().onAuthStateChanged(function(user){
      applyAuthVisibility(user);
      setButtonState(stateFromUser(user));

      // Si navbars se inyectan tarde, nos aseguramos de repintar
      if (!window.__TPL_NAV_OBS_ATTACHED__) {
        attachObserver(function(){
          var u = (firebase.auth && firebase.auth().currentUser) || null;
          return stateFromUser(u);
        });
        window.__TPL_NAV_OBS_ATTACHED__ = true;
      }
    });
  }

  if (document.readyState === 'loading'){
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
</script>
<!-- TPL: FIN BLOQUE NUEVO -->
