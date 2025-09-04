/* TPL: INICIO BLOQUE NUEVO [tpl-navbar.js — RESCATE SIMPLE y ESTABLE] */
(function(){
  // 👉 Ajusta esta ruta si tu perfil se llama distinto
  var PROFILE_URL = 'perfil.html'; // TPL: CAMBIO (antes: 'mi-perfil.html')

  // TPL: INICIO BLOQUE NUEVO [Rutas y correo admin → solo panel para ti]
  var PANEL_URL = 'tpl-candidaturas-admin.html';
  // OJO: escribe aquí tu correo **exacto**; lo normalizamos para tildes/acentos y mayúsculas.
  var ADMIN_EMAILS = ['4b.jenny.gomez@gmail.com'];
  function tplNormalizeEmail(e){
    return String(e||'')
      .trim()
      .toLowerCase()
      .normalize('NFD').replace(/[\u0300-\u036f]/g,''); // quita tildes/acentos
  }
  var ADMIN_SET = new Set(ADMIN_EMAILS.map(tplNormalizeEmail));
  function isAdminEmail(email){
    return ADMIN_SET.has(tplNormalizeEmail(email));
  }

  // 🔧 NUEVO: primero intento leer un cache propio del email (tplEmail),
  // si no existe, caigo al objeto de Firebase en localStorage.
  function getCurrentEmailFromFirebaseStorage(){
    try{
      var cached = localStorage.getItem('tplEmail');
      if (cached) return String(cached);
    }catch(e){}

    try{
      for(var i=0;i<localStorage.length;i++){
        var k = localStorage.key(i);
        if(k && k.indexOf('firebase:authUser:')===0){
          var v = localStorage.getItem(k);
          if(!v) continue;
          var obj = JSON.parse(v);
          if(obj && obj.email){
            // cacheo para futuras páginas sin Firebase
            try{ localStorage.setItem('tplEmail', String(obj.email)); }catch(e){}
            return String(obj.email);
          }
        }
      }
    }catch(e){}
    return '';
  }
  // TPL: FIN BLOQUE NUEVO

  // --- HTML del navbar (igual que Index, con “¿Necesitas ayuda?”)
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

  // --- Montaje: crea #tpl-navbar si no existe y pinta la barra
  function mountNavbar(){
    try{
      // Evita duplicar si la página ya trae una .navbar en el HTML
      if (document.querySelector('.navbar')) {
        applySessionUI();
        markActiveLink();
        return;
      }
      var host = document.getElementById('tpl-navbar');
      if(!host){
        host = document.createElement('div');
        host.id = 'tpl-navbar';
        document.body.insertBefore(host, document.body.firstChild || null);
      }
      host.innerHTML = NAV_HTML;
      markActiveLink();
      applySessionUI(); // pinta “Mi perfil/Panel” si ya estabas logueada
    }catch(e){ console.error('TPL navbar mount error:', e); }
  }

  // --- Marca el enlace activo con aria-current
  function markActiveLink(){
    try{
      var here = (location.pathname.split('/').pop() || 'index.html').toLowerCase();
      var nodes = document.querySelectorAll('.navbar a[href]');
      for(var i=0;i<nodes.length;i++){
        var a = nodes[i];
        var f = (a.getAttribute('href')||'').split('#')[0].toLowerCase();
        if(f && f === here){ a.setAttribute('aria-current','page'); }
      }
    }catch(e){}
  }

  // --- Heurística de sesión (sin romper si no hay Firebase)
  function isLoggedIn(){
    try{
      // 1) Firebase guarda el usuario en localStorage con claves “firebase:authUser:…”
      for(var i=0;i<localStorage.length;i++){
        var k = localStorage.key(i);
        if(k && k.indexOf('firebase:authUser:')===0){
          var v = localStorage.getItem(k);
          if(v && v.indexOf('"uid":') !== -1) return true;
        }
      }
      // 2) Flag propio por si tu login lo usa
      if(localStorage.getItem('tplAuth')==='1') return true;
    }catch(e){}
    return false;
  }

  // --- Oculta cualquier “Cerrar sesión” que pueda haber
  function hideLogoutEverywhere(){
    try{
      var elems = [].slice.call(document.querySelectorAll(
        '[data-action="logout"], .logout-button, a[href*="logout"], button[href*="logout"]'
      ));
      // también por texto
      [].slice.call(document.querySelectorAll('.navbar a, .navbar button')).forEach(function(el){
        var t=(el.textContent||'').trim().toLowerCase();
        if(t==='cerrar sesión'||t==='cerrar sesion'||t.indexOf('logout')>-1||t.indexOf('sign out')>-1){
          elems.push(el);
        }
      });
      elems.forEach(function(el){ el.style.display='none'; el.setAttribute('aria-hidden','true'); });
    }catch(e){}
  }

  // --- Aplica el estado al botón derecho
  function setLoginButton(logged){
    try{
      var btn = document.querySelector('.navbar .login-button');
      if(!btn) return;

      if(logged){
        // Decidir destino según si eres admin
        var email = getCurrentEmailFromFirebaseStorage();
        var isAdmin = isAdminEmail(email);
        var dest = isAdmin ? PANEL_URL : PROFILE_URL;
        var label = isAdmin ? 'Panel' : 'Mi perfil';
        btn.textContent = label;
        btn.setAttribute('href', dest);
        btn.setAttribute('aria-label','Ir a ' + label.toLowerCase());
      }else{
        btn.textContent = 'Iniciar sesión';
        btn.setAttribute('href', 'iniciar-sesion.html');
        btn.setAttribute('aria-label','Iniciar sesión');
      }
    }catch(e){}
  }

  function applySessionUI(){
    hideLogoutEverywhere();
    setLoginButton(isLoggedIn());

    // Si hay Firebase en la página, nos sincronizamos en tiempo real SIN romper nada
    try{
      if(window.firebase && firebase.auth){
        var a = firebase.auth();
        a.onAuthStateChanged(function(u){
          // 🔧 NUEVO: cachear/limpiar tplEmail cuando haya Firebase
          try{
            if(u && u.email){ localStorage.setItem('tplEmail', String(u.email)); }
            else { localStorage.removeItem('tplEmail'); }
          }catch(e){}
          setLoginButton(!!u);
          hideLogoutEverywhere();
          try{
            if(u){ localStorage.setItem('tplAuth','1'); }
            else { localStorage.removeItem('tplAuth'); }
          }catch(e){}
        });
      }else{
        // 🔧 NUEVO: si no hay Firebase, intenta “autocompletar” tplEmail una vez
        try{
          var email = getCurrentEmailFromFirebaseStorage();
          if(email){ localStorage.setItem('tplEmail', String(email)); }
        }catch(e){}
      }
    }catch(e){}
  }

  // --- Arranque (defer hace que el DOM ya esté listo)
  if(document.readyState==='loading'){
    document.addEventListener('DOMContentLoaded', mountNavbar);
  }else{
    mountNavbar();
  }
})();
/* TPL: FIN BLOQUE NUEVO */


/* TPL: INICIO BLOQUE NUEVO [Tracking de visitas centralizado — JS puro, sin <script>] */
(function(){
  // Permitir desactivar tracking en páginas concretas (ej. admin) añadiendo: <body data-tpl-no-track>
  if (document.body && document.body.hasAttribute('data-tpl-no-track')) return;

  // Evitar doble ejecución si navbar y footer se cargan a la vez
  if (window.__tplTracked) return; window.__tplTracked = true;

  // 1) Cargar Firebase si no existe (ligero y solo una vez)
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

  // 2) Registrar la visita (colección 'visitas' con doc por día)
  async function trackVisit(){
    try{
      await ensureFirebase();
      if (!window.firebase || !firebase.firestore) return;
      var db = firebase.firestore();
      var now = new Date();
      var y = now.getFullYear();
      var m = String(now.getMonth()+1).padStart(2,'0');
      var d = String(now.getDate()).padStart(2,'0');
      var ymd = y + '-' + m + '-' + d;
      await db.collection('visitas').doc(ymd).set({
        date: ymd,
        createdAt: firebase.firestore.FieldValue.serverTimestamp(),
        count: firebase.firestore.FieldValue.increment(1)
      }, { merge:true });
    }catch(e){
      // silencioso
    }
  }

  // 3) Lanzarlo cuando la página está lista
  if (document.readyState === 'loading'){
    document.addEventListener('DOMContentLoaded', trackVisit, { once:true });
  } else {
    trackVisit();
  }
})();
/* TPL: FIN BLOQUE NUEVO */


/* TPL: INICIO BLOQUE NUEVO [Router EmailJS — Aviso automático + Unificación por Prefijos y por Grupo] */
(function(){
  // ======= CONFIGURA AQUÍ TUS IDS DE EMAILJS =======
  var EMAILJS_CONFIG = {
    enabled: true, // pon false para desactivar globalmente
    publicKey: 'L2xAATfVuHJwj4EIV',       // ✅ tu Public Key
    serviceId: 'service_odjqrfl',         // ✅ tu Service ID
    templates: {
      // Plantillas opcionales por tipo; si no hay match, usa "default"
      default: 'template_wmz159o',        // ✅ tu Template ID genérica
      candidatura: 'TEMPLATE_ID_CANDIDATURA', // opcional (si la creas)
      reserva: 'TEMPLATE_ID_RESERVA',         // opcional (si la creas)
      contacto: 'TEMPLATE_ID_CONTACTO',       // opcional (si la creas)
      perfil: 'template_wmz159o'              // reutilizamos la genérica
    },
    // Email de destino por defecto (en tu plantilla puedes usar {{to_email}} si quieres)
    toEmail: 'gestion@thepetslovers.es'
  };
  if (!EMAILJS_CONFIG.enabled) return;

  // Exponer config para otras páginas que necesiten EmailJS directo
  window.__TPL_EMAILJS = {
    publicKey: EMAILJS_CONFIG.publicKey,
    serviceId: EMAILJS_CONFIG.serviceId,
    templateDefault: EMAILJS_CONFIG.templates.default,
    toEmail: EMAILJS_CONFIG.toEmail
  };

  // --- Constantes de unificación ---
  // A) Unificación por prefijo (no hace falta tocar tus forms si ya usas estos names)
  var OWNER_PREFIX = 'owner_';
  var PET_PREFIX   = 'pet_';
  var LS_OWNER = 'TPL_OWNER_DATA';
  var LS_PET   = 'TPL_PET_DATA';

  // B) Unificación por grupo (data-tpl-type="perfil", data-tpl-group="propietario"/"mascota")
  // Guardamos cada mitad bajo una clave de sesión (p.ej. PERFIL: propietario/mascota)
  function groupKey(form){
    var type  = (form.getAttribute('data-tpl-type')||'').trim().toLowerCase();
    var group = (form.getAttribute('data-tpl-group')||'').trim().toLowerCase();
    return type ? ('TPL_GROUP_'+type) : '';
  }
  function subgroup(form){
    return (form.getAttribute('data-tpl-group')||'').trim().toLowerCase();
  }

  // --- Cargar SDK EmailJS (una vez) ---
  function loadScript(src){
    return new Promise(function(res,rej){
      var s=document.createElement('script'); s.src=src; s.onload=res; s.onerror=rej; document.head.appendChild(s);
    });
  }
  function initEmailJS(){
    if (window.emailjs && emailjs.init) {
      try{ emailjs.init(EMAILJS_CONFIG.publicKey); }catch(e){}
      return Promise.resolve();
    }
    return loadScript('https://cdn.jsdelivr.net/npm/emailjs-com@3/dist/email.min.js')
      .then(function(){
        try{ emailjs.init(EMAILJS_CONFIG.publicKey); }catch(e){}
      });
  }

  // --- Utilidades comunes ---
  function collectFormData(form){
    var data = {};
    var els = form.querySelectorAll('input, select, textarea');
    for (var i=0; i<els.length; i++){
      var el = els[i];
      if (!el.name) continue;
      if (el.type === 'checkbox') {
        data[el.name] = el.checked ? 'Sí' : 'No';
      } else if (el.type === 'radio') {
        if (el.checked) data[el.name] = el.value;
      } else {
        data[el.name] = el.value || '';
      }
    }
    // Extras útiles
    data.__page_title = document.title || '';
    data.__page_url   = location.href;
    data.__form_id    = form.id || '';
    data.__form_name  = form.getAttribute('name') || '';
    data.__sent_at    = new Date().toISOString();
    data.to_email     = EMAILJS_CONFIG.toEmail;

    // Campos “típicos”
    var emailField = form.querySelector('[name=email], [name=correo], [type=email]');
    if (emailField && emailField.value) data.reply_to = emailField.value;

    var nameField = form.querySelector('[name=nombre], [name=name]');
    if (nameField && nameField.value) data.from_name = nameField.value;

    return data;
  }
  function buildTableHTML(obj){
    var rows = Object.keys(obj).filter(function(k){
      return k.indexOf('__')!==0 && k!=='to_email' && k!=='reply_to' && k!=='from_name' && k!=='table_html' && k!=='subject';
    }).map(function(k){
      var val = String(obj[k]).replace(/</g,'&lt;').replace(/>/g,'&gt;');
      return '<tr><td style="padding:6px 10px;border:1px solid #eee;"><b>'+k+'</b></td><td style="padding:6px 10px;border:1px solid #eee;">'+val+'</td></tr>';
    }).join('');
    return '<table style="border-collapse:collapse;border:1px solid #eee;font-family:system-ui,Segoe UI,Roboto,Arial;font-size:14px">'+rows+'</table>';
  }
  function hasPrefix(obj, prefix){
    for (var k in obj){ if (Object.prototype.hasOwnProperty.call(obj,k) && k.indexOf(prefix)===0) return true; }
    return false;
  }
  function pick(obj, prefix){
    var r={}; for (var k in obj){ if (k.indexOf(prefix)===0) r[k]=obj[k]; } return r;
  }
  function saveLS(key, val){ try{ localStorage.setItem(key, JSON.stringify(val||{})); }catch(e){} }
  function loadLS(key){ try{ return JSON.parse(localStorage.getItem(key)||'{}'); }catch(e){ return {}; } }
  function clearLS(key){ try{ localStorage.removeItem(key); }catch(e){} }
  function clearOP(){ clearLS(LS_OWNER); clearLS(LS_PET); }

  // --- EmailJS send ---
  function sendEmail(type, params){
    var templateId = EMAILJS_CONFIG.templates[type] || EMAILJS_CONFIG.templates.default;
    params.table_html = buildTableHTML(params);
    var base = (type==='candidatura' ? 'Nueva candidatura' :
                type==='reserva'     ? 'Nueva reserva'     :
                type==='contacto'    ? 'Nuevo contacto'    :
                type==='perfil'      ? 'Nuevo perfil'      :
                'Nuevo formulario');
    params.subject = base + (params.from_name ? (' · ' + params.from_name) : '');
    return emailjs.send(EMAILJS_CONFIG.serviceId, templateId, params);
  }

  // --- Unificación por PREFIJOS (owner_ / pet_) ---
  function tryUnifiedSendByPrefix(currentParams){
    var isOwner = hasPrefix(currentParams, OWNER_PREFIX);
    var isPet   = hasPrefix(currentParams, PET_PREFIX);
    var ownerLS = loadLS(LS_OWNER), petLS = loadLS(LS_PET);

    // Guarda mitad actual
    if (isOwner) saveLS(LS_OWNER, pick(currentParams, OWNER_PREFIX));
    if (isPet)   saveLS(LS_PET,   pick(currentParams, PET_PREFIX));

    // ¿Tenemos ambas?
    ownerLS = loadLS(LS_OWNER); petLS = loadLS(LS_PET);
    var haveBoth = Object.keys(ownerLS).length && Object.keys(petLS).length;
    if (!haveBoth) return false;

    // Mezclar y enviar 1 correo
    var merged = {};
    for (var k in currentParams){ merged[k]=currentParams[k]; }
    for (var k2 in ownerLS){ merged[k2]=ownerLS[k2]; }
    for (var k3 in petLS){ merged[k3]=petLS[k3]; }
    merged.unified_info = 'Propietario + Mascota (unificado por prefijos)';
    clearOP();
    sendEmail('perfil', merged).catch(function(){});
    return true;
  }

  // --- Unificación por GRUPO (data-tpl-type="perfil", data-tpl-group="propietario|mascota") ---
  function tryUnifiedSendByGroup(form, currentParams){
    var gKey = groupKey(form);
    var sub  = subgroup(form); // 'propietario' | 'mascota'
    if (!gKey || !sub) return false;

    // Persistimos la mitad actual
    var cacheAll = loadLS(gKey);
    cacheAll[sub] = currentParams;
    saveLS(gKey, cacheAll);

    // ¿Están ambas?
    var haveOwner = !!cacheAll.propietario;
    var havePet   = !!cacheAll.mascota;
    if (!(haveOwner && havePet)) return false;

    // Mezclamos y enviamos 1 correo
    var merged = {};
    var owner = cacheAll.propietario || {};
    var pet   = cacheAll.mascota     || {};
    for (var k in owner){ merged['owner_'+k] = owner[k]; }
    for (var k2 in pet){ merged['pet_'+k2] = pet[k2]; }

    // Añadimos también el contexto de la página actual
    for (var k3 in currentParams){ if (!merged.hasOwnProperty(k3)) merged[k3]=currentParams[k3]; }

    merged.unified_info = 'Propietario + Mascota (unificado por grupo)';
    clearLS(gKey);
    sendEmail('perfil', merged).catch(function(){});
    return true;
  }

  // --- Enganche global: se dispara en TODOS los formularios (sin impedir el submit nativo) ---
  function onAnyFormSubmit(ev){
    var form = ev.target;
    if (!form || form.nodeName!=='FORM') return;

    // Opt-out por formulario
    if (form.hasAttribute('data-tpl-no-emailjs')) return;

    try{
      var type = (form.getAttribute('data-tpl-type') || 'default').toLowerCase();
      var params = collectFormData(form);

      // 1) Intento unificación por GRUPO (si es un perfil con data-tpl-group)
      var unifiedByGroup = false;
      var t = (form.getAttribute('data-tpl-type')||'').toLowerCase();
      if (t === 'perfil' && subgroup(form)){
        unifiedByGroup = tryUnifiedSendByGroup(form, params);
        if (unifiedByGroup) return; // ya se enviará cuando estén ambas partes
      }

      // 2) Intento unificación por PREFIJOS (si los campos usan owner_/pet_)
      var unifiedByPrefix = tryUnifiedSendByPrefix(params);
      if (unifiedByPrefix) return; // ya enviado combinado

      // 3) Si no hay unificación, envío normal
      sendEmail(type, params).catch(function(){});
    }catch(e){}

    // IMPORTANTE: NO hacemos preventDefault → no rompemos tu lógica ni redirecciones nativas
  }

  // --- Arranque
  function boot(){
    initEmailJS().then(function(){
      document.addEventListener('submit', onAnyFormSubmit, true);
    });
  }
  if (document.readyState === 'loading'){
    document.addEventListener('DOMContentLoaded', boot, { once:true });
  } else {
    boot();
  }
})();
/* TPL: FIN BLOQUE NUEVO */


/* TPL: INICIO BLOQUE NUEVO [UX formularios — feedback y redirección optimista] */
(function(){
  // Crea (una vez) el overlay reutilizable
  function ensureOverlay(){
    var ex = document.getElementById('tpl-form-overlay');
    if (ex) return ex;
    var wrap = document.createElement('div');
    wrap.id = 'tpl-form-overlay';
    wrap.className = 'tpl-form-overlay';
    wrap.innerHTML = '<div class="tpl-form-card" role="alertdialog" aria-live="polite" aria-label="Estado del envío">'
      + '<div class="tpl-form-spinner" aria-hidden="true"></div>'
      + '<h3 id="tpl-form-title">Enviando…</h3>'
      + '<p id="tpl-form-msg" class="muted">No cierres esta ventana.</p>'
      + '</div>';
    document.body.appendChild(wrap);
    return wrap;
  }

  function showOverlay(title, msg){
    var o = ensureOverlay();
    o.querySelector('#tpl-form-title').textContent = title || 'Enviando…';
    o.querySelector('#tpl-form-msg').textContent = msg || 'Subiendo archivos (si aplica) y guardando datos. Puede tardar unos segundos.';
    o.classList.add('show');
  }
  function showSuccess(msg){
    var o = ensureOverlay();
    o.querySelector('.tpl-form-spinner').style.display = 'none';
    o.querySelector('#tpl-form-title').textContent = '✅ ¡Listo!';
    o.querySelector('#tpl-form-msg').textContent = msg || 'Tu solicitud se ha enviado correctamente.';
    o.classList.add('show');
  }
  function hideOverlay(){
    var o = document.getElementById('tpl-form-overlay');
    if (!o) return;
    o.classList.remove('show');
    var sp = o.querySelector('.tpl-form-spinner');
    if (sp) sp.style.display = ''; // re-activar para el próximo envío
  }

  // Interceptamos el submit SOLO para UX (no preventDefault): feedback inmediato
  document.addEventListener('submit', function(ev){
    var form = ev.target;
    if (!form || form.nodeName !== 'FORM') return;

    // ¿Tiene mensaje de éxito personalizado? (si no, no hacemos nada)
    var successMsg = form.getAttribute('data-tpl-success');
    if (!successMsg) return;

    // Desactivar botones mientras sube
    var btns = form.querySelectorAll('button, [type=submit]');
    btns.forEach(function(b){ b.disabled = true; b.dataset._tplText = b.textContent; b.textContent = 'Enviando…'; });

    // Mostrar overlay "Enviando…"
    showOverlay('Enviando…');

    // --- REDIRECCIÓN POR DEFECTO SEGÚN TIPO (lo que me pediste) ---
    var typeAttr = (form.getAttribute('data-tpl-type')||'').toLowerCase();
    var redirectToAttr = form.getAttribute('data-tpl-redirect');
    // Si el formulario NO define data-tpl-redirect, aplico:
    // - candidatura  → index.html
    // - cualquier otro con data-tpl-type → perfil.html
    var redirectTo = redirectToAttr || (typeAttr ? (typeAttr==='candidatura' ? 'index.html' : 'perfil.html') : '');

    // Estrategia "optimista": si en X segundos no ha navegado la página,
    // mostramos el OK y redirigimos si está configurado.
    var waitMs = parseInt(form.getAttribute('data-tpl-wait')||'12000', 10); // 12s por defecto

    // Si la página realmente navega (envío tradicional), el overlay se va solo.
    var unloaded = false;
    window.addEventListener('beforeunload', function(){ unloaded = true; }, { once:true });

    setTimeout(function(){
      if (unloaded) return; // la página ya cambió
      // Mostramos éxito
      showSuccess(successMsg);
      // Rehabilitamos botones por si no hay redirección
      btns.forEach(function(b){ b.disabled = false; if (b.dataset._tplText) b.textContent = b.dataset._tplText; });

      // Redirección opcional tras 2.2s
      if (redirectTo){
        setTimeout(function(){ location.href = redirectTo; }, 2200);
      } else {
        // Si no hay redirección, ocultamos overlay tras 2.2s
        setTimeout(hideOverlay, 2200);
      }
    }, waitMs);

    // Si tu código de envío invoca form.reset() cuando termina, capturamos para adelantar el OK
    form.addEventListener('reset', function(){
      showSuccess(successMsg);
      setTimeout(function(){
        hideOverlay();
        if (redirectTo) location.href = redirectTo;
      }, 1200);
    }, { once:true });
  }, true);
})();
/* TPL: FIN BLOQUE NUEVO */
