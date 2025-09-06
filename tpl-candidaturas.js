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
  function resolveLoginUrl(){
    // Buscamos el botón/enlace real de “Iniciar sesión” para no adivinar la ruta
    const a = $('.login-button[href]') 
           || $('a[href*="iniciar"][href$=".html"]') 
           || $('a[href*="#iniciar"]');
    return a ? a.getAttribute('href') : 'iniciar-sesion.html';
  }
  function wireAcceptRedirect(){
    const ov = ensureOverlay();
    const btn = $('#tpl-ov-accept', ov);
    if (!btn.__tpl_wired){
      btn.__tpl_wired = true;
      btn.addEventListener('click', function(){
        const url = resolveLoginUrl();
        window.location.href = url;
      });
    }
  }

  // ========= Lógica genérica para formularios EmailJS =========
  async function handleEmailSend(form, templateId, sendingLabel, successLabel){
    const submitBtn = form.querySelector('button[type="submit"], .cta-button');

    // Validación nativa
    if (typeof form.reportValidity === 'function' && !form.reportValidity()){
      setStatus('Revisa los campos obligatorios.', false);
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

      // Éxito → mensaje + botón Aceptar que redirige a Iniciar sesión
      const okMsg = successLabel || (form.dataset.success || '¡Envío realizado con éxito! 🐾');
      setStatus(okMsg + ' (correo enviado con adjuntos).', true);
      showOverlay(
        okMsg + ' En cuanto esté aceptada podrás generar tu perfil; te llegará un correo para crear tu acceso.',
        true
      );
      wireAcceptRedirect();

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

    // --- RESERVAS (si esta página también tiene el formulario de reservas) ---
    // Si quieres reutilizar este mismo archivo en tu página de reservas, pon allí el formulario con id="tpl-form-reservas"
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
