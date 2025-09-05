/* TPL: INICIO BLOQUE NUEVO [Auth anónima rápida en navbar (opcional, no afecta botón)] */
// ⚠️ Desactivado a petición: eliminamos el login anónimo para no romper el estado del botón.
// (Dejado vacío a propósito)
(function(){ /* noop */ })();
/* TPL: FIN BLOQUE NUEVO */


/* TPL: INICIO BLOQUE NUEVO [tpl-navbar — MEJORADO y FIABLE (botón como antes, pero robusto)] */
(function(){
  if (window.__TPL_NAVBAR_BOOTED) return; window.__TPL_NAVBAR_BOOTED = true;

  // ✅ Esta versión SOLO monta la navbar y marca el enlace activo.
  // ❗ El botón .login-button lo gestiona tpl-auth.js (no lo tocamos aquí).

  // HTML por si la página no trae .navbar. Si ya existe, no se duplica.
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
      if (!document.querySelector('.navbar')){
        var host = document.getElementById('tpl-navbar');
        if(!host){ host = document.createElement('div'); host.id='tpl-navbar'; document.body.insertBefore(host, document.body.firstChild||null); }
        host.innerHTML = NAV_HTML;
      }
      markActiveLink();
      // ❌ Ya no llamamos a lógica de sesión aquí. Eso es de tpl-auth.js
    }catch(e){ console.error('TPL navbar mount error:', e); }
  }

  function markActiveLink(){
    try{
      var here = (location.pathname.split('/').pop() || 'index.html').toLowerCase();
      var nodes = document.querySelectorAll('.navbar a[href]');
      for (var i=0;i<nodes.length;i++){
        var a = nodes[i]; var f = (a.getAttribute('href')||'').split('#')[0].toLowerCase();
        if(f && f === here){ a.setAttribute('aria-current','page'); }
      }
    }catch(e){}
  }

  if(document.readyState==='loading'){
    document.addEventListener('DOMContentLoaded', mountNavbar, {once:true});
  }else{
    mountNavbar();
  }
})();
/* TPL: FIN BLOQUE NUEVO */


/* TPL: INICIO BLOQUE NUEVO [Guardia — reservas/candidaturas requieren login REAL] */
(function(){
  function getAuthSnapshot(){
    try{
      for (var i=0;i<localStorage.length;i++){
        var k = localStorage.key(i);
        if (k && k.indexOf('firebase:authUser:') === 0){
          var obj = JSON.parse(localStorage.getItem(k)||'{}');
          if (obj && obj.uid){
            var isAnon = !!obj.isAnonymous;
            var provs = Array.isArray(obj.providerData) ? obj.providerData.map(function(p){ return p && p.providerId; }) : [];
            if (provs.length === 0 && isAnon !== false) isAnon = true;
            return { logged: !isAnon, isAnonymous: isAnon, email: obj.email || '' };
          }
        }
      }
    }catch(e){}
    return { logged:false, isAnonymous:true, email:'' };
  }

  function needsLogin(form){
    var t = (form.getAttribute('data-tpl-type')||'').toLowerCase();
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
    var form = ev.target;
    if (!form || form.nodeName !== 'FORM') return;
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


/* TPL: INICIO BLOQUE NUEVO [Tracking de visitas — Firestore] */
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
      var ymd = y + '-' + m + '-' + d;
      await db.collection('visitas').doc(ymd).set({
        date: ymd,
        createdAt: firebase.firestore.FieldValue.serverTimestamp(),
        count: firebase.firestore.FieldValue.increment(1)
      }, { merge:true });
    }catch(e){}
  }
  if (document.readyState === 'loading'){
    document.addEventListener('DOMContentLoaded', trackVisit, { once:true });
  } else {
    trackVisit();
  }
})();
/* TPL: FIN BLOQUE NUEVO */


/* TPL: INICIO BLOQUE NUEVO [Router EmailJS — Unificación por prefijos/grupo] */
(function(){
  var EMAILJS_CONFIG = {
    enabled: true,
    publicKey: 'L2xAATfVuHJwj4EIV',
    serviceId: 'service_odjqrfl',
    templates: {
      default:  'template_wmz159o',
      candidatura: 'TEMPLATE_ID_CANDIDATURA',
      reserva: 'TEMPLATE_ID_RESERVA',
      contacto: 'TEMPLATE_ID_CONTACTO',
      perfil:   'template_wmz159o'
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
               :type==='contacto'  ?'Nuevo contacto'
               :type==='perfil'    ?'Nuevo perfil'
                                   :'Nuevo formulario');
    params.subject = base + (params.from_name ? (' · ' + params.from_name) : '');
    return emailjs.send(EMAILJS_CONFIG.serviceId, templateId, params);
  }

  function tryUnifiedSendByPrefix(currentParams){
    var isOwner=hasPrefix(currentParams,OWNER_PREFIX), isPet=hasPrefix(currentParams,PET_PREFIX);
    var ownerLS=loadLS(LS_OWNER), petLS=loadLS(LS_PET);
    if(isOwner) saveLS(LS_OWNER, pick(currentParams,OWNER_PREFIX));
    if(isPet)   saveLS(LS_PET,   pick(currentParams,PET_PREFIX));
    ownerLS=loadLS(LS_OWNER); petLS=loadLS(LS_PET);
    var haveBoth = Object.keys(ownerLS).length && Object.keys(petLS).length;
    if(!haveBoth) return false;

    var merged={}; for(var k in currentParams){ merged[k]=currentParams[k]; }
    for(var k2 in ownerLS){ merged[k2]=ownerLS[k2]; }
    for(var k3 in petLS){ merged[k3]=petLS[k3]; }
    merged.unified_info='Propietario + Mascota (unificado por prefijos)';
    clearOP();

    sendEmail('perfil', merged).catch(function(){});
    return true;
  }

  function tryUnifiedSendByGroup(form, currentParams){
    var gKey=groupKey(form); var sub=subgroup(form);
    if(!gKey || !sub) return false;

    var cacheAll=loadLS(gKey); cacheAll[sub]=currentParams; saveLS(gKey, cacheAll);
    var haveOwner=!!cacheAll.propietario, havePet=!!cacheAll.mascota;
    if(!(haveOwner&&havePet)) return false;

    var merged={}, owner=cacheAll.propietario||{}, pet=cacheAll.mascota||{};
    for(var k in owner){ merged['owner_'+k]=owner[k]; }
    for(var k2 in pet){ merged['pet_'+k2]=pet[k2]; }
    for(var k3 in currentParams){ if(!merged.hasOwnProperty(k3)) merged[k3]=currentParams[k3]; }
    merged.unified_info='Propietario + Mascota (unificado por grupo)';
    clearLS(gKey);

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
      if(t==='perfil' && subgroup(form)){ unifiedByGroup = tryUnifiedSendByGroup(form, params); if(unifiedByGroup) return; }
      var unifiedByPrefix = tryUnifiedSendByPrefix(params);
      if(unifiedByPrefix) return;

      initEmailJS().then(function(){ sendEmail(type, params).catch(function(){}); });
    }catch(e){}
  }

  function boot(){ initEmailJS().then(function(){ document.addEventListener('submit', onAnyFormSubmit, true); }); }
  if(document.readyState==='loading'){ document.addEventListener('DOMContentLoaded', boot, {once:true}); } else { boot(); }
})();
/* TPL: FIN BLOQUE NUEVO */


/* TPL: INICIO BLOQUE NUEVO [UX formularios — feedback + redirección optimista] */
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
      +'.tpl-muted{color:#666}'
      +'.tpl-form-actions{display:none;gap:8px;justify-content:flex-end;margin-top:12px}'
      +'.tpl-cta{background:#339496;color:#fff;border:none;border-radius:999px;padding:10px 16px;font-weight:700;cursor:pointer}'
      +'.tpl-cta.link{background:#fff;color:#339496;border:2px solid #339496}';
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
    o.querySelector('#tpl-form-msg').textContent = msg || 'Subiendo archivos (si aplica) y guardando datos. Puede tardar unos segundos.';
    o.querySelector('.tpl-form-spinner').style.display = '';
    o.querySelector('#tpl-form-actions').style.display = 'none';
    o.classList.add('show');
  }
  function showSuccess(msg, withAccept, onAccept){
    var o = ensureOverlay();
    o.querySelector('.tpl-form-spinner').style.display = 'none';
    o.querySelector('#tpl-form-title').textContent = '✅ ¡Listo!';
    o.querySelector('#tpl-form-msg').textContent = msg || 'Tu solicitud se ha enviado correctamente.';
    var actions = o.querySelector('#tpl-form-actions');
    var btn = o.querySelector('#tpl-form-accept');
    if (withAccept){
      actions.style.display = 'flex';
      btn.replaceWith(btn.cloneNode(true));
      btn = o.querySelector('#tpl-form-accept');
      btn.addEventListener('click', function(){ if(onAccept) onAccept(); }, { once:true });
      setTimeout(function(){ btn.focus(); }, 60);
    } else {
      actions.style.display = 'none';
    }
    o.classList.add('show');
  }
  function hideOverlay(){
    var o = document.getElementById('tpl-form-overlay');
    if (!o) return;
    o.classList.remove('show');
    var sp = o.querySelector('.tpl-form-spinner'); if (sp) sp.style.display = '';
    var actions = o.querySelector('#tpl-form-actions'); if (actions) actions.style.display='none';
  }

  document.addEventListener('submit', function(ev){
    var form = ev.target;
    if (!form || form.nodeName !== 'FORM') return;

    var typeAttr = (form.getAttribute('data-tpl-type')||'').toLowerCase();
    var successMsgAttr = form.getAttribute('data-tpl-success');
    var redirectToAttr = form.getAttribute('data-tpl-redirect');
    var defaultRedirect = typeAttr ? (typeAttr==='candidatura' ? 'index.html' : 'perfil.html') : '';
    var redirectTo = redirectToAttr || defaultRedirect;

    var successMsg = successMsgAttr || (typeAttr==='candidatura'
      ? 'Listo, tu solicitud se ha enviado correctamente. Te mandaremos un enlace una vez esté aceptada para que puedas crear tu perfil y disponibilidad.'
      : 'Tu solicitud se ha enviado correctamente.');

    var btns = form.querySelectorAll('button, [type=submit]');
    btns.forEach(function(b){ b.disabled = true; b.dataset._tplText = b.textContent; b.textContent = 'Enviando…'; });

    showOverlay('Enviando…');

    var unloaded=false; window.addEventListener('beforeunload', function(){ unloaded=true; }, {once:true});
    var waitMs = parseInt(form.getAttribute('data-tpl-wait')||'12000', 10);

    setTimeout(function(){
      if (unloaded) return;

      if (typeAttr === 'candidatura'){
        showSuccess(successMsg, true, function(){
          btns.forEach(function(b){ try{ b.disabled=false; if(b.dataset._tplText) b.textContent=b.dataset._tplText; }catch(e){} });
          if (redirectTo) location.href = redirectTo; else hideOverlay();
        });
      } else {
        showSuccess(successMsg, false);
        btns.forEach(function(b){ try{ b.disabled=false; if(b.dataset._tplText) b.textContent=b.dataset._tplText; }catch(e){} });
        if (redirectTo){ setTimeout(function(){ location.href = redirectTo; }, 2200); }
        else { setTimeout(hideOverlay, 2200); }
      }
    }, waitMs);

    form.addEventListener('reset', function(){
      if (typeAttr === 'candidatura'){
        showSuccess(successMsg, true, function(){
          if (redirectTo) location.href = redirectTo; else hideOverlay();
        });
      } else {
        showSuccess(successMsg, false);
        if (redirectTo){ setTimeout(function(){ location.href = redirectTo; }, 1200); }
        else { setTimeout(hideOverlay, 1200); }
      }
    }, { once:true });
  }, true);
})();
/* TPL: FIN BLOQUE NUEVO */
