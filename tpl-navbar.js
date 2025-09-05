/* TPL Navbar — estable, idempotente y sin bucles */
(function(){
  // Evita dobles ejecuciones si el script se incluye dos veces
  if (window.__TPL_NAVBAR_RUNNING__) return;
  window.__TPL_NAVBAR_RUNNING__ = true;

  // ========= CONFIG =========
  var ADMIN_EMAILS = ['4b.jenny.gomez@gmail.com'];    // admin(s)
  var PANEL_URL    = 'tpl-candidaturas-admin.html';   // tu panel
  var PROFILE_URL  = 'perfil.html';                   // SIEMPRE este para usuarios

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
      // Solo escribe si está vacío o distinto (evita parpadeos)
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
    // Evita cambios innecesarios (corta “peleas” con otros scripts)
    if (a.textContent.trim() !== text) a.textContent = text;
    if (a.getAttribute('href') !== href) a.setAttribute('href', href);
  }

  // Botón por defecto hasta saber si hay sesión
  function setDefaultBtn(){ setBtn('Iniciar sesión','iniciar-sesion.html?next='+encodeURIComponent(PROFILE_URL)); }

  // Actualiza según usuario
  function updateBtn(user){
    if (!user){ setDefaultBtn(); return; }
    var admin = isAdminEmail(user.email);
    if (admin){
      // La diosa pidió: en INDEX siempre “Mi panel” al ser admin
      setBtn('Mi panel', PANEL_URL);
    } else {
      setBtn('Mi perfil', PROFILE_URL);
    }
  }

  // Carga Firebase solo si hace falta y sin duplicar
  function loadOnce(src){
    return new Promise(function(res, rej){
      var already = Array.prototype.some.call(document.scripts, function(s){
        return s.src === src;
      });
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

  // Arranque seguro (sin observers ni reemplazos continuos)
  function start(){
    injectNavbarOnce();
    setDefaultBtn();

    (async function(){
      try{
        await ensureFirebase();
        var auth = initFirebase();
        if (!auth) return;

        // 1) Actualiza ya con el usuario actual
        updateBtn(auth.currentUser);

        // 2) Y en cuanto cambie el estado
        auth.onAuthStateChanged(function(u){
          updateBtn(u);
          // Refuerzo: si eres admin y estás en index, re-afirma “Mi panel” tras 300ms (evita carreras)
          if (IS_HOME && u && isAdminEmail(u.email)){
            setTimeout(function(){ setBtn('Mi panel', PANEL_URL); }, 300);
          }
        });
      }catch(_){
        // Si Firebase falla, el navbar sigue visible con el botón por defecto
      }
    })();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', start);
  } else {
    start();
  }
})();
/* ===========================
   TPL: INICIO BLOQUE NUEVO [EmailJS unificado + modal + redirecciones (navbar)]
   =========================== */
(function(){
  'use strict';
  if (window.__TPL_EMAILJS_BOOTSTRAPPED) return;
  window.__TPL_EMAILJS_BOOTSTRAPPED = true;

  // 🔑 TUS CLAVES/IDS (ya puestas)
  const EMAILJS_PUBLIC_KEY = 'L2xAATfVuHJwj4EIV';
  const EMAILJS_SERVICE_ID = 'service_odjqrfl';
  const TEMPLATE_CANDIDATURAS_REGISTROS = 'template_32z2wj4'; // candidaturas + registros
  const TEMPLATE_RESERVAS = 'template_rao5n0c';                 // reservas

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
      if (window.emailjs && window.emailjs.sendForm){
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

  // ——— Detección y reglas ———
  function shouldHandle(form){
    if (form.matches('[data-tpl-emailjs="false"]')) return false; // opt-out
    if (form.querySelector('input[type="password"], [type="password"]')) return false; // no tocar login
    const path = (location.pathname || '').toLowerCase();
    const txt  = (form.textContent || '').toLowerCase();
    if (form.matches('[data-tpl-emailjs="true"]')) return true; // opt-in explícito

    if (path.includes('trabaja-con-nosotros') || path.includes('cuestionario')) return true; // candidaturas
    if (path.includes('reserva')) return true;                                             // reservas
    if (path.includes('perfil') || path.includes('registro')) return true;                 // registro propietario+mascota

    if (txt.includes('enviar candidatura')) return true;
    if (txt.includes('reservar')) return true;
    if (txt.includes('guardar') || txt.includes('crear perfil')) return true;

    return false;
  }

  function detectType(form){
    const ds = form.dataset || {};
    if (ds.type) return ds.type.toLowerCase();

    const path = (location.pathname || '').toLowerCase();
    const txt  = (form.textContent || '').toLowerCase();
    if (path.includes('trabaja-con-nosotros') || path.includes('cuestionario') || txt.includes('enviar candidatura')) return 'cuestionario';
    if (path.includes('reserva') || txt.includes('reservar')) return 'reserva';
    if (path.includes('perfil') || path.includes('registro') || txt.includes('guardar') || txt.includes('crear perfil')) return 'perfil';
    return 'generico';
  }

  function defaultsFor(type){
    switch(type){
      case 'cuestionario':
        return {
          subject: '[TPL] Candidatura de auxiliar',
          success: 'Tu candidatura está subida. Te avisaremos por email.',
          cta: 'Volver al inicio',
          redirect: 'index.html',
          templateId: TEMPLATE_CANDIDATURAS_REGISTROS
        };
      case 'reserva':
        return {
          subject: '[TPL] Nueva reserva',
          success: '¡Reserva enviada! Te contactaremos para agendar la primera visita gratuita.',
          cta: 'Ir a mi perfil',
          redirect: 'perfil.html',
          templateId: TEMPLATE_RESERVAS
        };
      case 'perfil':
        return {
          subject: '[TPL] Registro: propietario + mascota',
          success: 'Perfil creado correctamente. Ya puedes gestionar tus reservas.',
          cta: 'Ir a mi perfil',
          redirect: 'perfil.html',
          templateId: TEMPLATE_CANDIDATURAS_REGISTROS
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
    if (!shouldHandle(form)) return;  // deja pasar forms no gestionados
    ev.preventDefault();

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

    // Adjuntos: si hay <input type="file">, fuerza enctype
    if (form.querySelector('input[type="file"]')) {
      form.setAttribute('enctype','multipart/form-data');
    }

    // Bloquear botones
    const submits = form.querySelectorAll('[type="submit"]');
    submits.forEach(b=>{ b.disabled = true; b.dataset._oldText = b.textContent; b.textContent = 'Enviando…'; });

    try{
      await loadEmailJS(cfg.publicKey);

      // Subject + tabla HTML con todos los campos
      const html = buildHTMLFromForm(form);
      const hiddenHtml = document.createElement('input');
      hiddenHtml.type = 'hidden';
      hiddenHtml.name = 'message_html';
      hiddenHtml.value = html;

      const hiddenSubject = document.createElement('input');
      hiddenSubject.type = 'hidden';
      hiddenSubject.name = 'subject';
      hiddenSubject.value = cfg.subject;

      form.appendChild(hiddenHtml);
      form.appendChild(hiddenSubject);

      await window.emailjs.sendForm(cfg.serviceId, cfg.templateId, form);

      hiddenHtml.remove();
      hiddenSubject.remove();

      try { form.reset(); } catch(e){}

      showModal({
        title: '¡Listo!',
        message: cfg.success,
        ctaText: cfg.cta,
        redirect: cfg.redirect
      });

    } catch(err){
      console.error('TPL EmailJS error:', err);
      showModal({ title:'No se pudo enviar', message:'Ha ocurrido un error al enviar el formulario. Inténtalo de nuevo.', ctaText:'Cerrar' });
    } finally {
      submits.forEach(b=>{ b.disabled = false; if (b.dataset._oldText) b.textContent = b.dataset._oldText; });
    }
  }

  function attach(){
    document.querySelectorAll('form').forEach(form=>{
      if (form.__tplBound) return;
      form.__tplBound = true;
      form.addEventListener('submit', handleSubmit, { passive:false });
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
