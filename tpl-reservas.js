/* =========================
   Hook de Auth (mismo patrón que usas)
   ========================= */
(function(){
  var ready = (window.__TPL_AUTH__ && window.__TPL_AUTH__.ready)
    ? window.__TPL_AUTH__.ready
    : Promise.resolve(null);

  window.__TPL_GET_USER__ = function(){
    return (window.__TPL_AUTH__ && window.__TPL_AUTH__.user) || null;
  };

  ready.then(function(user){
    if (user) {
      window.__TPL_CURRENT_USER__ = user;
      try { window.dispatchEvent(new CustomEvent('tpl-auth-ready', { detail:{ user } })); } catch(_){}
    } else {
      console.warn('[TPL][reservas] No hay sesión (el formulario queda deshabilitado hasta login).');
    }
  });
})();

/* =========================
   Reservas: login obligatorio + EmailJS (sendForm) + Firestore opcional
   ========================= */
(function(){
  const $ = (id) => document.getElementById(id);

  /* ---------- Overlay minimal ---------- */
  function ensureOverlay(){
    let wrap = document.getElementById('tpl-overlay');
    if(!wrap){
      wrap = document.createElement('div');
      wrap.id = 'tpl-overlay';
      wrap.className = 'tpl-overlay';
      wrap.innerHTML = `
        <div class="tpl-modal" role="dialog" aria-live="polite">
          <p id="tpl-ov-text"></p>
          <pre id="tpl-err-detail" style="display:none;white-space:pre-wrap;text-align:left;font-size:.9rem;background:#f7f7f7;padding:8px;border-radius:8px;max-height:200px;overflow:auto"></pre>
          <button type="button" class="cta-button" id="tpl-ov-action">Aceptar</button>
        </div>`;
      document.body.appendChild(wrap);
    }
    return wrap;
  }
  function showSuccessOverlay(msg, redirect){
    const wrap = ensureOverlay();
    wrap.querySelector('#tpl-ov-text').textContent = msg || 'Tu solicitud se ha enviado correctamente.';
    const det = wrap.querySelector('#tpl-err-detail'); det.style.display='none'; det.textContent='';
    wrap.classList.add('on');
    const btn = wrap.querySelector('#tpl-ov-action');
    btn.textContent = 'Ir a mi perfil';
    btn.onclick = () => { location.href = redirect || 'perfil.html'; };
  }
  function showErrorOverlay(msg, detail){
    const wrap = ensureOverlay();
    wrap.querySelector('#tpl-ov-text').textContent = msg || 'No se pudo enviar la solicitud.';
    const det = wrap.querySelector('#tpl-err-detail');
    if(detail){ det.style.display='block'; det.textContent = formatError(detail); } else { det.style.display='none'; det.textContent=''; }
    wrap.classList.add('on');
    const btn = wrap.querySelector('#tpl-ov-action');
    btn.textContent = 'Cerrar';
    btn.onclick = () => { wrap.classList.remove('on'); };
  }
  function formatError(e){
    try{
      if(!e) return '';
      if (typeof e === 'string') return e;
      if (e.code || e.message) return (e.code?`[${e.code}] `:'') + (e.message||'');
      return JSON.stringify(e, null, 2);
    }catch(_){ return String(e||''); }
  }

  /* ---------- EmailJS (MODO CANDIDATURAS: sendForm + template_32z2wj4) ---------- */
  async function sendEmailJS_likeCandidaturas(form){
    if(!window.emailjs) throw new Error('EmailJS SDK no cargado');

    // Usamos EXACTAMENTE el template que ya te funciona en Candidaturas
    const SERVICE_ID = (window.TPL_EMAILJS && (TPL_EMAILJS.serviceId || TPL_EMAILJS.service)) || 'service_odjqrfl';
    const TEMPLATE_ID = 'template_32z2wj4'; // ← igual que candidaturas (NO template_rao5n0c)
    const PUBLIC_KEY  = (window.TPL_EMAILJS && (TPL_EMAILJS.publicKey || TPL_EMAILJS.userId)) || 'L2xAATfVuHJwj4EIV';

    try { emailjs.init({ publicKey: PUBLIC_KEY }); } catch(_){ /* idempotente */ }
    // Importante: usamos sendForm para que EmailJS recoja TODOS los campos del form (tal y como hace en candidaturas)
    return await emailjs.sendForm(SERVICE_ID, TEMPLATE_ID, form);
  }

  /* ---------- Firestore opcional ---------- */
  async function saveToFirestore(payload){
    if (typeof firebase === 'undefined' || !firebase.firestore) return false;
    const db = firebase.firestore();
    if (firebase.firestore.FieldValue) payload._createdAt = firebase.firestore.FieldValue.serverTimestamp();
    await db.collection('reservas').add(payload);
    return true;
  }

  /* ---------- Auth wall ---------- */
  function setAuthUI(logged, user){
    const form = $('bookingForm');
    const wall = $('authWall');
    if(form) form.classList.toggle('disabled', !logged);
    if(wall) wall.style.display = logged ? 'none' : 'block';
    if(logged && user && user.email){
      const email = $('email'); if (email && !email.value) email.value = user.email;
      const name  = $('firstName');
      if (user.displayName && name && !name.value){
        const dn = String(user.displayName).trim();
        name.value = dn.split(' ')[0] || dn;
      }
    }
  }
  function attachAuthWall(){
    if (typeof firebase === 'undefined' || !firebase.auth) return;
    const auth = firebase.auth();
    auth.onAuthStateChanged((u)=> setAuthUI(!!u && !u.isAnonymous, u||null));
    if (auth.onIdTokenChanged) auth.onIdTokenChanged((u)=> setAuthUI(!!u && !u.isAnonymous, u||null));
    // Fallback por si tarda en hidratar
    let tries = 0;
    const iv = setInterval(()=>{
      const u = auth.currentUser;
      if (u){ setAuthUI(!u.isAnonymous, u); clearInterval(iv); }
      if (++tries > 20) clearInterval(iv);
    }, 150);
  }

  /* ---------- Helpers ---------- */
  function buildSummary(){
    const svcSel = $('service');
    const svcTxt = svcSel ? (svcSel.options[svcSel.selectedIndex]?.text || '') : '';
    return [
      `Servicio: ${svcTxt}`,
      `Fechas: ${$('startDate')?.value || '-'} a ${$('endDate')?.value || '-'}`,
      `Hora: ${$('start')?.value || '-'} a ${$('end')?.value || '-'}`,
      `Nombre: ${$('firstName')?.value || ''} ${$('lastName')?.value || ''}`,
      `Email/Tel: ${$('email')?.value || ''} / ${$('phone')?.value || ''}`
    ].join(' | ');
  }
  function validateRequired(){
    const ids = ['service','startDate','endDate','start','end','firstName','lastName','email','phone'];
    const missing = ids.filter(id => !String($(id)?.value||'').trim());
    return { ok: missing.length===0, missing };
  }

  /* ---------- Init ---------- */
  document.addEventListener('DOMContentLoaded', function(){
    attachAuthWall();

    const form = $('bookingForm');
    if(!form) return;

    form.addEventListener('submit', async function(e){
      e.preventDefault();

      const auth = (typeof firebase !== 'undefined' && firebase.auth) ? firebase.auth() : null;
      const u = auth && auth.currentUser;
      if(!u || u.isAnonymous){
        showErrorOverlay('Para enviar la reserva debes iniciar sesión.');
        return;
      }

      const check = validateRequired();
      if(!check.ok){
        const first = $(check.missing[0]); if(first) first.focus();
        showErrorOverlay('Faltan campos obligatorios por completar.');
        return;
      }

      // Añadimos un desglose similar al que usas
      const summaryField = $('summaryField');
      if(summaryField) summaryField.value = buildSummary();

      // Construimos payload para Firestore (opcional)
      const fd = new FormData(form);
      const payload = Object.fromEntries(fd.entries());
      payload._tipo   = 'reserva';
      payload._estado = 'enviada';
      payload._page   = location.href;
      payload._uid    = u.uid;
      payload._email  = u.email || null;

      // Deshabilitar botón durante el envío
      const btn = form.querySelector('.cta-button, [type="submit"]');
      if (btn){ btn.disabled = true; btn.dataset._old = btn.textContent; btn.textContent = 'Enviando…'; }

      try{
        // Guardado opcional
        try{ await saveToFirestore(payload); }catch(_){ /* no bloquea */ }

        // **ENVÍO EXACTO COMO CANDIDATURAS**
        await sendEmailJS_likeCandidaturas(form);

        showSuccessOverlay(
          form.dataset.tplSuccess || 'Tu solicitud se ha enviado correctamente.',
          form.dataset.tplRedirect || 'perfil.html'
        );
        try{ form.reset(); }catch(_){}

      }catch(err){
        console.error('[TPL][reservas] EmailJS error:', err);
        showErrorOverlay(
          'No se pudo enviar la solicitud (correo). Revisa que este dominio esté permitido en EmailJS.',
          err
        );
      }finally{
        if (btn){ btn.disabled = false; btn.textContent = btn.dataset._old || 'Enviar'; }
      }
    });
  });
})();
