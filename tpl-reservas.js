/* TPL: INICIO BLOQUE NUEVO [Lógica reservas desde cero] */
(function(){
  // Helpers
  const $ = (id) => document.getElementById(id);
  const currency = (n) => (Math.round((n || 0) * 100) / 100).toFixed(2);

  // Overlays
  function ensureOverlay(){
    let wrap = document.getElementById('tpl-overlay');
    if(!wrap){
      wrap = document.createElement('div');
      wrap.id = 'tpl-overlay';
      wrap.className = 'tpl-overlay';
      wrap.innerHTML = '<div class="tpl-modal" role="dialog" aria-live="polite"><p></p><pre id="tpl-err-detail" style="display:none;white-space:pre-wrap;text-align:left;font-size:.9rem;background:#f7f7f7;padding:8px;border-radius:8px;max-height:200px;overflow:auto"></pre><button type="button" class="cta-button" id="tpl-ov-action">Aceptar</button></div>';
      document.body.appendChild(wrap);
    }
    return wrap;
  }
  function showSuccessOverlay(msg, redirect){
    const wrap = ensureOverlay();
    wrap.querySelector('p').textContent = msg || 'Tu solicitud se ha enviado correctamente.';
    const det = wrap.querySelector('#tpl-err-detail'); det.style.display='none'; det.textContent = '';
    wrap.classList.add('on');
    const btn = wrap.querySelector('#tpl-ov-action');
    btn.textContent = 'Ir a mi perfil';
    btn.onclick = () => { location.href = redirect || 'perfil.html'; };
  }
  function showErrorOverlay(msg, detail){
    const wrap = ensureOverlay();
    wrap.querySelector('p').textContent = msg || 'No se pudo enviar la solicitud.';
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

  // EmailJS
  async function sendEmailJS(fd, extra){
    if(!window.emailjs) return false;
    const cfg = window.TPL_EMAILJS || {};
    const service  = cfg.serviceId || cfg.service;
    const template = cfg.templateId || (cfg.templates && (cfg.templates.reserva || cfg.templates.booking));
    const pubKey   = cfg.publicKey || cfg.userId;
    if(!service || !template){
      console.warn('EmailJS: falta serviceId/templateId');
      return false;
    }
    const payload = Object.fromEntries(fd.entries());
    Object.assign(payload, extra || {});
    if (pubKey) { await emailjs.send(service, template, payload, pubKey); }
    else { await emailjs.send(service, template, payload); }
    return true;
  }

  // Firestore
  async function saveToFirestore(payload){
    if (typeof firebase === 'undefined' || !firebase.firestore) return false;
    const db = firebase.firestore();
    if (firebase.firestore.FieldValue) payload._createdAt = firebase.firestore.FieldValue.serverTimestamp();
    await db.collection('reservas').add(payload);
    return true;
  }

  // Login inline (email/contraseña + Google)
  function renderInlineLogin(){
    const host = $('tpl-inline-login'); if(!host) return;
    host.innerHTML = `
      <form id="tpl-login-form" class="tpl-login-form" style="display:grid;gap:8px;max-width:420px;margin:10px auto 0">
        <input type="email" name="email" placeholder="Email" required autocomplete="email" style="padding:10px 12px;border:1px solid #ddd;border-radius:10px">
        <input type="password" name="password" placeholder="Contraseña" required autocomplete="current-password" style="padding:10px 12px;border:1px solid #ddd;border-radius:10px">
        <button type="submit" class="tpl-btn">Iniciar sesión</button>
        <button type="button" id="tpl-google" class="tpl-btn-outline">Continuar con Google</button>
        <div id="tpl-login-msg" style="text-align:center;color:#58425a;min-height:1.2em"></div>
      </form>
    `;
    const form = $('tpl-login-form');
    const msg  = $('tpl-login-msg');
    const btnG = $('tpl-google');
    if (typeof firebase !== 'undefined') {
      const auth = firebase.auth();
      form.addEventListener('submit', async (e)=>{
        e.preventDefault();
        msg.textContent = 'Accediendo…';
        try{
          await auth.signInWithEmailAndPassword(form.email.value.trim(), form.password.value);
          msg.textContent = '¡Listo!';
          location.reload();
        }catch(err){ msg.textContent = err && err.message || 'No se pudo iniciar sesión.'; }
      });
      btnG.addEventListener('click', async ()=>{
        msg.textContent = 'Conectando con Google…';
        try{
          const provider = new firebase.auth.GoogleAuthProvider();
          await auth.signInWithPopup(provider);
        }catch(err){ msg.textContent = err && err.message || 'No se pudo iniciar con Google.'; }
      });
    }
  }

  // Resumen simple para el email
  function buildSummary(){
    const lines = [];
    const svcSel = $('service');
    const svcTxt = svcSel ? (svcSel.options[svcSel.selectedIndex]?.text || '') : '';
    lines.push(`Servicio: ${svcTxt}`);
    lines.push(`Fechas: ${$('startDate')?.value || '-'} a ${$('endDate')?.value || '-'}`);
    lines.push(`Hora: ${$('start')?.value || '-'} a ${$('end')?.value || '-'}`);
    lines.push(`Nombre: ${$('firstName')?.value || ''} ${$('lastName')?.value || ''}`);
    lines.push(`Email/Tel: ${$('email')?.value || ''} / ${$('phone')?.value || ''}`);
    return lines.join(' | ');
  }

  // Validación mínima
  function validateRequired(){
    const ids = ['service','startDate','endDate','start','end','firstName','lastName','email','phone'];
    const missing = ids.filter(id => !String($(id)?.value||'').trim());
    return { ok: missing.length===0, missing };
  }

  // Estado UI por auth
  function attachAuthWall(){
    if (typeof firebase === 'undefined' || !firebase.auth) return;
    const form = $('bookingForm');
    const wall = $('authWall');
    const auth = firebase.auth();
    const onChange = (u)=>{
      const logged = !!u;
      if(form){ form.classList.toggle('disabled', !logged); }
      if(wall){ wall.style.display = logged ? 'none' : 'block'; if(!logged) renderInlineLogin(); }
    };
    auth.onAuthStateChanged(onChange);
  }

  // Inicialización
  document.addEventListener('DOMContentLoaded', function(){
    attachAuthWall();

    const form = $('bookingForm');
    if(!form) return;

    // Rellena SummaryField antes de enviar
    form.addEventListener('submit', async function(e){
      e.preventDefault();

      const auth = (typeof firebase !== 'undefined' && firebase.auth) ? firebase.auth() : null;
      const u = auth && auth.currentUser;
      if(!u){ showErrorOverlay('Para enviar la reserva debes iniciar sesión.'); return; }

      const check = validateRequired();
      if(!check.ok){
        const first = $(check.missing[0]); if(first) first.focus();
        showErrorOverlay('Faltan campos obligatorios por completar.');
        return;
      }

      // Construye summary para el correo
      const summary = buildSummary();
      const summaryField = $('summaryField');
      if(summaryField) summaryField.value = summary;

      const fd = new FormData(form);
      // Payload Firestore
      const payload = Object.fromEntries(fd.entries());
      payload._tipo = 'reserva';
      payload._estado = 'enviada';
      payload._page = location.href;
      payload._uid = u.uid;
      payload._email = u.email || null;

      // Envíos (intentamos ambos, pero con que 1 funcione, mostramos éxito)
      let emailOk = false, fsOk = false, lastErr = null;
      try{
        // Firestore (opcional: si falla, seguimos)
        try{ fsOk = await saveToFirestore(payload); }catch(errFs){ fsOk = false; lastErr = errFs; }
        // EmailJS
        try{ emailOk = await sendEmailJS(fd, { _tipo:'reserva', _estado:'enviada', _page: location.href }); }
        catch(errMail){ emailOk = false; lastErr = errMail; }

        if (emailOk || fsOk){
          showSuccessOverlay(form.dataset.tplSuccess || 'Tu solicitud se ha enviado correctamente.', form.dataset.tplRedirect || 'perfil.html');
        } else {
          showErrorOverlay('No se pudo enviar la solicitud (correo/servidor). Revisa el origen permitido en EmailJS y la sesión.', lastErr);
        }
      }catch(err){
        showErrorOverlay('Ocurrió un error inesperado al enviar la solicitud.', err);
      }
    });
  });
})();
/* TPL: FIN BLOQUE NUEVO */
