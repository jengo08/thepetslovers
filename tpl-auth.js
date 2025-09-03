// TPL: INICIO BLOQUE NUEVO [tpl-auth.js]
// ===== The Pets Lovers · Control unificado de sesión =====
// Requisitos: Firebase inicializado ANTES de este script.
// Alterna visibilidad con data-auth-visible="signed-in|signed-out" sin cambiar tu diseño.

(function(){
  function applyAuthVisibility(user){
    var signedIn = !!user;
    document.querySelectorAll('[data-auth-visible]').forEach(function(el){
      var want = el.getAttribute('data-auth-visible'); // 'signed-in' | 'signed-out'
      var show = (want === 'signed-in') ? signedIn : !signedIn;
      el.style.display = show ? '' : 'none';
    });
    document.documentElement.classList.remove('tpl-auth-boot');
  }

  function wireLogout(){
    var btn = document.getElementById('tpl-logout');
    if (!btn) return;
    btn.addEventListener('click', function(e){
      e.preventDefault();
      if (!window.firebase || !firebase.auth) return;
      firebase.auth().signOut()
        .then(function(){
          if ('caches' in window) { caches.keys().then(keys => keys.forEach(k => caches.delete(k))); }
          location.reload();
        })
        .catch(function(err){ console.error('Logout error:', err); });
    });
  }

  function wireGoogleLogin(){
    var btns = document.querySelectorAll('#tpl-google-login, .tpl-google-login');
    if (!btns.length) return;
    btns.forEach(function(btn){
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

  function init(){
    document.documentElement.classList.add('tpl-auth-boot');
    wireLogout();
    wireGoogleLogin();

    if (!window.firebase || !firebase.auth){
      console.error('Firebase Auth no encontrado. Carga el SDK + init ANTES de tpl-auth.js');
      document.documentElement.classList.remove('tpl-auth-boot');
      return;
    }
    firebase.auth().onAuthStateChanged(function(user){ applyAuthVisibility(user); });
  }

  if (document.readyState === 'loading'){
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
// TPL: FIN BLOQUE NUEVO
