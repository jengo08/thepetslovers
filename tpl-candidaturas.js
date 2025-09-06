/* TPL: INICIO BLOQUE NUEVO [EmailJS + Overlay — Candidaturas (y Reservas) con adjuntos, sin Firebase Storage/Cloudinary/Formspree] */
(function () {
  'use strict';

  // ========= 🔑 EmailJS (tus claves) =========
  const EMAILJS_PUBLIC_KEY = 'L2xAATfVuHJwj4EIV';
  const EMAILJS_SERVICE_ID = 'service_odjqrfl';
  const TEMPLATE_CANDIDATURAS = 'template_32z2wj4';
  const TEMPLATE_RESERVAS     = 'template_rao5n0c';
  const EMAILJS_URL = 'https://cdn.jsdelivr.net/npm/@emailjs/browser@4/dist/email.min.js';

  // ========= Helpers UI / DOM =========
  function q(id){ return document.getElementById(id); }
  function $(sel, root){ return (root||document).querySelector(sel); }
  function setStatus(msg, ok){
    var el = q('tpl-estado'); if (!el) return;
    el.textContent = msg;
    el.className = 'tpl-note ' + (ok ? 'tpl-ok' : 'tpl-error');
  }
  function withTimeout(promise, ms, label){
    let timer; const err = new Error((label||'Operación')+' tardó demasiado');
    const t = new Promise((_,rej)=> timer=setTimeout(()=>rej(err), ms));
    return Promise.race([promise.finally(()=>clearTimeout(timer)), t]);
  }
  function loadScript(src){
    return new Promise((res, rej)=>{
      const s = document.createElement('script');
      s.src = src; s.async = true;
      s.onload = res; s.onerror = ()=>rej(new Error('No se pudo cargar '+src));
      document.head.appendChild(s);
    });
  }
  async function ensureEmailJS(){
    if (window.emailjs) return window.emailjs;
    await loadScript(EMAILJS_URL);
    if (!window.emailjs) throw new Error('EmailJS SDK no disponible');
    return window.emailjs;
  }

  // ========= TPL: FIX — Firebase Auth mínimo para comprobar sesión =========
  const FB_APP = 'https://www.gstatic.com/firebasejs/10.12.5/firebase-app-compat.js';
  const FB_AUTH = 'https://www.gstatic.com/firebasejs/10.12.5/firebase-auth-compat.js';

  async function ensureFirebaseAuth(){
    if (window.firebase && firebase.auth) return;
    // Carga ligera: solo app+auth
    await loadScript(FB_APP);
    await loadScript(FB_AUTH);
    if (!firebase.apps || !firebase.apps.length){
      // Usa tu config (la misma de la web)
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
  function getAuth(){ try{ return firebase && firebase.auth ? firebase.auth() : null; }catch(_){ return null; } }
  async function waitForAuth(timeoutMs=9000){
    const auth = getAuth(); if (!auth) return null;
    if (auth.currentUser) return auth.currentUser;
    return await new Promise((resolve)=>{
      let done = false;
      const to = setTimeout(()=>{ if(!done){ done=true; resolve(auth.currentUser||null); } }, timeoutMs);
      auth.onAuthStateChanged(u=>{ if(!done){ done=true; clearTimeout(to); resolve(u||null); } });
    });
  }
  function isLogged(){
    const auth = getAuth();
    const u = auth && auth.currentUser;
    return !!(u && !u.isAnonymous);
  }
  // Fallback visual (si el navbar ya cambió el texto)
  function looksLoggedFromNavbar(){
    const a = document.getElementById('tpl-login-link'); if (!a) return false;
    const t = (a.textContent||'').toLowerCase();
    return t.includes('mi perfil') || t.includes('mi panel');
  }
  function resolveLoginUrl(){
    // Busca el “Iniciar sesión” real para no adivinar
    const a = $('.login-button[href]')
          || $('a[href*="iniciar"][href$=".html"]')
          || $('a[href*="#iniciar"]');
    const href = a ? a.getAttribute('href') : 'iniciar-sesion.html';
    // Añade ?next=[ruta actual]
    const sep = href.includes('?') ? '&' : '?';
    return href + sep + 'next=' + encodeURIComponent(location.pathname + location.search + location.hash);
  }
  function getProfileUrl(){
    const a = document.getElementById('tpl-login-link');
    if (a && /perfil/.test((a.getAttribute('href')||''))) return a.getAttribute('href');
    return 'perfil.html';
  }

  // ========= Overlay (tarjeta modal) =========
  function ensureOverlay(){
    let ov = $('#tpl-overlay');
    if (!ov){
      ov = document.createElement('div');
      ov.id = 'tpl-overlay';
      ov.className = 'tpl-overlay';
      ov.innerHTML =
        '<div class="tpl-modal" role="dialog" aria-modal="true" aria-labelledby="tpl-ov-title">'+
        '  <p id="tpl-ov-text" style="margin-bottom:14px"></p>'+
        '  <div class="tpl-ov-actions" style="display:flex;gap:10px;justify-content:center">'+
        '    <button id="tpl-ov-accept" class="cta-button" style="display:none">Aceptar</button>'+
        '  </div>'+
        '</div>';
      document.body.appendChild(ov);
    }
    return ov;
  }
  function showOverlay(message, showAccept){
    const ov = ensureOverlay();
    ov.classList.add('on');
    $('#tpl-ov-text', ov).textContent = message || '';
    const btn = $('#tpl-ov-accept', ov);
    btn.style.display = showAccept ? 'inline-block' : 'none';
  }
  function hideOverlay(){
    const ov = $('#tpl-overlay'); if (ov) ov.classList.remove('on');
  }
  // TPL: FIX — aceptar con redirección configurable
  function wireAcceptRedirect(url){
    const ov = ensureOverlay();
    const btn = $('#tpl-ov-accept', ov);
    btn.onclick = null;
    btn.addEventListener('click', function(){
      window.location.href = url;
    }, { once:true });
  }

  // ========= Lógica genérica para formularios EmailJS =========
  async function handleEmailSend(form, templateId, sendingLabel, successLabel){
    const submitBtn = form.querySelector('button[type="submit"], .cta-button');

    // Validación nativa
    if (typeof form.reportValidity === 'function' && !form.reportValidity()){
      setStatus('Revisa los campos obligatorios.', false);
      return;
    }

    // TPL: FIX — Exigir sesión real antes de enviar (solo EmailJS)
    try{ await ensureFirebaseAuth(); }catch(_){}
    await waitForAuth(9000);
    const logged = isLogged() || looksLoggedFromNavbar();
    if (!logged){
      showOverlay('Inicia sesión para continuar. Te llevamos y volverás aquí automáticamente.', true);
      wireAcceptRedirect(resolveLoginUrl()); // → login con ?next
      return;
    }

    // Límite de tamaño por archivo (10 MB)
    const max = 10 * 1024 * 1024;
    const files = form.querySelectorAll('input[type="file"]');
    for (const inp of files){
      const f = inp.files && inp.files[0];
      if (f && f.size > max){
        setStatus('El archivo "'+(f.name||'adjunto')+'" supera 10MB.', false);
        return;
      }
    }

    if (submitBtn){ submitBtn.disabled = true; submitBtn.textContent = 'Enviando…'; }
    setStatus('Preparando envío…', false);
    showOverlay(sendingLabel, false);

    try{
      const emailjs = await ensureEmailJS();
      try{ emailjs.init(EMAILJS_PUBLIC_KEY); }catch(_){}

      // Envío con adjuntos reales (sendForm + <input type="file">)
      await withTimeout(
        emailjs.sendForm(EMAILJS_SERVICE_ID, templateId, form),
        30000,
        'EmailJS'
      );

      // Éxito → mensaje + botón Aceptar que te lleva al PERFIL (ya hay sesión)
      const okMsg = successLabel || (form.dataset.success || '¡Envío realizado con éxito! 🐾');
      setStatus(okMsg + ' (correo enviado con adjuntos).', true);
      showOverlay(
        okMsg + ' En cuanto esté aceptada podrás generar tu perfil; te llegará un correo para crear tu acceso.',
        true
      );
      wireAcceptRedirect(getProfileUrl()); // → perfil (no a login)

      try{ form.reset(); }catch(_){}

    }catch(err){
      console.error(err);
      setStatus('No se pudo enviar. ' + (err && err.message ? err.message : ''), false);
      hideOverlay();
    }finally{
      if (submitBtn){ submitBtn.disabled = false; submitBtn.textContent = 'Enviar'; }
    }
  }

  // ========= Inicialización por página =========
  document.addEventListener('DOMContentLoaded', function(){
    // --- CANDIDATURAS ---
    const formC = q('tpl-form-auxiliares');
    if (formC){
      formC.addEventListener('submit', function(ev){
        ev.preventDefault(); // Ignora cualquier action (Formspree u otro)
        handleEmailSend(
          formC,
          TEMPLATE_CANDIDATURAS,
          'Subiendo archivos y enviando tu candidatura…',
          'Tu candidatura está subida.'
        );
      });
    }

    // --- RESERVAS ---
    const formR = q('tpl-form-reservas');
    if (formR){
      formR.addEventListener('submit', function(ev){
        ev.preventDefault();
        handleEmailSend(
          formR,
          TEMPLATE_RESERVAS,
          'Enviando tu reserva…',
          'Tu solicitud de reserva está enviada.'
        );
      });
    }
  });
})();
/* TPL: FIN BLOQUE NUEVO */
