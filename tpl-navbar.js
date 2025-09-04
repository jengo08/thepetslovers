/* TPL: INICIO BLOQUE NUEVO [Auth anónima rápida en navbar — DESACTIVADA] */
/* Motivo: quieres contar visitas sin forzar sesión y ver “Iniciar sesión” si no hay login real.
   Si algún día quieres volver a activarla, dime y la reponemos. */
/* TPL: FIN BLOQUE NUEVO */

<!-- tpl-navbar.js -->
/* TPL: INICIO BLOQUE NUEVO [tpl-navbar.js — RESCATE SIMPLE y ESTABLE] */
(function(){
  // 👉 Rutas absolutas para evitar 404 desde subcarpetas
  var PROFILE_URL = '/perfil.html';
  var PANEL_URL   = '/tpl-candidaturas-admin.html';

  // Solo tú ves el panel admin (normalizado sin tildes)
  var ADMIN_EMAILS = ['4b.jenny.gomez@gmail.com'];

  function tplNormalizeEmail(e){
    return String(e||'').trim().toLowerCase()
      .normalize('NFD').replace(/[\u0300-\u036f]/g,'');
  }
  var ADMIN_SET = new Set(ADMIN_EMAILS.map(tplNormalizeEmail));
  function isAdminEmail(email){ return ADMIN_SET.has(tplNormalizeEmail(email)); }

  // Email actual desde cache o del objeto de Firebase en localStorage
  function getCurrentEmailFromFirebaseStorage(){
    try{ var cached = localStorage.getItem('tplEmail'); if (cached) return String(cached); }catch(e){}
    try{
      for(var i=0;i<localStorage.length;i++){
        var k = localStorage.key(i);
        if(k && k.indexOf('firebase:authUser:')===0){
          var v = localStorage.getItem(k); if(!v) continue;
          var obj = JSON.parse(v||'{}');
          if(obj && obj.email){
            try{ localStorage.setItem('tplEmail', String(obj.email)); }catch(e){}
            return String(obj.email);
          }
        }
      }
    }catch(e){}
    return '';
  }

  // --- HTML del navbar
  var NAV_HTML =
    '<nav class="navbar">'
    + '  <div class="logo"><a href="index.html"><img src="images/logo.png.png" alt="The Pets Lovers"></a></div>'
    + '  <a href="index.html" class="home-button">Inicio</a>'
    + '  <ul class="nav-links">'
    + '    <li><a href="como-funciona.html">Cómo funciona</a></li>'
    + '    <li><a href="servicios.html">Servicios</a></li>'
    + '    <li><a href="trabaja-con-nosotros.html">Conviértete en cuidador</a></li>'
    + '    <li><a href="ayuda.html">¿Necesitas ayuda?</a></li>'
    + '  </ul>'
    + '  <a class="login-button" href="iniciar-sesion.html">Iniciar sesión</a>'
    + '</nav>';

  function mountNavbar(){
    try{
      if (document.querySelector('.navbar')) { applySessionUI(); markActiveLink(); return; }
      var host = document.getElementById('tpl-navbar');
      if(!host){ host = document.createElement('div'); host.id='tpl-navbar'; document.body.insertBefore(host, document.body.firstChild||null); }
      host.innerHTML = NAV_HTML;
      markActiveLink();
      applySessionUI();
    }catch(e){ console.error('TPL navbar mount error:', e); }
  }

  function markActiveLink(){
    try{
      var here = (location.pathname.split('/').pop() || 'index.html').toLowerCase();
      document.querySelectorAll('.navbar a[href]').forEach(function(a){
        var f = (a.getAttribute('href')||'').split('#')[0].toLowerCase();
        if(f && f === here){ a.setAttribute('aria-current','page'); }
      });
    }catch(e){}
  }

  /* TPL: INICIO BLOQUE NUEVO [Login real solamente — ignorar anónimo] */
  function isLoggedIn(){
    try{
      for(var i=0;i<localStorage.length;i++){
        var k = localStorage.key(i);
        if(k && k.indexOf('firebase:authUser:')===0){
          var obj = JSON.parse(localStorage.getItem(k) || '{}');
          if(obj && obj.uid){
            var providers = Array.isArray(obj.providerData) ? obj.providerData : [];
            var isAnonymous = obj.isAnonymous === true || providers.length === 0;
            if (!isAnonymous) return true; // ✅ solo login REAL (Google/Email, etc.)
          }
        }
      }
      // No usamos ya el flag manual para evitar falsos positivos
    }catch(e){}
    return false;
  }
  /* TPL: FIN BLOQUE NUEVO */

  function hideLogoutEverywhere(){
    try{
      var elems = [].slice.call(document.querySelectorAll(
        '[data-action="logout"], .logout-button, a[href*="logout"], button[href*="logout"]'
      ));
      [].slice.call(document.querySelectorAll('.navbar a, .navbar button')).forEach(function(el){
        var t=(el.textContent||'').trim().toLowerCase();
        if(t==='cerrar sesión'||t==='cerrar sesion'||t.indexOf('logout')>-1||t.indexOf('sign out')>-1){ elems.push(el); }
      });
      elems.forEach(function(el){ el.style.display='none'; el.setAttribute('aria-hidden','true'); });
    }catch(e){}
  }

  function setLoginButton(logged){
    try{
      var btn = document.querySelector('.navbar .login-button'); if(!btn) return;
      if(logged){
        var email = getCurrentEmailFromFirebaseStorage();
        var isAdmin = isAdminEmail(email);
        var dest = isAdmin ? PANEL_URL : PROFILE_URL;
        var label = isAdmin ? 'Panel' : 'Mi perfil';
        btn.textContent = label; btn.setAttribute('href', dest);
        btn.setAttribute('aria-label','Ir a ' + label.toLowerCase());
      }else{
        btn.textContent = 'Iniciar sesión';
        btn.setAttribute('href','iniciar-sesion.html');
        btn.setAttribute('aria-label','Iniciar sesión');
      }
    }catch(e){}
  }

  function applySessionUI(){
    hideLogoutEverywhere();
    setLoginButton(isLoggedIn());
    try{
      if(window.firebase && firebase.auth){
        var a = firebase.auth();
        a.onAuthStateChanged(function(u){
          try{
            // Guardamos email solo si NO es anónimo
            if(u && !u.isAnonymous && u.email){ localStorage.setItem('tplEmail', String(u.email)); }
            else { localStorage.removeItem('tplEmail'); }
          }catch(e){}

          // ✅ Botón coherente: anónimo => se considera deslogueado
          var loggedReal = !!(u && !u.isAnonymous && (u.providerData||[]).length>0);
          setLoginButton(loggedReal);
          hideLogoutEverywhere();

          try{
            if(loggedReal){ localStorage.setItem('tplAuth','1'); }
            else { localStorage.removeItem('tplAuth'); }
          }catch(e){}

          // Redirección post-login solo si hay login REAL y estás en iniciar-sesion.html
          try{
            var here = (location.pathname.split('/').pop() || '').toLowerCase();
            if (loggedReal && here === 'iniciar-sesion.html') {
              var email = (u.email || getCurrentEmailFromFirebaseStorage() || '');
              var nextUrl = isAdminEmail(email) ? PANEL_URL : PROFILE_URL;
              location.replace(nextUrl);
            }
          }catch(e){}
        });
      }
    }catch(e){}
  }

  if(document.readyState==='loading'){ document.addEventListener('DOMContentLoaded', mountNavbar); } else { mountNavbar(); }
})();
/* TPL: FIN BLOQUE NUEVO */


/* TPL: INICIO BLOQUE NUEVO [Guardia reservas/candidaturas requieren login] */
(function(){
  function getAuthSnapshot(){
    try{
      for (var i=0;i<localStorage.length;i++){
        var k = localStorage.key(i);
        if (k && k.indexOf('firebase:authUser:') === 0){
          var obj = JSON.parse(localStorage.getItem(k) || '{}');
          if (obj && obj.uid){
            var providers = Array.isArray(obj.providerData) ? obj.providerData : [];
            var isAnonymous = obj.isAnonymous === true || providers.length === 0;
            return { logged: !isAnonymous, isAnonymous: isAnonymous, email: obj.email || '' };
          }
        }
      }
    }catch(e){}
    return { logged: false, isAnonymous: true, email: '' };
  }

  function needsLogin(form){
    var t = (form.getAttribute('data-tpl-type') || '').toLowerCase();
    return t === 'reserva' || t === 'candidatura';
  }

  function gotoLogin(nextUrl){
    var next = nextUrl || location.href;
    var ov = document.getElementById('tpl-form-overlay');
    if (ov){
      ov.classList.add('show');
      var t = ov.querySelector('#tpl-form-title');
      var m = ov.querySelector('#tpl-form-msg');
      var actions = ov.querySelector('#tpl-form-actions');
      if (t) t.textContent = 'Inicia sesión';
      if (m) m.textContent = 'Necesitas iniciar sesión para continuar.';
      if (actions) actions.style.display = 'flex';
      var btn = ov.querySelector('#tpl-form-accept');
      if (btn){
        btn.replaceWith(btn.cloneNode(true));
        btn = ov.querySelector('#tpl-form-accept');
        btn.addEventListener('click', function(){
          location.href = 'iniciar-sesion.html?next=' + encodeURIComponent(next);
        }, { once:true });
        setTimeout(function(){ btn.focus(); }, 60);
        return;
      }
    }
    alert('Necesitas iniciar sesión para continuar.');
    location.href = 'iniciar-sesion.html?next=' + encodeURIComponent(next);
  }

  function onSubmitGuard(ev){
    var form = ev.target; if(!form || form.nodeName!=='FORM') return;
    if (!needsLogin(form)) return;

    var snap = getAuthSnapshot();
    if (!snap.logged){
      ev.preventDefault();
      ev.stopPropagation();
      var next = form.getAttribute('data-tpl-redirect') || location.href;
      gotoLogin(next);
    }
  }

  document.addEventListener('submit', onSubmitGuard, true);
})();
/* TPL: FIN BLOQUE NUEVO */


/* TPL: INICIO BLOQUE NUEVO [Tracking de visitas centralizado — sin requerir login] */
(function(){
  if (document.body && document.body.hasAttribute('data-tpl-no-track')) return;
  if (window.__tplTracked) return; window.__tplTracked = true;

  function loadScript(src){
    return new Promise(function(res,rej){
      var s=document.createElement('script'); s.src=src; s.onload=res; s.onerror=rej; document.head.appendChild(s);
    });
  }
  async function ensureFirebase(){
    if (!window.firebase){
      await loadScript('https://www.gstatic.com/firebasejs/10.12.5/firebase-app-compat.js');
      await loadScript('https://www.gstatic.com/firebasejs/10.12.5/firebase-firestore-compat.js');
    }else if (!firebase.firestore){
      await loadScript('https://www.gstatic.com/firebasejs/10.12.5/firebase-firestore-compat.js');
    }
    if (!firebase.apps.length){
      firebase.initializeApp({
        apiKey: "AIzaSyDW73aFuz2AFS9VeWg_linHIRJYN4YMgTk",
        authDomain: "thepetslovers-c1111.firebaseapp.com",
        projectId: "thepetslovers-c1111",
        storageBucket: "thepetslovers-c1111.appspot.com",
        messagingSenderId: "415914577533",
        appId: "1:415914577533:web:0b7a056ebaa4f1de28ab14",
        measurementId: "G-FXPD69KXBG"
      });
    }
  }
  async function trackVisit(){
    try{
      await ensureFirebase();
      if (!window.firebase || !firebase.firestore) return;
      var db = firebase.firestore();
      var now = new Date();
      var y = now.getFullYear(), m = String(now.getMonth()+1).padStart(2,'0'), d = String(now.getDate()).padStart(2,'0');
      var ymd = y+'-'+m+'-'+d;
      await db.collection('visitas').doc(ymd).set({
        date: ymd,
        createdAt: firebase.firestore.FieldValue.serverTimestamp(),
        count: firebase.firestore.FieldValue.increment(1)
      }, { merge:true });
    }catch(e){ /* si tus reglas Firestore no permiten público, esto fallará en silencio */ }
  }
  if (document.readyState==='loading'){ document.addEventListener('DOMContentLoaded', trackVisit, {once:true}); } else { trackVisit(); }
})();
/* TPL: FIN BLOQUE NUEVO */


/* TPL: INICIO BLOQUE NUEVO [Router EmailJS — sin cambios] */
(function(){
  var EMAILJS_CONFIG = {
    enabled: true,
    publicKey: 'L2xAATfVuHJwj4EIV',
    serviceId: 'service_odjqrfl',
    templates: {
      default:  'template_rao5n0c',
      candidatura: 'template_32z2wj4',
      reserva: 'template_rao5n0c',
      contacto: 'template_rao5n0c',
      perfil:   'template_32z2wj4'
    },
    toEmail: 'gestion@thepetslovers.es'
  };
  if (!EMAILJS_CONFIG.enabled) return;

  window.__TPL_EMAILJS = {
    publicKey: EMAILJS_CONFIG.publicKey,
    serviceId: EMAILJS_CONFIG.serviceId,
    templateDefault: EMAILJS_CONFIG.templates.default,
    toEmail: EMAILJS_CONFIG.toEmail
  };

  var OWNER_PREFIX='owner_', PET_PREFIX='pet_';
  var LS_OWNER='TPL_OWNER_DATA', LS_PET='TPL_PET_DATA';

  function groupKey(form){
    var type=(form.getAttribute('data-tpl-type')||'').trim().toLowerCase();
    var group=(form.getAttribute('data-tpl-group')||'').trim().toLowerCase();
    return type ? ('TPL_GROUP_'+type) : '';
  }
  function subgroup(form){ return (form.getAttribute('data-tpl-group')||'').trim().toLowerCase(); }

  function loadScript(src){
    return new Promise(function(res,rej){
      var s=document.createElement('script'); s.src=src; s.onload=res; s.onerror=rej; document.head.appendChild(s);
    });
  }
  function initEmailJS(){
    if (window.emailjs && emailjs.init){ try{ emailjs.init(EMAILJS_CONFIG.publicKey); }catch(e){} return Promise.resolve(); }
    return loadScript('https://cdn.jsdelivr.net/npm/emailjs-com@3/dist/email.min.js')
      .then(function(){ try{ emailjs.init(EMAILJS_CONFIG.publicKey); }catch(e){} });
  }

  function collectFormData(form){
    var data={}, els=form.querySelectorAll('input, select, textarea');
    for (var i=0;i<els.length;i++){
      var el=els[i]; if(!el.name) continue;
      if (el.type==='checkbox'){ data[el.name]=el.checked?'Sí':'No'; }
      else if(el.type==='radio'){ if(el.checked) data[el.name]=el.value; }
      else { data[el.name]=el.value||''; }
    }
    data.__page_title=document.title||''; data.__page_url=location.href;
    data.__form_id=form.id||''; data.__form_name=form.getAttribute('name')||'';
    data.__sent_at=new Date().toISOString(); data.to_email=EMAILJS_CONFIG.toEmail;

    var emailField=form.querySelector('[name=email], [name=correo], [type=email]');
    if(emailField && emailField.value) data.reply_to=emailField.value;
    var nameField=form.querySelector('[name=nombre], [name=name]');
    if(nameField && nameField.value) data.from_name=nameField.value;
    return data;
  }
  function buildTableHTML(obj){
    var rows=Object.keys(obj).filter(function(k){
      return k.indexOf('__')!==0 && k!=='to_email' && k!=='reply_to' && k!=='from_name' && k!=='table_html' && k!=='subject';
    }).map(function(k){
      var val=String(obj[k]).replace(/</g,'&lt;').replace(/>/g,'&gt;');
      return '<tr><td style="padding:6px 10px;border:1px solid #eee;"><b>'+k+'</b></td><td style="padding:6px 10px;border:1px solid #eee;">'+val+'</td></tr>';
    }).join('');
    return '<table style="border-collapse:collapse;border:1px solid #eee;font-family:system-ui,Segoe UI,Roboto,Arial;font-size:14px">'+rows+'</table>';
  }
  function hasPrefix(obj,prefix){ for (var k in obj){ if(Object.prototype.hasOwnProperty.call(obj,k) && k.indexOf(prefix)===0) return true; } return false; }
  function pick(obj,prefix){ var r={}; for(var k in obj){ if(k.indexOf(prefix)===0) r[k]=obj[k]; } return r; }
  function saveLS(k,v){ try{ localStorage.setItem(k, JSON.stringify(v||{})); }catch(e){} }
  function loadLS(k){ try{ return JSON.parse(localStorage.getItem(k)||'{}'); }catch(e){ return {}; } }
  function clearLS(k){ try{ localStorage.removeItem(k); }catch(e){} }
  function clearOP(){ clearLS(LS_OWNER); clearLS(LS_PET); }

  function sendEmail(type, params){
    var templateId = EMAILJS_CONFIG.templates[type] || EMAILJS_CONFIG.templates.default;
    params.table_html = buildTableHTML(params);
    var base = (type==='candidatura'?'Nueva candidatura'
               :type==='reserva'   ?'Nueva reserva'
               :type==='perfil'    ?'Registro de propietario + mascota'
               :type==='contacto'  ?'Nuevo contacto'
               :'Nuevo formulario');
    params.subject = base + (params.from_name ? (' · ' + params.from_name) : '');
    return emailjs.send(EMAILJS_CONFIG.serviceId, templateId, params);
  }

  function tryUnifiedSendByPrefix(currentParams){
    var isOwner=Object.keys(currentParams).some(function(k){return k.indexOf('owner_')===0;});
    var isPet  =Object.keys(currentParams).some(function(k){return k.indexOf('pet_')===0;});
    var ownerLS=JSON.parse(localStorage.getItem('TPL_OWNER_DATA')||'{}');
    var petLS  =JSON.parse(localStorage.getItem('TPL_PET_DATA')||'{}');
    if(isOwner) try{ localStorage.setItem('TPL_OWNER_DATA', JSON.stringify(Object.keys(currentParams).reduce(function(a,k){ if(k.indexOf('owner_')===0) a[k]=currentParams[k]; return a; }, {}))); }catch(e){}
    if(isPet)   try{ localStorage.setItem('TPL_PET_DATA',   JSON.stringify(Object.keys(currentParams).reduce(function(a,k){ if(k.indexOf('pet_')===0) a[k]=currentParams[k]; return a; }, {}))); }catch(e){}
    try{ ownerLS=JSON.parse(localStorage.getItem('TPL_OWNER_DATA')||'{}'); petLS=JSON.parse(localStorage.getItem('TPL_PET_DATA')||'{}'); }catch(e){}
    var haveBoth = Object.keys(ownerLS).length && Object.keys(petLS).length;
    if(!haveBoth) return false;
    var merged={}; Object.keys(currentParams).forEach(function(k){merged[k]=currentParams[k];});
    Object.keys(ownerLS).forEach(function(k){merged[k]=ownerLS[k];});
    Object.keys(petLS).forEach(function(k){merged[k]=petLS[k];});
    merged.unified_info='Propietario + Mascota (unificado por prefijos)';
    try{ localStorage.removeItem('TPL_OWNER_DATA'); localStorage.removeItem('TPL_PET_DATA'); }catch(e){}
    sendEmail('perfil', merged).catch(function(){});
    return true;
  }

  function tryUnifiedSendByGroup(form, currentParams){
    function groupKey(form){
      var type=(form.getAttribute('data-tpl-type')||'').trim().toLowerCase();
      return type ? ('TPL_GROUP_'+type) : '';
    }
    function subgroup(form){ return (form.getAttribute('data-tpl-group')||'').trim().toLowerCase(); }

    var gKey=groupKey(form); var sub=subgroup(form);
    if(!gKey || !sub) return false;

    var cacheAll={}; try{ cacheAll=JSON.parse(localStorage.getItem(gKey)||'{}'); }catch(e){}
    cacheAll[sub]=currentParams; try{ localStorage.setItem(gKey, JSON.stringify(cacheAll)); }catch(e){}
    var haveOwner=!!cacheAll.propietario, havePet=!!cacheAll.mascota;
    if(!(haveOwner&&havePet)) return false;

    var merged={}, owner=cacheAll.propietario||{}, pet=cacheAll.mascota||{};
    Object.keys(owner).forEach(function(k){ merged['owner_'+k]=owner[k]; });
    Object.keys(pet).forEach(function(k){ merged['pet_'+k]=pet[k]; });
    Object.keys(currentParams).forEach(function(k){ if(!merged.hasOwnProperty(k)) merged[k]=currentParams[k]; });
    merged.unified_info='Propietario + Mascota (unificado por grupo)';
    try{ localStorage.removeItem(gKey); }catch(e){}
    sendEmail('perfil', merged).catch(function(){});
    return true;
  }

  function onAnyFormSubmit(ev){
    var form = ev.target; if(!form || form.nodeName!=='FORM') return;
    if (form.hasAttribute('data-tpl-no-emailjs')) return;
    try{
      var type = (form.getAttribute('data-tpl-type')||'default').toLowerCase();
      var params = collectFormData(form);
      var unifiedByGroup = false;
      var t=(form.getAttribute('data-tpl-type')||'').toLowerCase();
      if(t==='perfil' && (form.getAttribute('data-tpl-group')||'')){ unifiedByGroup = tryUnifiedSendByGroup(form, params); if(unifiedByGroup) return; }
      var unifiedByPrefix = tryUnifiedSendByPrefix(params);
      if(unifiedByPrefix) return;
      sendEmail(type, params).catch(function(){});
    }catch(e){}
  }

  function boot(){ initEmailJS().then(function(){ document.addEventListener('submit', onAnyFormSubmit, true); }); }
  if(document.readyState==='loading'){ document.addEventListener('DOMContentLoaded', boot, {once:true}); } else { boot(); }
})();
/* TPL: FIN BLOQUE NUEVO */


/* TPL: INICIO BLOQUE NUEVO [UX formularios — sin cambios] */
(function(){
  function ensureOverlay(){
    var ex = document.getElementById('tpl-form-overlay');
    if (ex) return ex;
    var wrap = document.createElement('div');
    wrap.id = 'tpl-form-overlay';
    wrap.className = 'tpl-form-overlay';
    var css = document.createElement('style');
    css.textContent =
      '.tpl-form-overlay{position:fixed;inset:0;background:rgba(0,0,0,.45);display:none;align-items:center;justify-content:center;z-index:9999;padding:16px}'
      +'.tpl-form-overlay.show{display:flex}'
      +'.tpl-form-card{background:#fff;max-width:520px;width:100%;border-radius:12px;padding:16px;box-shadow:0 8px 28px rgba(0,0,0,.18)}'
      +'.tpl-form-spinner{width:28px;height:28px;border-radius:50%;border:3px solid #eee;border-top-color:#339496;animation:tplspin 1s linear infinite;margin:6px 0 10px}'
      +'@keyframes tplspin{to{transform:rotate(360deg)}}'
      +'.tpl-form-actions{margin-top:12px;display:none;gap:8px;justify-content:flex-end}'
      +'.tpl-cta{background:#339496;color:#fff;border:none;border-radius:999px;padding:10px 16px;font-weight:700;cursor:pointer}'
      +'.tpl-cta.link{background:#fff;color:#339496;border:2px solid #339496}'
      +'.tpl-muted{color:#666}';
    document.head.appendChild(css);
    wrap.innerHTML =
      '<div class="tpl-form-card" role="alertdialog" aria-live="polite" aria-label="Estado del envío">'
      + '  <div class="tpl-form-spinner" aria-hidden="true"></div>'
      + '  <h3 id="tpl-form-title" style="margin:0 0 6px">Enviando…</h3>'
      + '  <p id="tpl-form-msg" class="tpl-muted" style="margin:0">No cierres esta ventana.</p>'
      + '  <div id="tpl-form-actions" class="tpl-form-actions">'
      + '    <button id="tpl-form-accept" type="button" class="tpl-cta">Aceptar</button>'
      + '  </div>'
      + '</div>';
    document.body.appendChild(wrap);
    return wrap;
  }

  function showOverlay(title, msg){
    var o = ensureOverlay();
    o.querySelector('#tpl-form-title').textContent = title || 'Enviando…';
    o.querySelector('#tpl-form-msg').textContent = msg || 'Subiendo archivos, un momento…';
    o.querySelector('.tpl-form-spinner').style.display = '';
    o.querySelector('#tpl-form-actions').style.display = 'none';
    o.classList.add('show');
  }

  function showSuccess(opts){
    var o = ensureOverlay();
    o.querySelector('.tpl-form-spinner').style.display = 'none';
    o.querySelector('#tpl-form-title').textContent = '✅ ¡Listo!';
    o.querySelector('#tpl-form-msg').textContent = (opts && opts.msg) || 'Tu solicitud se ha enviado correctamente.';
    var actions = o.querySelector('#tpl-form-actions');
    var btn = o.querySelector('#tpl-form-accept');
    if (opts && opts.showAccept){
      actions.style.display = 'flex';
      btn.replaceWith(btn.cloneNode(true));
      btn = o.querySelector('#tpl-form-accept');
      btn.addEventListener('click', function(){
        try{ actions.style.display='none'; }catch(e){}
        if (opts.onAccept) opts.onAccept();
      }, { once:true });
      setTimeout(function(){ btn.focus(); }, 60);
    } else {
      actions.style.display = 'none';
    }
    o.classList.add('show');
  }

  function hideOverlay(){
    var o = document.getElementById('tpl-form-overlay'); if (!o) return;
    o.classList.remove('show');
    var sp = o.querySelector('.tpl-form-spinner'); if (sp) sp.style.display='';
    var actions = o.querySelector('#tpl-form-actions'); if (actions) actions.style.display='none';
  }

  document.addEventListener('submit', function(ev){
    var form = ev.target;
    if (!form || form.nodeName !== 'FORM') return;

    var typeAttr = (form.getAttribute('data-tpl-type')||'').toLowerCase();
    var successAttr = form.getAttribute('data-tpl-success');
    var candidaturaFallback = 'Listo, tu solicitud se ha enviado correctamente. Te mandaremos un enlace una vez esté aceptada para que puedas crear tu perfil y tu disponibilidad.';
    var successMsg = successAttr || (typeAttr === 'candidatura' ? candidaturaFallback : '');
    if (!successMsg) return;

    var btns = form.querySelectorAll('button, [type=submit]');
    btns.forEach(function(b){ b.disabled=true; b.dataset._tplText=b.textContent; b.textContent='Enviando…'; });

    showOverlay('Enviando…', 'Guardando datos. Puede tardar unos segundos.');

    var redirectToAttr = form.getAttribute('data-tpl-redirect');
    var defaultRedirect = typeAttr ? (typeAttr==='candidatura' ? 'index.html' : 'perfil.html') : '';
    var redirectTo = redirectToAttr || defaultRedirect;

    var unloaded=false; window.addEventListener('beforeunload', function(){ unloaded=true; }, {once:true});
    var waitMs = parseInt(form.getAttribute('data-tpl-wait')||'12000', 10);

    setTimeout(function(){
      if (unloaded) return;
      if (typeAttr === 'candidatura'){
        showSuccess({
          msg: successMsg,
          showAccept: true,
          onAccept: function(){
            btns.forEach(function(b){ try{ b.disabled=false; if(b.dataset._tplText) b.textContent=b.dataset._tplText; }catch(e){} });
            if (redirectTo){ location.href = redirectTo; } else { hideOverlay(); }
          }
        });
      } else {
        showSuccess({ msg: successMsg, showAccept: false });
        btns.forEach(function(b){ try{ b.disabled=false; if(b.dataset._tplText) b.textContent=b.dataset._tplText; }catch(e){} });
        if (redirectTo){ setTimeout(function(){ location.href=redirectTo; }, 2200); } else { setTimeout(hideOverlay, 2200); }
      }
    }, waitMs);
  }, true);
})();
/* TPL: FIN BLOQUE NUEVO */
