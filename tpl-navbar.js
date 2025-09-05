/* TPL Navbar — estable, idempotente y sin bucles */
(function(){
  if (window.__TPL_NAVBAR_RUNNING__) return;
  window.__TPL_NAVBAR_RUNNING__ = true;

  // ========= CONFIG =========
  var ADMIN_EMAILS = ['4b.jenny.gomez@gmail.com'];    // admin(s)
  var PANEL_URL    = 'tpl-candidaturas-admin.html';
  var PROFILE_URL  = 'perfil.html';

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

  function updateBtn(user){
    if (!user){ setDefaultBtn(); return; }
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

  async function ensureFirebase(){
    if (typeof firebase !== 'undefined' && firebase.app) return;
    await loadOnce('https://www.gstatic.com/firebasejs/10.12.5/firebase-app-compat.js');
    await loadOnce('https://www.gstatic.com/firebasejs/10.12.5/firebase-auth-compat.js');
    // TPL: INICIO BLOQUE NUEVO [cargar Firestore + Storage]
    await loadOnce('https://www.gstatic.com/firebasejs/10.12.5/firebase-firestore-compat.js');
    await loadOnce('https://www.gstatic.com/firebasejs/10.12.5/firebase-storage-compat.js');
    // TPL: FIN BLOQUE NUEVO
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

    (async function(){
      try{
        await ensureFirebase();
        var auth = initFirebase();
        if (!auth) return;

        updateBtn(auth.currentUser);

        auth.onAuthStateChanged(function(u){
          updateBtn(u);
          if (IS_HOME && u && u.email && isAdminEmail(u.email)){
            setTimeout(function(){ setBtn('Mi panel', PANEL_URL); }, 300);
          }
        });
      }catch(_){}
    })();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', start);
  } else {
    start();
  }
})();

/* ===========================
   TPL: INICIO BLOQUE NUEVO [EmailJS unificado + modal + redirecciones (navbar) + subida condicionada a Firebase]
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
      .tpl-btn--ghost{background:#fff;border:1px solid var(--tpl-primary,#339496);color:var(--tpl-primary,#339496)}
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

  // TPL: INICIO BLOQUE NUEVO [helpers auth]
  function currentAuth(){
    try{ return firebase && firebase.auth ? firebase.auth() : null; }catch(_){ return null; }
  }
  function isLoggedNonAnonymous(){
    const auth = currentAuth();
    const u = auth && auth.currentUser;
    return !!(u && !u.isAnonymous);
  }
  // TPL: FIN BLOQUE NUEVO

  // ===== Subida a Firebase (Storage + Firestore) — SOLO con sesión no anónima =====
  async function uploadAndSaveToFirebase(form, type){
    if (typeof firebase === 'undefined' || !firebase.firestore || !firebase.storage) return null;

    // TPL: INICIO BLOQUE NUEVO [exigir sesión no anónima]
    const auth = currentAuth();
    const user = auth && auth.currentUser;
    if (!user || user.isAnonymous){
      return { error: 'auth', message: 'Debes iniciar sesión para adjuntar archivos.' };
    }
    // TPL: FIN BLOQUE NUEVO

    const db = firebase.firestore();
    const storage = firebase.storage();

    const id = `${type}_${Date.now()}_${Math.random().toString(36).slice(2,8)}`;
    const fields = formToObject(form);

    const filesMeta = [];
    const fileInputs = form.querySelectorAll('input[type="file"]');
    let total = 0;
    const MAX_FILE = 10 * 1024 * 1024;  // 10MB
    const MAX_TOTAL = 20 * 1024 * 1024; // 20MB

    for (const input of fileInputs){
      for (const file of (input.files || [])){
        total += file.size;
        if (file.size > MAX_FILE || total > MAX_TOTAL){
          return { error: 'size', message: 'Cada archivo ≤ 10MB y el total ≤ 20MB.' };
        }
      }
    }

    function sanitizeName(name){ return String(name || '').replace(/[^\w.\-]+/g,'_').slice(0,120); }

    for (const input of fileInputs){
      const field = input.name || 'archivo';
      for (const file of (input.files || [])){
        const path = `tpl/${type}/${id}/${sanitizeName(field)}__${sanitizeName(file.name)}`;
        const ref = storage.ref().child(path);
        await ref.put(file, { contentType: file.type || 'application/octet-stream' });
        const url = await ref.getDownloadURL();
        filesMeta.push({
          field, name: file.name, size: file.size, contentType: file.type || '',
          path, url
        });
      }
    }

    const doc = {
      type,
      createdAt: firebase.firestore.FieldValue.serverTimestamp(),
      page: location.href,
      fields,
      files: filesMeta,
      status: 'enviado'
    };
    await db.collection('tpl_submissions').doc(id).set(doc);
    return { id, files: filesMeta };
  }

  // Detección y textos
  function shouldHandle(form){
    if (form.matches('[data-tpl-emailjs="false"]')) return false;
    if (form.querySelector('input[type="password"], [type="password"]')) return false;
    const path = (location.pathname || '').toLowerCase();
    const txt  = (form.textContent || '').toLowerCase();
    if (form.matches('[data-tpl-emailjs="true"]')) return true;

    if (path.includes('trabaja-con-nosotros') || path.includes('cuestionario')) return true;
    if (path.includes('perfil') || path.includes('registro')) return true;
    if (path.includes('reserva')) return true;

    if (txt.includes('enviar candidatura')) return true;
    if (txt.includes('guardar') || txt.includes('crear perfil')) return true;
    if (txt.includes('reservar')) return true;

    return false;
  }

  function detectType(form){
    const ds = form.dataset || {};
    if (ds.type) return ds.type.toLowerCase();
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
          templateId: TEMPLATE_CANDIDATURAS_REGISTROS
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

  async function handleSubmit(ev){
    const form = ev.currentTarget;
    if (!shouldHandle(form)) return;

    ev.preventDefault();
    ev.stopImmediatePropagation();
    ev.stopPropagation();

    const ds = form.dataset || {};
    const type = detectType(form);
    const base = defaultsFor(type);
    const cfg = Object.assign({}, base, {
      subject: ds.subject || base.subject,
      success: ds.success || base.success,
      cta: ds.cta || base.cta,
      redirect: ds.redirect || base.redirect,
      serviceId: ds.serviceId || EMAILJS_SERVICE_ID,
      templateId: ds.templateId || base.templateId,
      publicKey: ds.publicKey || EMAILJS_PUBLIC_KEY
    });

    const hasFiles = !!form.querySelector('input[type="file"]');
    if (hasFiles) {
      form.setAttribute('enctype','multipart/form-data');
      form.setAttribute('method','POST');

      const MAX_FILE = 10 * 1024 * 1024;
      const MAX_TOTAL = 20 * 1024 * 1024;
      let total = 0, oversize = false;
      form.querySelectorAll('input[type="file"]').forEach(input=>{
        Array.from(input.files||[]).forEach(f=>{
          total += f.size; if (f.size > MAX_FILE) oversize = true;
        });
      });
      if (oversize || total > MAX_TOTAL){
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

    try{
      await ensureFirebase();

      // TPL: INICIO BLOQUE NUEVO [respeto a reglas: subir solo si logueado y no anónimo]
      const canUpload = isLoggedNonAnonymous();
      if (hasFiles && !canUpload){
        showModal({
          title:'Inicia sesión para adjuntar',
          message:'Para adjuntar archivos debes iniciar sesión. Puedes iniciar sesión ahora y volveremos a esta página.',
          ctaText:'Iniciar sesión',
          redirect: 'iniciar-sesion.html?next='+encodeURIComponent(location.pathname + location.search)
        });
        return; // no seguimos; evitamos error
      }

      if (canUpload && (type==='cuestionario' || type==='perfil')){
        const up = await uploadAndSaveToFirebase(form, type);
        if (up && up.error==='size'){
          showModal({ title:'Archivos demasiado pesados', message: up.message, ctaText:'Entendido' });
          return;
        }
        // si hubo error 'auth' (no debería aquí), seguimos con email sin adjuntos
      }
      // TPL: FIN BLOQUE NUEVO

      await loadEmailJS(cfg.publicKey);
      await window.emailjs.send(cfg.serviceId, cfg.templateId, {
        subject: cfg.subject,
        message_html: html,
        page_url: pageUrl
      });

      try { form.reset(); } catch(_){}

      showModal({
        title: '¡Listo!',
        message: cfg.success,
        ctaText: cfg.cta,
        redirect: cfg.redirect
      });

    } catch(err){
      console.error('TPL EmailJS/Firebase error:', err);
      showModal({ title:'No se pudo enviar', message:'Ha ocurrido un error al enviar el formulario. Inténtalo de nuevo.', ctaText:'Cerrar' });
    } finally {
      submits.forEach(b=>{ b.disabled = false; if (b.dataset._oldText) b.textContent = b.dataset._oldText; });
    }
  }

  function attach(){
    document.querySelectorAll('form').forEach(form=>{
      if (form.__tplBound) return;
      form.__tplBound = true;
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
