/* TPL: INICIO BLOQUE NUEVO [tpl-navbar.js — RESCATE SIMPLE y ESTABLE] */
(function(){
  // 👉 Ajusta esta ruta si tu perfil se llama distinto
  var PROFILE_URL = 'perfil.html'; // TPL: CAMBIO (antes: 'mi-perfil.html')

  // TPL: INICIO BLOQUE NUEVO [Rutas y correo admin → solo panel para ti]
  var PANEL_URL = 'tpl-candidaturas-admin.html';
  // OJO: escribe aquí tu correo **exacto**; lo normalizamos para tildes y mayúsculas.
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


/* TPL: INICIO BLOQUE NUEVO [Router EmailJS — Aviso automático para TODOS los formularios] */
(function(){
  // ======= CONFIGURA AQUÍ TUS IDS DE EMAILJS =======
  // 1) Entra en EmailJS y copia tu Public Key, Service ID y los Template IDs.
  var EMAILJS_CONFIG = {
    enabled: true, // pon false para desactivar globalmente
    publicKey: 'TU_PUBLIC_KEY_AQUI',       // <-- CAMBIA
    serviceId: 'TU_SERVICE_ID_AQUI',       // <-- CAMBIA
    templates: {
      // Plantillas opcionales por tipo; si no hay match, usa "default"
      default: 'TEMPLATE_ID_GENERICO',     // <-- CAMBIA (crea una plantilla genérica)
      candidatura: 'TEMPLATE_ID_CANDIDATURA', // opcional
      reserva: 'TEMPLATE_ID_RESERVA',         // opcional
      contacto: 'TEMPLATE_ID_CONTACTO'        // opcional
    },
    // Email de destino por defecto (en tu plantilla puedes usar {{to_email}} si quieres)
    toEmail: 'gestion@thepetslovers.es'
  };

  if (!EMAILJS_CONFIG.enabled) return;

  // Cargar SDK EmailJS en caliente (1 vez)
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

  // Serializador de formularios → objeto plano
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

    // Campos “típicos” para Reply-To si existen
    var emailField = form.querySelector('[name=email], [name=correo], [type=email]');
    if (emailField && emailField.value) data.reply_to = emailField.value;

    var nameField = form.querySelector('[name=nombre], [name=name]');
    if (nameField && nameField.value) data.from_name = nameField.value;

    return data;
  }

  // Tabla HTML bonita con los campos (para la plantilla genérica)
  function buildTableHTML(obj){
    var rows = Object.keys(obj).filter(function(k){
      return k.indexOf('__')!==0 && k!=='to_email' && k!=='reply_to' && k!=='from_name';
    }).map(function(k){
      var val = String(obj[k]).replace(/</g,'&lt;').replace(/>/g,'&gt;');
      return '<tr><td style="padding:6px 10px;border:1px solid #eee;"><b>'+k+'</b></td><td style="padding:6px 10px;border:1px solid #eee;">'+val+'</td></tr>';
    }).join('');
    return '<table style="border-collapse:collapse;border:1px solid #eee;font-family:system-ui,Segoe UI,Roboto,Arial;font-size:14px">'+rows+'</table>';
  }

  // Envío “en paralelo” sin romper el flujo del formulario
  function sendEmailForForm(form){
    if (!window.emailjs) return;
    var type = form.getAttribute('data-tpl-type') || 'default'; // opcional
    var templateId = EMAILJS_CONFIG.templates[type] || EMAILJS_CONFIG.templates.default;

    var params = collectFormData(form);
    // Para plantilla genérica, añadimos un HTML completo con todos los campos
    params.table_html = buildTableHTML(params);
    params.subject = (type==='candidatura' ? 'Nueva candidatura' :
                     (type==='reserva' ? 'Nueva reserva' :
                     (type==='contacto' ? 'Nuevo contacto' : 'Nuevo formulario'))) + ' · ' + (params.from_name || '');

    // No bloqueamos el submit original
    emailjs.send(EMAILJS_CONFIG.serviceId, templateId, params)
      .then(function(){ /* ok, silencioso */ })
      .catch(function(){ /* silencioso */ });
  }

  // Enganche global: se dispara en TODOS los formularios
  function onAnyFormSubmit(ev){
    var form = ev.target;
    if (!form || form.nodeName!=='FORM') return;
    // Opt-out por formulario
    if (form.hasAttribute('data-tpl-no-emailjs')) return;
    try{
      sendEmailForForm(form);
    }catch(e){ /* silencioso */ }
    // IMPORTANTE: NO hacemos preventDefault, para no romper tu lógica
  }

  // Arranque
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
