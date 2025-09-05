/* TPL: INICIO BLOQUE NUEVO [tpl-auth.js — Control unificado de sesión en navbar + visibilidad (antibloqueo)] */
(function(){
  if (window.__TPL_AUTH_LOADED__) return;
  window.__TPL_AUTH_LOADED__ = true;

  'use strict';

  // ===== AJUSTES =====
  // Incluyo tu Gmail además del correo de gestión para que puedas probar como admin.
  var ADMIN_EMAILS = ['gestion@thepetslovers.es', '4b.jenny.gomez@gmail.com'];
  var URLS = {
    PROFILE: 'perfil.html',
    ADMIN_PANEL: 'tpl-candidaturas-admin.html',
    LOGIN: '/iniciar-sesion.html',
    INDEX: 'index.html'
  };

  // --- Helpers UI (navbar) ---
  function findLoginButtons(){
    return Array.prototype.slice.call(document.querySelectorAll('a.login-button'));
  }
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
  function attachObserver(getCurrentState){
    try{
      var obs = new MutationObserver(function(){ setButtonState(getCurrentState()); });
      obs.observe(document.documentElement, { childList:true, subtree:true });
    }catch(_){}
  }

  // --- Visibilidad declarativa (si la usas en tu HTML con data-auth-visible) ---
  function applyAuthVisibility(user){
    var signedIn = !!user && !user.isAnonymous; // SIN anónimo
    var nodes = document.querySelectorAll('[data-auth-visible]');
    for(var i=0;i<nodes.length;i++){
      var el = nodes[i];
      var want = el.getAttribute('data-auth-visible'); // 'signed-in' | 'signed-out'
      var show = (want === 'signed-in') ? signedIn : !signedIn;
      el.style.display = show ? '' : 'none';
    }
  }

  // --- Logout (global) ---
  function performLogout(){
    if (!(window.firebase && firebase.auth)) {
      setButtonState('guest');
      window.location.href = URLS.INDEX;
      return;
    }
    firebase.auth().signOut()
      .catch(function(err){ console.warn('[TPL auth] signOut:', err); })
      .then(function(){
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
  function wireLogout(){
    var btn = document.getElementById('tpl-logout');
    if (btn){
      btn.addEventListener('click', function(e){ e.preventDefault(); performLogout(); });
    }
    window.TPL_LOGOUT = performLogout; // API global
  }

  // --- Login con Google (si hay botones) ---
  function wireGoogleLogin(){
    var btns = document.querySelectorAll('#tpl-google-login, .tpl-google-login');
    if (!btns.length) return;
    Array.prototype.forEach.call(btns, function(btn){
      btn.addEventListener('click', function(e){
        e.preventDefault();
        if (!(window.firebase && firebase.auth)) return;
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

  // --- Estado → 'guest' | 'user' | 'admin'
  function stateFromUser(user){
    if(!user || user.isAnonymous) return 'guest'; // SIN anónimo
    var email = (user.email || '').toLowerCase();
    return ADMIN_EMAILS.indexOf(email) >= 0 ? 'admin' : 'user';
  }

  // --- Carga perezosa de Firebase v8 (namespaced) si no está presente ---
  function lazyLoadFirebaseIfNeeded(cb){
    if (window.firebase && window.firebase.app) { cb(); return; }
    var urls = [
      'https://www.gstatic.com/firebasejs/8.10.1/firebase-app.js',
      'https://www.gstatic.com/firebasejs/8.10.1/firebase-auth.js'
    ];
    var i = 0;
    (function next(){
      if (i >= urls.length){ cb(); return; }
      var s = document.createElement('script');
      s.src = urls[i++];
      s.async = true;
      s.onload = next;
      s.onerror = function(){ console.error('[TPL auth] No se pudo cargar Firebase SDK'); cb(); };
      document.head.appendChild(s);
    })();
  }

  // --- INIT ---
  function init(){
    wireLogout();
    wireGoogleLogin();
    setButtonState('guest'); // estado por defecto rápido

    lazyLoadFirebaseIfNeeded(function(){
      try{
        if (!(window.firebase && firebase.initializeApp)) { setButtonState('guest'); return; }
        if (!firebase.apps || !firebase.apps.length){
          var cfg = window.TPL_FIREBASE_CONFIG || window.firebaseConfig || window.__TPL_FIREBASE_CONFIG;
          if (cfg) firebase.initializeApp(cfg);
        }
      }catch(e){ console.warn('[TPL auth] init app warn:', e); }

      if (!(window.firebase && firebase.auth && firebase.auth())){
        console.warn('[TPL auth] Firebase Auth no disponible (¿SDK no cargado o init faltante?).');
        setButtonState('guest');
        return;
      }

      // Pintar según sesión
      try{
        firebase.auth().onAuthStateChanged(function(user){
          applyAuthVisibility(user);
          setButtonState(stateFromUser(user));

          if (!window.__TPL_NAV_OBS_ATTACHED__){
            attachObserver(function(){
              var u = (window.firebase && firebase.auth && firebase.auth().currentUser) || null;
              return stateFromUser(u);
            });
            window.__TPL_NAV_OBS_ATTACHED__ = true;
          }
        });
      }catch(e){
        console.error('[TPL auth] onAuthStateChanged error:', e);
        setButtonState('guest');
      }
    });
  }

  if (document.readyState === 'loading'){
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
/* TPL: FIN BLOQUE NUEVO */
