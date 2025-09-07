<!-- Archivo: tpl-auth-bridge.js -->
<!-- TPL: INICIO BLOQUE NUEVO [Puente de sesión unificada (Firebase + localStorage)] -->
(function(){
  if (window.__TPL_AUTH_BRIDGE__) return; window.__TPL_AUTH_BRIDGE__=true;

  function normEmail(s){ return String(s||'').trim().toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g,''); }

  const ADMIN_EMAILS = (window.__TPL_ADMIN_EMAILS || [
    '4b.jenny.gomez@gmail.com',      // ajusta si hace falta
    'gestion@thepetslovers.es'       // ajusta si hace falta
  ]).map(normEmail);

  const st = window.__TPL_AUTH_STATE = window.__TPL_AUTH_STATE || {
    ready:false, user:null, email:null, isAdmin:false, uid:null
  };

  function apply(email, uid){
    const e = email ? String(email) : null;
    st.user  = e ? {email:e, uid: uid||null} : null;
    st.email = e;
    st.uid   = uid||null;
    st.isAdmin = !!(e && ADMIN_EMAILS.includes(normEmail(e)));
    document.body && document.body.setAttribute('data-auth', e ? 'in' : 'out');
    if (e) {
      try{ localStorage.setItem('tpl_auth_email', e); }catch(_){}
      try{ localStorage.setItem('tpl_auth_uid', uid||''); }catch(_){}
    } else {
      try{ localStorage.removeItem('tpl_auth_email'); }catch(_){}
      try{ localStorage.removeItem('tpl_auth_uid'); }catch(_){}
    }
    window.dispatchEvent(new CustomEvent('tpl-auth-change',{detail:{email:e}}));
  }

  function syncFromStorage(){
    let e=null,u=null;
    try{ e = localStorage.getItem('tpl_auth_email'); }catch(_){}
    try{ u = localStorage.getItem('tpl_auth_uid'); }catch(_){}
    apply(e||null, u||null);
  }

  window.addEventListener('storage', (ev)=>{
    if (ev && (ev.key==='tpl_auth_email' || ev.key==='tpl_auth_uid')) syncFromStorage();
  });

  // Intento con Firebase (si existe config). Si no, caemos a storage.
  const cfg = window.__TPL_FIREBASE_CONFIG;
  if (cfg){
    const mod = document.createElement('script');
    mod.type='module';
    mod.textContent = `
      import { initializeApp, getApps, getApp } from "https://www.gstatic.com/firebasejs/10.12.4/firebase-app.js";
      import { getAuth, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.12.4/firebase-auth.js";
      const cfg = window.__TPL_FIREBASE_CONFIG;
      const app  = getApps().length ? getApp() : initializeApp(cfg);
      const auth = getAuth(app);
      window.__tpl_signOut = ()=> signOut(auth).catch(()=>{});
      onAuthStateChanged(auth, (user)=>{
        const email = user && user.email ? user.email : null;
        const uid   = user && user.uid   ? user.uid   : null;
        window.__TPL_AUTH_BRIDGE_UPDATE && window.__TPL_AUTH_BRIDGE_UPDATE(email, uid);
      });
      window.__TPL_AUTH_BRIDGE_READY && window.__TPL_AUTH_BRIDGE_READY();
    `;
    document.head.appendChild(mod);
    window.__TPL_AUTH_BRIDGE_UPDATE = (email, uid)=> apply(email, uid);
    window.__TPL_AUTH_BRIDGE_READY  = ()=>{
      st.ready = true;
      window.dispatchEvent(new CustomEvent('tpl-auth-ready'));
    };
  } else {
    // Sin Firebase: usa storage como verdad
    syncFromStorage();
    st.ready = true;
    window.dispatchEvent(new CustomEvent('tpl-auth-ready'));
  }

  // Utilidad pública: esperar a que Auth esté listo
  window.__tpl_waitAuthReady = function(timeoutMs){
    timeoutMs = Number(timeoutMs||6000);
    if (st.ready) return Promise.resolve();
    return new Promise(resolve=>{
      const t = setTimeout(()=>resolve(), timeoutMs);
      const fn= ()=>{ clearTimeout(t); resolve(); };
      window.addEventListener('tpl-auth-ready', fn, {once:true});
    });
  };
})();
<!-- TPL: FIN BLOQUE NUEVO -->
