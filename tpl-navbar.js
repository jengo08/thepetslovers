/* TPL: INICIO BLOQUE NUEVO [Guard HOME sin redirecciones] */
(function(){
  // Si estamos en HOME o en modo seguro, otros scripts pueden leer esta señal para NO redirigir.
  const ON_HOME = (window.__TPL_ON_HOME__ === true) ||
                  /(\/|^)index\.html?$/.test(location.pathname) || location.pathname === '/';
  const SAFE = window.__TPL_SAFE_MODE__ === true;
  if (ON_HOME || SAFE) {
    window.__TPL_NAVBAR_NO_REDIRECTS__ = true;
  }
})();
/* TPL: FIN BLOQUE NUEVO */

/* TPL Navbar — estable, idempotente y sin bucles */
(function(){
  if (window.__TPL_NAVBAR_RUNNING__) return;
  window.__TPL_NAVBAR_RUNNING__ = true;

  // ========= CONFIG =========
  /* TPL: INICIO BLOQUE NUEVO [Config dinámica: admite overrides globales y asegura admin oficial] */
  // Si en alguna página has definido window.TPL_ADMIN_EMAILS, lo respetamos.
  // Aseguramos que 'gestion@thepetslovers.es' SIEMPRE esté incluido.
  var ADMIN_EMAILS = Array.isArray(window.TPL_ADMIN_EMAILS) ? window.TPL_ADMIN_EMAILS.slice() : [];
  if (ADMIN_EMAILS.indexOf('gestion@thepetslovers.es') === -1) ADMIN_EMAILS.push('gestion@thepetslovers.es');

  // URLs: admiten override global
  var PANEL_URL    = window.TPL_PANEL_URL   || 'tpl-candidaturas-admin.html';   // tu panel
  var PROFILE_URL  = window.TPL_PROFILE_URL || 'perfil.html';                   // para usuarios
  /* TPL: FIN BLOQUE NUEVO */

  // ========= HELPERS =========
  function normEmail(s){
    return String(s||'').trim().toLowerCase()
      .normalize('NFD').replace(/[\u0300-\u036f]/g,'');
  }
  var ADMIN_SET = new Set(ADMIN_EMAILS.map(normEmail));
  function isAdminEmail(email){ return ADMIN_SET.has(normEmail(email)); }
  var IS_HOME = /(\/|^)index\.html?$/.test(location.pathname) || location.pathname === '/';

  function htmlNavbar(){
    return [
      '<nav class="navbar">',
        '<div class="logo">',
          '<a href="index.html"><img src="images/logo.png.png" alt="The Pets Lovers"></a>',
        '</div>',
        '<a href="index.html" class="home-button">Inicio</a>',
        '<ul class="nav-links">',
          '<li><a href="como-funciona.html">Cómo funciona</a></li>',
          '<li><a href="servicios.html">Servicios</a></li>',
          '<li><a href="trabaja-con-nosotros.html">Conviértete en cuidador</a></li>',
          '<li><a href="ayuda.html">¿Necesitas ayuda?</a></li>',
        '</ul>',
        '<a id="tpl-login-link" class="login-button" href="iniciar-sesion.html?next=perfil.html">Iniciar sesión</a>',
      '</nav>'
    ].join('');
  }

  function injectNavbarOnce(){
    var host = document.getElementById('tpl-navbar');
    var html = htmlNavbar();
    if (host){
      if (host.innerHTML.trim() !== html) host.innerHTML = html;
    } else {
      var wrap = document.createElement('div');
      wrap.id = 'tpl-navbar';
      wrap.innerHTML = html;
      document.body.insertBefore(wrap, document.body.firstChild);
    }
  }

  function setBtn(text, href){
    var a = document.getElementById('tpl-login-link');
    if (!a) return;
    if (a.textContent.trim() !== text) a.textContent = text;
    if (a.getAttribute('href') !== href) a.setAttribute('href', href);
  }
  function setDefaultBtn(){ setBtn('Iniciar sesión','iniciar-sesion.html?next='+encodeURIComponent(PROFILE_URL)); }

  /* TPL: INICIO BLOQUE NUEVO [Puente ligero de sesión → localStorage + evento] */
  function syncStorageFromUser(user){
    try{
      if (user && !user.isAnonymous && user.email){
        localStorage.setItem('tpl_auth_email', user.email || '');
        localStorage.setItem('tpl_auth_uid',   user.uid   || '');
        document.body && document.body.setAttribute('data-auth','in');
      } else {
        localStorage.removeItem('tpl_auth_email');
        localStorage.removeItem('tpl_auth_uid');
        document.body && document.body.setAttribute('data-auth','out');
      }
      window.dispatchEvent(new CustomEvent('tpl-auth-change', { detail:{ email: (user && user.email) || null } }));
    }catch(_){}
  }
  function getStoredEmail(){
    try{ return localStorage.getItem('tpl_auth_email'); }catch(_){ return null; }
  }
  function renderFromStoredEmail(){
    var e = getStoredEmail();
    if (!e){ setDefaultBtn(); return; }
    if (isAdminEmail(e)) setBtn('Mi panel', PANEL_URL);
    else setBtn('Mi perfil', PROFILE_URL);
  }
  /* TPL: FIN BLOQUE NUEVO */

  function updateBtn(user){
    // Mantengo tu lógica original
    if (!user || user.isAnonymous){
      setDefaultBtn();
      /* TPL: INICIO BLOQUE NUEVO [Sin sesión → limpiar storage] */
      syncStorageFromUser(null);
      /* TPL: FIN BLOQUE NUEVO */
      return;
    }
    /* TPL: INICIO BLOQUE NUEVO [Con sesión → sincronizar storage] */
    syncStorageFromUser(user);
    /* TPL: FIN BLOQUE NUEVO */

    var admin = isAdminEmail(user.email);
    if (admin){ setBtn('Mi panel', PANEL_URL); }
    else { setBtn('Mi perfil', PROFILE_URL); }
  }

  function loadOnce(src){
    return new Promise(function(res, rej){
      var already = Array.prototype.some.call(document.scripts, function(s){ return s.src === src; });
      if (already) return res();
      var el = document.createElement('script');
      el.src = src; el.defer = true;
      el.onload = res; el.onerror = rej;
      document.head.appendChild(el);
    });
  }

  // ⬇️⬇️ FIX 1: solo retornar si TAMBIÉN existe firebase.auth
  async function ensureFirebase(){
    if (typeof firebase !== 'undefined' && firebase.app && firebase.auth) return;
    await loadOnce('https://www.gstatic.com/firebasejs/10.12.5/firebase-app-compat.js');
    await loadOnce('https://www.gstatic.com/firebasejs/10.12.5/firebase-auth-compat.js');
    // (opcional, se dejan por compatibilidad con el resto del archivo)
    await loadOnce('https://www.gstatic.com/firebasejs/10.12.5/firebase-firestore-compat.js');
    await loadOnce('https://www.gstatic.com/firebasejs/10.12.5/firebase-storage-compat.js');
  }

  function initFirebase(){
    if (typeof firebase === 'undefined') return null;
    var cfg = window.TPL_FIREBASE_CONFIG || {
      apiKey:"AIzaSyDW73aFuz2AFS9VeWg_linHIRJYN4YMgTk",
      authDomain:"thepetslovers-c1111.firebaseapp.com",
      projectId:"thepetslovers-c1111",
      storageBucket:"thepetslovers-c1111.appspot.com",
      messagingSenderId:"415914577533",
      appId:"1:415914577533:web:0b7a056ebaa4f1de28ab14",
      measurementId:"G-FXPD69KXBG"
    };
    if (firebase.apps.length === 0){
      try{ firebase.initializeApp(cfg); }catch(_){}
    }
    return firebase.auth ? firebase.auth() : null;
  }

  function start(){
    injectNavbarOnce();
    setDefaultBtn();

    /* TPL: INICIO BLOQUE NUEVO [Pintado inmediato según localStorage] */
    // Si vienes ya logueada de otra página, el botón cambia sin esperar a Firebase.
    renderFromStoredEmail();
    /* TPL: FIN BLOQUE NUEVO */

    (async function(){
      try{
        await ensureFirebase();
        var auth = initFirebase();
        if (!auth) return;

        // Estado inicial
        updateBtn(auth.currentUser);

        // Cambios de sesión
        auth.onAuthStateChanged(function(u){
          updateBtn(u);
          if (IS_HOME && u && u.email && isAdminEmail(u.email)){
            setTimeout(function(){ setBtn('Mi panel', PANEL_URL); }, 300);
          }
        });

        // ⬇️⬇️ FIX 2: escuchar también cambios de token (casos de rehidratación lenta)
        if (auth.onIdTokenChanged){
          auth.onIdTokenChanged(function(u){ updateBtn(u); });
        }

        // Fallback tardío por si los scripts de Firebase tardan más en hidratar el usuario
        setTimeout(function(){
          if (!auth.currentUser) return;
          var a = document.getElementById('tpl-login-link');
          if (a && /iniciar sesión/i.test(a.textContent||'')){
            updateBtn(auth.currentUser);
          }
        }, 1200);

        /* TPL: INICIO BLOQUE NUEVO [Re-chequeo robusto + eventos de foco/visibilidad] */
        (function(){
          // Reintenta durante ~18s (60 intentos x 300ms) o hasta que vea usuario no anónimo
          var tries = 0;
          var iv = setInterval(function(){
            tries++;
            updateBtn(auth.currentUser);
            if ((auth.currentUser && !auth.currentUser.isAnonymous) || tries > 60){
              clearInterval(iv);
            }
          }, 300);

          // Al volver a la pestaña o ganar foco tras login con redirect/popups, refrescar botón
          window.addEventListener('visibilitychange', function(){
            if (!document.hidden) updateBtn(auth.currentUser);
          });
          window.addEventListener('focus', function(){
            updateBtn(auth.currentUser);
          });
        })();
        /* TPL: FIN BLOQUE NUEVO */

      }catch(_){}
    })();

    /* TPL: INICIO BLOQUE NUEVO [Escuchar cambios en localStorage desde otras páginas/pestañas] */
    window.addEventListener('storage', function(ev){
      if (!ev || (ev.key!=='tpl_auth_email' && ev.key!=='tpl_auth_uid')) return;
      renderFromStoredEmail();
    });
    /* TPL: FIN BLOQUE NUEVO */
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', start);
  } else {
    start();
  }
})();

/* ===========================
   TPL: INICIO BLOQUE NUEVO [EmailJS unificado + modal + progreso + subida condicionada a Firebase]
   =========================== */
(function(){
  'use strict';
  if (window.__TPL_EMAILJS_BOOTSTRAPPED) return;
  window.__TPL_EMAILJS_BOOTSTRAPPED = true;

  // 🔑 EmailJS
  const EMAILJS_PUBLIC_KEY = 'L2xAATfVuHJwj4EIV';
  const EMAILJS_SERVICE_ID = 'service_odjqrfl';
  const TEMPLATE_CANDIDATURAS_REGISTROS = 'template_32z2wj4';
  const TEMPLATE_RESERVAS = 'template_rao5n0c';

  const EMAILJS_URL = 'https://cdn.jsdelivr.net/npm/@emailjs/browser@4/dist/email.min.js';
  const STYLE_ID = 'tpl-feedback-modal-css';

  /* ===== UI (modales) ===== */
  function injectStyles(){
    if (document.getElementById(STYLE_ID)) return;
    const css = `
      .tpl-modal-backdrop{position:fixed;inset:0;background:rgba(0,0,0,.45);display:flex;align-items:center;justify-content:center;z-index:9999}
      .tpl-modal{background:#fff;border-radius:14px;max-width:520px;width:92%;box-shadow:0 10px 30px rgba(0,0,0,.2);padding:20px}
      .tpl-modal h3{margin:0 0 6px;color:var(--tpl-ink,#58425a);font-size:1.25rem}
      .tpl-modal p{margin:0 0 14px;color:#444}
      .tpl-modal .tpl-actions{display:flex;justify-content:flex-end;gap:10px;margin-top:12px}
      .tpl-btn{appearance:none;border:none;border-radius:999px;padding:10px 16px;font-weight:600;cursor:pointer}
      .tpl-btn--primary{background:var(--tpl-primary,#339496);color:#fff}
      .tpl-progress{display:flex;flex-direction:column;gap:8px}
      .tpl-bar{width:100%;height:8px;background:#eee;border-radius:999px;overflow:hidden}
      .tpl-bar > i{display:block;height:100%;width:0%}
      .tpl-bar > i::after{content:'';display:block;height:100%;width:100%;background:var(--tpl-primary,#339496)}
      .tpl-small{color:#666;font-size:.92rem}
    `;
    const style = document.createElement('style');
    style.id = STYLE_ID;
    style.textContent = css;
    document.head.appendChild(style);
  }

  function showModal({title='¡Listo!', message='Envío realizado correctamente.', ctaText='Aceptar', redirect}){
    injectStyles();
    const backdrop = document.createElement('div');
    backdrop.className='tpl-modal-backdrop';
    backdrop.innerHTML = `
      <div class="tpl-modal" role="dialog" aria-modal="true" aria-labelledby="tpl-modal-title">
        <h3 id="tpl-modal-title">${title}</h3>
        <p>${message}</p>
        <div class="tpl-actions">
          <button class="tpl-btn tpl-btn--primary">${ctaText}</button>
        </div>
      </div>
    `;
    document.body.appendChild(backdrop);
    const btn = backdrop.querySelector('.tpl-btn');
    const close = () => { backdrop.remove(); if (redirect) location.href = redirect; };
    btn.addEventListener('click', close);
    backdrop.addEventListener('click', e=>{ if(e.target===backdrop) close(); });
    document.addEventListener('keydown', function esc(e){ if(e.key==='Escape'){ document.removeEventListener('keydown', esc); close(); }});
    btn.focus();
  }

  // TPL: INICIO BLOQUE NUEVO [UI progreso de subida]
  function beginUploadUI(totalFiles){
    injectStyles();
    const backdrop = document.createElement('div');
    backdrop.className='tpl-modal-backdrop';
    backdrop.id = 'tpl-upload-backdrop';
    backdrop.innerHTML = `
      <div class="tpl-modal" role="dialog" aria-modal="true" aria-live="polite">
        <h3>Subiendo tus archivos…</h3>
        <div class="tpl-progress">
          <div class="tpl-bar"><i id="tpl-bar" style="width:0%"></i></div>
          <div class="tpl-small" id="tpl-upload-msg">Preparando…</div>
        </div>
      </div>
    `;
    document.body.appendChild(backdrop);
    const bar = document.getElementById('tpl-bar');
    const msg = document.getElementById('tpl-upload-msg');
    return {
      update({percent=0,fileIndex=0,total=totalFiles,fileName=''}){
        const p = Math.max(0, Math.min(100, Math.round(percent)));
        bar.style.width = p + '%';
        msg.textContent = `(${fileIndex}/${total}) ${fileName} — ${p}%`;
      },
      done(){
        const bd = document.getElementById('tpl-upload-backdrop');
        if (bd) bd.remove();
      },
      error(text){
        msg.textContent = text || 'No se pudo subir.';
      }
    };
  }
  // TPL: FIN BLOQUE NUEVO

  /* ===== EmailJS ===== */
  function loadEmailJS(publicKey){
    return new Promise((resolve, reject)=>{
      if (window.emailjs && window.emailjs.send){
        try { if (publicKey) window.emailjs.init({ publicKey }); } catch(e){}
        return resolve(window.emailjs);
      }
      const s = document.createElement('script');
      s.src = EMAILJS_URL;
      s.onload = () => { try{ if (publicKey) window.emailjs.init({ publicKey }); }catch(e){} resolve(window.emailjs); };
      s.onerror = () => reject(new Error('No se pudo cargar EmailJS'));
      document.head.appendChild(s);
    });
  }

  function buildHTMLFromForm(form){
    const fd = new FormData(form);
    const rows = [];
    const seen = new Set();
    fd.forEach((val, key)=>{
      if (seen.has(key)) return; seen.add(key);
      const els = form.querySelectorAll(`[name="${(window.CSS && CSS.escape)?CSS.escape(key):key}"]`);
      let label = '';
      if (els[0] && els[0].id){
        const lab = form.querySelector(`label[for="${(window.CSS && CSS.escape)?CSS.escape(els[0].id):els[0].id}"]`);
        if (lab) label = lab.textContent.trim();
      }
      const prettyKey = label || key.replace(/[_-]+/g,' ').replace(/\b\w/g, c=>c.toUpperCase());
      const vals = [];
      fd.getAll(key).forEach(v=>{
        if (v instanceof File) { if (v.name) vals.push(`Archivo: ${v.name}`); }
        else { vals.push(String(v).trim()); }
      });
      const prettyVal = vals.filter(Boolean).join(', ');
      rows.push(`<tr><th align="left" style="padding:6px 8px;border-bottom:1px solid #eee">${prettyKey}</th><td style="padding:6px 8px;border-bottom:1px solid #eee">${prettyVal || '-'}</td></tr>`);
    });
    return `
      <div style="font-family:system-ui,-apple-system,Segoe UI,Roboto,Ubuntu,'Helvetica Neue',Arial,sans-serif;line-height:1.45;color:#222">
        <p><strong>Nuevo envío desde The Pets Lovers</strong></p>
        <table width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;margin-top:8px">${rows.join('')}</table>
      </div>
    `;
  }

  function formToObject(form){
    const o = {};
    const fd = new FormData(form);
    fd.forEach((v,k)=>{
      if (v instanceof File) return;
      if (k in o){
        if (Array.isArray(o[k])) o[k].push(String(v));
        else o[k] = [o[k], String(v)];
      } else {
        o[k] = String(v);
      }
    });
    return o;
  }

  /* ===== Auth helpers ===== */
  function currentAuth(){
    try{ return firebase && firebase.auth ? firebase.auth() : null; }catch(_){ return null; }
  }
  function isLoggedNonAnonymous(){
    const auth = currentAuth();
    const u = auth && auth.currentUser;
    return !!(u && !u.isAnonymous);
  }

  // TPL: INICIO BLOQUE NUEVO [esperar a auth listo]
  async function waitForAuth(timeoutMs = 6000){
    const auth = currentAuth();
    if (!auth) return null;
    if (auth.currentUser) return auth.currentUser;
    return await new Promise((resolve)=>{
      let done = false;
      const to = setTimeout(()=>{ if(!done){ done = true; resolve(auth.currentUser || null); } }, timeoutMs);
      auth.onAuthStateChanged(u => {
        if (!done){ done = true; clearTimeout(to); resolve(u || null); }
      });
    });
  }
  // TPL: FIN BLOQUE NUEVO

  /* ===== Loader Firebase local para este bloque ===== */
  async function ensureFirebaseEmailLayer(){
    if (typeof firebase !== 'undefined' && firebase.app) return;
    async function load(src){ await new Promise((res,rej)=>{ const s=document.createElement('script'); s.src=src; s.defer=true; s.onload=res; s.onerror=rej; document.head.appendChild(s); }); }
    await load('https://www.gstatic.com/firebasejs/10.12.5/firebase-app-compat.js');
    await load('https://www.gstatic.com/firebasejs/10.12.5/firebase-auth-compat.js');
    await load('https://www.gstatic.com/firebasejs/10.12.5/firebase-firestore-compat.js');
    await load('https://www.gstatic.com/firebasejs/10.12.5/firebase-storage-compat.js');
    if (!firebase.apps.length){
      firebase.initializeApp({
        apiKey:"AIzaSyDW73aFuz2AFS9VeWg_linHIRJYN4YMgTk",
        authDomain:"thepetslovers-c1111.firebaseapp.com",
        projectId:"thepetslovers-c1111",
        storageBucket:"thepetslovers-c1111.appspot.com",
        messagingSenderId:"415914577533",
        appId:"1:415914577533:web:0b7a056ebaa4f1de28ab14",
        measurementId:"G-FXPD69KXBG"
      });
    }
  }

  // TPL: INICIO BLOQUE NUEVO [Guardar doc en 'candidaturas' para el panel]
  async function saveCandidaturaRecord(fields, filesMeta){
    try{
      await ensureFirebaseEmailLayer();
      const db = firebase.firestore();

      const byField = (fname)=> (filesMeta||[]).find(f => (f.field||'') === fname);
      const cv   = byField('cv');
      const tit  = byField('titulo');

      const data = {
        // Datos personales
        nombre: fields.nombre||'',
        ciudad: fields.ciudad||'',
        cp: fields.cp||'',
        telefono: fields.telefono||'',
        email: fields._replyto || fields.email || '',
        carnet: fields.carnet||'',
        vehiculo: fields.vehiculo||'',
        descripcionPersonal: fields.descripcionPersonal||'',

        // Formación
        atvTitulado: fields.atvTitulado||'',
        otrasFormaciones: fields.otrasFormaciones||'',
        experienciaLaboral: fields.experienciaLaboral||'',
        funcionesHabituales: fields.funcionesHabituales||'',
        links: fields.links||'',
        descFormacion: fields.descFormacion||'',

        // Experiencia
        hasCuidado: fields.hasCuidado||'',
        tiposAnimales: fields.tiposAnimales||'',
        comunicacionPropietarios: fields.comunicacionPropietarios||'',
        roturasGestion: fields.roturasGestion||'',
        necesidadesEspeciales: fields.necesidadesEspeciales||'',
        medicacion: fields.medicacion||'',

        // Entorno
        vivienda: fields.vivienda||'',
        seguridadCasa: fields.seguridadCasa||'',
        otrosAnimales: fields.otrosAnimales||'',
        otrasPersonasCasa: fields.otrasPersonasCasa||'',
        videovigilancia: fields.videovigilancia||'',
        cuidarEnDomicilio: fields.cuidarEnDomicilio||'',
        cuidarCasaPropietario: fields.cuidarCasaPropietario||'',
        ofrecerPaseos: fields.ofrecerPaseos||'',
        cachorrosSenior: fields.cachorrosSenior||'',

        // Disponibilidad
        disponibilidad: fields.disponibilidad||'',
        tiempoLibre: fields.tiempoLibre||'',
        finesFestivos: fields.finesFestivos||'',
        zonasCobertura: fields.zonasCobertura||'',

        // Archivos
        cvUrl: cv ? cv.url : '',
        tituloUrl: tit ? tit.url : '',

        // Meta
        estado: 'pendiente',
        createdAt: firebase.firestore.FieldValue.serverTimestamp()
      };

      await db.collection('candidaturas').add(data);
    }catch(e){
      console.warn('TPL: no se pudo guardar candidatura en panel:', e);
    }
  }
  // TPL: FIN BLOQUE NUEVO

  // ===== Util =====
  function normalizeType(t){
    if (!t) return 'generico';
    t = String(t).toLowerCase();
    if (t === 'candidatura') return 'cuestionario';
    return t;
  }

  function shouldHandle(form){
    /* TPL: FIX — No interceptar el formulario local del cuestionario,
       ni ninguna forma si esta página contiene el cuestionario */
    if (form && form.id === 'tpl-form-auxiliares') return false;        // <-- FIX
    if (document.getElementById('tpl-form-auxiliares')) return false;   // <-- FIX

    if (form.matches('[data-tpl-emailjs="false"]')) return false;
    if (form.querySelector('input[type="password"], [type="password"]')) return false;
    const path = (location.pathname || '').toLowerCase();
    const txt  = (form.textContent || '').toLowerCase();
    if (form.matches('[data-tpl-emailjs="true"]')) return true;

    if (path.includes('trabaja-con-nosotros') || path.includes('cuestionario')) return true; // Candidaturas
    if (path.includes('perfil') || path.includes('registro')) return true;                    // Perfil
    if (path.includes('reserva')) return true;                                                // Reservas

    if (txt.includes('enviar candidatura')) return true;
    if (txt.includes('guardar') || txt.includes('crear perfil')) return true;
    if (txt.includes('reservar')) return true;

    return false;
  }

  function detectType(form){
    const ds = form.dataset || {};
    if (ds.type) return normalizeType(ds.type);
    const path = (location.pathname || '').toLowerCase();
    const txt  = (form.textContent || '').toLowerCase();
    if (path.includes('trabaja-con-nosotros') || path.includes('cuestionario') || txt.includes('enviar candidatura')) return 'cuestionario';
    if (path.includes('perfil') || path.includes('registro') || txt.includes('guardar') || txt.includes('crear perfil')) return 'perfil';
    if (path.includes('reserva') || txt.includes('reservar')) return 'reserva';
    return 'generico';
  }

  function defaultsFor(type){
    switch(type){
      case 'cuestionario':
        return {
          subject: '[TPL] Candidatura de auxiliar',
          success: 'Tu candidatura está subida. Te avisaremos por email. Una vez que te aceptemos, podrás entrar para gestionar tu perfil.',
          cta: 'Volver al inicio',
          redirect: 'index.html',
          templateId: TEMPLATE_CANDIDATATURAS_REGISTROS
        };
      case 'perfil':
        return {
          subject: '[TPL] Registro: propietario + mascota',
          success: 'Perfil creado correctamente. Ya puedes gestionar tus reservas.',
          cta: 'Ir a mi perfil',
          redirect: 'perfil.html',
          templateId: TEMPLATE_CANDIDATURAS_REGISTROS
        };
      case 'reserva':
        return {
          subject: '[TPL] Nueva reserva',
          success: 'Tu reserva ya está solicitada. Nos pondremos en contacto contigo lo antes posible para la visita gratuita.',
          cta: 'Ir a mi perfil',
          redirect: 'perfil.html',
          templateId: TEMPLATE_RESERVAS
        };
      default:
        return {
          subject: '[TPL] Nuevo envío',
          success: '¡Enviado! Gracias por tu confianza.',
          cta: 'Aceptar',
          redirect: 'index.html',
          templateId: TEMPLATE_CANDIDATURAS_REGISTROS
        };
    }
  }

  function hasSelectedFiles(form){
    let n = 0;
    form.querySelectorAll('input[type="file"]').forEach(i=>{
      n += (i.files ? i.files.length : 0);
    });
    return n > 0;
  }

  // TPL: INICIO BLOQUE NUEVO [mapa de errores de Storage]
  function storageErrorMsg(err){
    const code = err && (err.code || err.error || '').toString();
    if (code.includes('unauthorized'))   return 'Permisos insuficientes en Storage. Revisa las reglas.';
    if (code.includes('canceled'))       return 'La subida se canceló.';
    if (code.includes('quota-exceeded')) return 'Se superó la cuota de Storage.';
    if (code.includes('timeout'))        return 'La subida no progresa (timeout). Revisa reglas o conexión.';
    return (err && err.message) || 'Ha ocurrido un error.';
  }
  // TPL: FIN BLOQUE NUEVO

  // TPL: INICIO BLOQUE NUEVO [subida con progreso + watchdog + auth sólido + RUTA CON UID]
  async function uploadAndSaveToFirebase(form, type, onProgress){
    try{
      await ensureFirebaseEmailLayer();
    }catch(_){
      return { error: 'firebase', message: 'No se pudo cargar Firebase en esta página.' };
    }

    // Espera real a que el usuario esté disponible
    const user = await waitForAuth(6000);
    if (!user || user.isAnonymous){
      return { error: 'auth', message: 'Debes iniciar sesión para adjuntar archivos.' };
    }

    const db = firebase.firestore();
    const storage = firebase.storage();

    const id = `${type}_${Date.now()}_${Math.random().toString(36).slice(2,8)}`;
    const fields = formToObject(form);

    // Preparar archivos seleccionados
    const fileInputs = form.querySelectorAll('input[type="file"]');
    const filesFlat = [];
    fileInputs.forEach(input=>{
      const field = input.name || 'archivo';
      Array.from(input.files||[]).forEach(file=>{
        filesFlat.push({ field, file });
      });
    });

    if (!filesFlat.length){
      // Si no hay archivos, aun así guardamos candidatura si aplica (sin URLs)
      if (type === 'cuestionario'){
        await saveCandidaturaRecord(fields, []);
      }
      return { id, files: [], fields };
    }

    const MAX_FILE = 10 * 1024 * 1024;  // 10MB
    const MAX_TOTAL = 20 * 1024 * 1024; // 20MB
    const totalSize = filesFlat.reduce((a,it)=> a + (it.file?.size||0), 0);
    if (filesFlat.some(it=> it.file.size > MAX_FILE) || totalSize > MAX_TOTAL){
      return { error: 'size', message: 'Cada archivo ≤ 10MB y el total ≤ 20MB.' };
    }

    const filesMeta = [];
    let uploadedBytesSoFar = 0;

    // Watchdog: cancela si un archivo no progresa en 25 s
    const NO_PROGRESS_MS = 25000;

    for (let i=0;i<filesFlat.length;i++){
      const { field, file } = filesFlat[i];
      const safeName = String(file.name||'file').replace(/[^\w.\-]+/g,'_').slice(0,120);

      // ⚠️ RUTA NUEVA CON UID para cumplir reglas tipo tpl/{uid}/...
      const path = `tpl/${user.uid}/${type}/${id}/${(field||'archivo')}__${safeName}`;
      const ref = storage.ref().child(path);

      await new Promise((resolve, reject)=>{
        let lastBytes = 0;
        let lastTick = Date.now();
        const task = ref.put(file, { contentType: file.type || 'application/octet-stream' });

        const tmr = setInterval(()=>{
          if (Date.now() - lastTick > NO_PROGRESS_MS){
            try { task.cancel(); } catch(e){}
            clearInterval(tmr);
            const err = Object.assign(new Error('timeout'), { code:'storage/timeout' });
            reject(err);
          }
        }, 4000);

        task.on('state_changed',
          (snap)=>{
            if (snap.bytesTransferred > lastBytes){
              lastBytes = snap.bytesTransferred;
              lastTick = Date.now();
            }
            if (onProgress){
              const percent = ((uploadedBytesSoFar + snap.bytesTransferred) / totalSize) * 100;
              onProgress({ percent, fileIndex: i+1, total: filesFlat.length, fileName: file.name });
            }
          },
          (err)=>{
            clearInterval(tmr);
            reject(err);
          },
          async ()=>{
            clearInterval(tmr);
            try{
              const url = await ref.getDownloadURL();
              filesMeta.push({ field, name: file.name, size: file.size, contentType: file.type || '', path, url });
              uploadedBytesSoFar += file.size;
              if (onProgress){
                const percent = (uploadedBytesSoFar / totalSize) * 100;
                onProgress({ percent, fileIndex: i+1, total: filesFlat.length, fileName: file.name });
              }
              resolve();
            }catch(e){ reject(e); }
          }
        );
      });
    }

    // Registro histórico (opcional)
    try{
      await db.collection('tpl_submissions').doc(id).set({
        type,
        uid: user.uid || null,
        createdAt: firebase.firestore.FieldValue.serverTimestamp(),
        page: location.href,
        fields,
        files: filesMeta,
        status: 'enviado'
      });
    }catch(e){ /* opcional */ }

    // Si es candidatura → crear registro para tu panel (con urls)
    if (type === 'cuestionario'){
      await saveCandidaturaRecord(fields, filesMeta);
    }

    return { id, files: filesMeta, fields };
  }
  // TPL: FIN BLOQUE NUEVO

  function defaultsForType(type){
    return defaultsFor(type);
  }

  /* TPL: INICIO FIX — detectar sesión por el botón del navbar si Firebase tarda */
  function looksLoggedFromNavbar(){
    var a = document.getElementById('tpl-login-link');
    if (!a) return false;
    var t = (a.textContent || '').toLowerCase();
    return t.includes('mi perfil') || t.includes('mi panel');
  }
  /* TPL: FIN FIX */

  /* TPL: INICIO FIX [helper para perfíl al finalizar] */
  function getProfileHref(){
    var a = document.getElementById('tpl-login-link');
    if (a && /perfil/.test((a.getAttribute('href')||''))) return a.getAttribute('href');
    return 'perfil.html';
  }
  /* TPL: FIN FIX */

  async function handleSubmit(ev){
    const form = ev.currentTarget;
    if (!shouldHandle(form)) return;

    ev.preventDefault();
    ev.stopImmediatePropagation();
    ev.stopPropagation();

    /* 👉 CAMBIO: respetar validación nativa del HTML antes de seguir */
    if (typeof form.reportValidity === 'function' && !form.reportValidity()){
      return; // el navegador mostrará qué campo falla (CP/teléfono, etc.)
    }

    const ds = form.dataset || {};
    const rawType = detectType(form);
    const type = normalizeType(ds.type ? ds.type.toLowerCase() : rawType);
    const base = defaultsForType(type);
    const cfg = Object.assign({}, base, {
      subject: ds.subject || base.subject,
      success: ds.success || base.success,
      cta: ds.cta || base.cta,
      redirect: ds.redirect || base.redirect,
      serviceId: ds.serviceId || EMAILJS_SERVICE_ID,
      templateId: ds.templateId || base.templateId,
      publicKey: ds.publicKey || EMAILJS_PUBLIC_KEY
    });

    try{ await ensureFirebaseEmailLayer(); }catch(_){}
    await waitForAuth(9000); // ⬅️ esperamos un poco más

    // 🔒 Exigir sesión en Candidaturas y Reservas SIEMPRE (con fallback visual del navbar)
    const loggedIn = isLoggedNonAnonymous() || looksLoggedFromNavbar(); /* TPL: FIX aplicado */
    if ((type === 'cuestionario' || type === 'reserva') && !loggedIn){
      const next = location.pathname + location.search + location.hash;
      showModal({
        title:'Inicia sesión para continuar',
        message:'Para enviar tu candidatura o solicitar una reserva, primero inicia sesión. Te llevamos y volverás aquí automáticamente.',
        ctaText:'Iniciar sesión',
        redirect: 'iniciar-sesion.html?next='+encodeURIComponent(next)
      });
      return;
    }

    const filesSelected = hasSelectedFiles(form);
    if (filesSelected) {
      form.setAttribute('enctype','multipart/form-data');
      form.setAttribute('method','POST');
      // Validación tamaño
      let total = 0, oversize = false;
      form.querySelectorAll('input[type="file"]').forEach(input=>{
        Array.from(input.files||[]).forEach(f=>{
          total += f.size; if (f.size > 10*1024*1024) oversize = true;
        });
      });
      if (oversize || total > 20*1024*1024){
        showModal({
          title: 'Archivos demasiado pesados',
          message: 'Cada archivo debe pesar ≤ 10MB y el total ≤ 20MB.',
          ctaText: 'Entendido'
        });
        return;
      }
    }

    const submits = form.querySelectorAll('[type="submit"]');
    submits.forEach(b=>{ b.disabled = true; b.dataset._oldText = b.textContent; b.textContent = 'Enviando…'; });

    const html = buildHTMLFromForm(form);
    const pageUrl = location.href;

    const ui = filesSelected ? beginUploadUI(form.querySelectorAll('input[type="file"]').length) : null;

    const fieldsForRecord = formToObject(form);

    try{
      if (filesSelected){
        const up = await uploadAndSaveToFirebase(form, type, ui ? ui.update : null);
        if (up && up.error){
          ui && ui.error(storageErrorMsg(up));
          showModal({ title:'No se pudo subir archivos', message: storageErrorMsg(up), ctaText:'Cerrar' });
          return;
        }
      } else {
        if (type === 'cuestionario'){
          await saveCandidaturaRecord(fieldsForRecord, []);
        }
      }

      ui && ui.done();

      await loadEmailJS(cfg.publicKey);
      await window.emailjs.send(cfg.serviceId, cfg.templateId, {
        subject: cfg.subject,
        message_html: html,
        page_url: pageUrl
      });

      try { form.reset(); } catch(_){}

      const successRedirect = (type === 'cuestionario' || type === 'reserva')
        ? getProfileHref()
        : (cfg.redirect || getProfileHref());

      showModal({
        title: '¡Listo!',
        message: cfg.success,
        ctaText: cfg.cta,
        redirect: successRedirect
      });

    } catch(err){
      console.error('TPL envío error:', err);
      ui && ui.error('No se pudo subir.');
      const msg = storageErrorMsg(err);
      showModal({ title:'No se pudo enviar', message: msg, ctaText:'Cerrar' });
    } finally {
      ui && ui.done();
      submits.forEach(b=>{ b.disabled = false; if (b.dataset._oldText) b.textContent = b.dataset._oldText; });
    }
  }

  function attach(){
    document.querySelectorAll('form').forEach(form=>{
      if (form.__tplBound) return;
      form.__tplBound = true;
      // Importante: seguimos en captura, pero ahora shouldHandle() descarta el cuestionario local
      form.addEventListener('submit', handleSubmit, { passive:false, capture:true });
    });
  }

  function init(){
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', attach);
    } else {
      attach();
    }
    new MutationObserver(attach).observe(document.documentElement, { childList:true, subtree:true });
  }
  init();
})();
/* ===========================
   TPL: FIN BLOQUE NUEVO
   =========================== */

/* TPL: INICIO BLOQUE NUEVO [Fix CP en Reservas desde navbar] */
(function(){
  function fixCp(){
    var pc = document.getElementById('postalCode');
    if (!pc) return;
    // Fuerza validación HTML correcta: 5 dígitos
    pc.setAttribute('type','text');        // evita problemas si era number
    pc.setAttribute('pattern','[0-9]{5}');
    pc.setAttribute('inputmode','numeric');
    pc.setAttribute('maxlength','5');
  }
  if (document.readyState === 'loading'){
    document.addEventListener('DOMContentLoaded', fixCp);
  } else {
    fixCp();
  }
})();
/* TPL: FIN BLOQUE NUEVO */
