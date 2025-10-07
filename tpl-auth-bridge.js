<!-- Archivo: tpl-auth-bridge.js -->
<!-- TPL: INICIO BLOQUE NUEVO [Puente de sesión unificada (Firebase + localStorage)] -->
(function(){
  if (window.__TPL_AUTH_BRIDGE__) return; window.__TPL_AUTH_BRIDGE__=true;

  function normEmail(s){ return String(s||'').trim().toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g,''); }

  const ADMIN_EMAILS = (window.__TPL_ADMIN_EMAILS || [
    '4b.jenny.gomez@gmail.com',
    'gestion@thepetslovers.es'
  ]).map(normEmail);

  const st = window.__TPL_AUTH_STATE = window.__TPL_AUTH_STATE || {
    ready:false, user:null, email:null, isAdmin:false, uid:null
  };

  function apply(email, uid){
    const e = email ? String(email) : null;
    st.user  = e ? {email:e, uid: uid||null} : null;
    st.email = e;
    st.uid   = uid||null;
    st.isAdmin = ADMIN_EMAILS.includes(normEmail(e));
    st.ready = true;
    try { localStorage.setItem('tpl.auth.email', e||''); } catch(_){}
    try {
      document.body.setAttribute('data-auth', e ? 'in' : 'out');
    }catch(_){}
    window.dispatchEvent(new CustomEvent('tpl-auth-change', { detail:{ user: st.user } }));
  }

  function initWithFirebase(){
    if (typeof firebase === 'undefined' || !firebase.auth) return false;
    try{
      firebase.auth().onAuthStateChanged(function(user){
        if(user && user.email){ apply(user.email, user.uid||null); }
        else { apply(null, null); }
      });
    }catch(e){ console.warn('AUTH-BRIDGE: Firebase auth listener error', e); }
    return true;
  }

  function initWithLocal(){
    try{
      const e = localStorage.getItem('tpl.profile.email') || localStorage.getItem('tpl.auth.email') || null;
      if(e) apply(e, null); else apply(null, null);
    }catch(_){ apply(null, null); }
  }

  // Exponer helpers mínimos
  window.TPL_AUTH = {
    get state(){ return Object.assign({}, st); },
    isLogged(){ return !!st.email; },
    email(){ return st.email||null; },
    uid(){ return st.uid||null; },
    isAdmin(){ return !!st.isAdmin; }
  };

  // Inicio
  document.addEventListener('DOMContentLoaded', function(){
    const ok = initWithFirebase();
    if(!ok) initWithLocal();
    window.dispatchEvent(new CustomEvent('tpl-auth-ready'));
  });
})();
