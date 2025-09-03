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
<!-- TPL: INICIO BLOQUE NUEVO [Tracking de visitas centralizado] -->
<script>
// Si este archivo ya está en todas las páginas, no necesitas tocar cada HTML.
// Añade este bloque al FINAL de tpl-navbar.js (o tpl-footer.js si lo cargas en todas).
(function(){
  // Permitir desactivar tracking en páginas concretas (ej. admin) añadiendo: <body data-tpl-no-track>
  if (document.body && document.body.hasAttribute('data-tpl-no-track')) return;

  // Evitar doble ejecución
  if (window.__tplTracked) return; window.__tplTracked = true;

  // 1) Cargar Firebase si no existe (ligero y solo una vez)
  function loadScript(src){ return new Promise((res,rej)=>{ const s=document.createElement('script'); s.src=src; s.onload=res; s.onerror=rej; document.head.appendChild(s); }); }
  async function ensureFirebase(){
    if (window.firebase && firebase.apps && firebase.apps.length) return;
    if (!window.firebase){
      await loadScript('https://www.gstatic.com/firebasejs/10.12.5/firebase-app-compat.js');
      await loadScript('https://www.gstatic.com/firebasejs/10.12.5/firebase-firestore-compat.js');
    }else if (!firebase.firestore){
      await loadScript('https://www.gstatic.com/firebasejs/10.12.5/firebase-firestore-compat.js');
    }
    if (!firebase.apps.length){
      // Usa tu mismo config del proyecto
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
      const db = firebase.firestore();
      const now = new Date();
      const y = now.getFullYear();
      const m = String(now.getMonth()+1).padStart(2,'0');
      const d = String(now.getDate()).padStart(2,'0');
      const ymd = `${y}-${m}-${d}`;
      await db.collection('visitas').doc(ymd).set({
        date: ymd,
        createdAt: firebase.firestore.FieldValue.serverTimestamp(),
        count: firebase.firestore.FieldValue.increment(1)
      }, { merge:true });
    }catch(e){
      // Silencioso: no queremos romper nada si falla
      // console.warn('Tracking visitas falló', e);
    }
  }

  // 3) Lanzarlo cuando la página está lista
  if (document.readyState === 'loading'){
    document.addEventListener('DOMContentLoaded', trackVisit, { once:true });
  } else {
    trackVisit();
  }
})();
</script>
<!-- TPL: FIN BLOQUE NUEVO -->
