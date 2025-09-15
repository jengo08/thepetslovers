/* reservas.js — envío con EmailJS usando template_rao5n0c (con to_email explícito) */
(function(){
  'use strict';

  // ========= UTIL =========
  const $ = (id) => document.getElementById(id);
  function sel(q,root){ return (root||document).querySelector(q); }

  // Destino por defecto (puedes cambiarlo aquí si algún día lo necesitas)
  const DEFAULT_TO_EMAIL = 'gestion@thepetslovers.es';
  const DEFAULT_TO_NAME  = 'Gestión The Pets Lovers';

  // Lee config global ya definida en reservas.html
  const EJ = (function(){
    const cfg = window.TPL_EMAILJS || {};
    return {
      serviceId: cfg.serviceId || 'service_odjqrfl',
      templateId: cfg.templateId || 'template_rao5n0c',
      publicKey:  cfg.publicKey  || 'L2xAATfVuHJwj4EIV',
      toEmail:    cfg.toEmail    || DEFAULT_TO_EMAIL,
      toName:     cfg.toName     || DEFAULT_TO_NAME,
    };
  })();

  // ========= OVERLAY =========
  function ensureOverlay(){
    let wrap = $('tpl-overlay');
    if(!wrap){
      wrap = document.createElement('div');
      wrap.id = 'tpl-overlay';
      wrap.className = 'tpl-overlay';
      wrap.innerHTML = `
        <div class="tpl-modal" role="dialog" aria-live="polite">
          <p id="tpl-ov-text" style="margin:0 0 12px"></p>
          <pre id="tpl-err-detail" style="display:none;white-space:pre-wrap;text-align:left;font-size:.9rem;background:#f7f7f7;padding:8px;border-radius:8px;max-height:200px;overflow:auto"></pre>
          <button type="button" class="cta-button" id="tpl-ov-action">Aceptar</button>
        </div>`;
      document.body.appendChild(wrap);
    }
    return wrap;
  }
  function showSuccessOverlay(msg, redirect){
    const wrap = ensureOverlay();
    sel('#tpl-ov-text',wrap).textContent = msg || 'Tu solicitud se ha enviado correctamente.';
    const det = sel('#tpl-err-detail',wrap); det.style.display='none'; det.textContent='';
    wrap.classList.add('on');
    const btn = sel('#tpl-ov-action',wrap);
    btn.textContent = 'Ir a mi perfil';
    btn.onclick = () => { location.href = redirect || 'perfil.html'; };
  }
  function showErrorOverlay(msg, detail){
    const wrap = ensureOverlay();
    sel('#tpl-ov-text',wrap).textContent = msg || 'No se pudo enviar la solicitud.';
    const det = sel('#tpl-err-detail',wrap);
    if (detail){ det.style.display='block'; det.textContent = String(detail); }
    else { det.style.display='none'; det.textContent=''; }
    wrap.classList.add('on');
    const btn = sel('#tpl-ov-action',wrap);
    btn.textContent = 'Cerrar';
    btn.onclick = () => { wrap.classList.remove('on'); };
  }

  // ========= BUILDERS =========
  function serviceLabel(){
    const s = $('service');
    if (!s) return '';
    const opt = s.options[s.selectedIndex];
    return (opt && opt.text) ? opt.text.trim() : '';
  }
  function buildSummary(){
    return [
      `Servicio: ${serviceLabel()}`,
      `Fechas: ${$('startDate')?.value || '-'} a ${$('endDate')?.value || '-'}`,
      `Hora: ${$('start')?.value || '-'} a ${$('end')?.value || '-'}`,
      `Nombre: ${$('firstName')?.value || ''} ${$('lastName')?.value || ''}`,
      `Email/Tel: ${$('email')?.value || ''} / ${$('phone')?.value || ''}`
    ].join(' | ');
  }
  function buildHtmlTable(fd){
    const rows = [];
    for (const [k,v] of fd.entries()){
      if (k === 'Desglose') continue;
      const label = ({
        Servicio:'Servicio', Fecha_inicio:'Fecha inicio', Fecha_fin:'Fecha fin',
        Hora_inicio:'Hora inicio', Hora_fin:'Hora fin',
        Nombre:'Nombre', Apellidos:'Apellidos', Email:'Email', Telefono:'Teléfono', Notas:'Notas'
      })[k] || k.replace(/[_-]+/g,' ');
      rows.push(
        `<tr>
           <th align="left" style="padding:6px 8px;border-bottom:1px solid #eee">${label}</th>
           <td style="padding:6px 8px;border-bottom:1px solid #eee">${String(v||'-')}</td>
         </tr>`
      );
    }
    return `
      <div style="font-family:system-ui,-apple-system,Segoe UI,Roboto,Ubuntu,'Helvetica Neue',Arial,sans-serif;line-height:1.45;color:#222">
        <p><strong>Nueva reserva rápida — The Pets Lovers</strong></p>
        <table width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;margin-top:8px">
          ${rows.join('')}
        </table>
      </div>`;
  }

  // ========= EMAILJS SEND =========
  async function ensureEmailJS(){
    if (window.emailjs && window.emailjs.send) return window.emailjs;
    await new Promise((res,rej)=>{
      const s = document.createElement('script');
      s.src = 'https://cdn.jsdelivr.net/npm/@emailjs/browser@4/dist/email.min.js';
      s.onload = res; s.onerror = ()=>rej(new Error('No se pudo cargar EmailJS'));
      document.head.appendChild(s);
    });
    return window.emailjs;
  }

  async function sendBookingWithEmailJS(form){
    const fd = new FormData(form);

    // rellena el campo de desglose para el correo
    const summary = buildSummary();
    const summaryField = $('summaryField');
    if (summaryField) summaryField.value = summary;
    fd.set('Desglose', summary);

    // arma payload que exige el template (incluimos destinatario)
    const payload = Object.fromEntries(fd.entries());
    Object.assign(payload, {
      to_email: EJ.toEmail,                  // ← CLAVE para evitar el 422
      to_name:  EJ.toName,
      reply_to: $('email')?.value || '',
      from_name: `${$('firstName')?.value||''} ${$('lastName')?.value||''}`.trim(),
      subject: 'Nueva reserva — The Pets Lovers',
      service_label: serviceLabel(),
      page_url: location.href,
      message_html: buildHtmlTable(fd)
    });

    const emailjs = await ensureEmailJS();
    try { emailjs.init({ publicKey: EJ.publicKey }); } catch(_){}

    // Usa .send (no sendForm) con el payload explícito
    const res = await emailjs.send(EJ.serviceId, EJ.templateId, payload, EJ.publicKey);
    return res;
  }

  // ========= FIRESTORE (opcional, si existe) =========
  async function saveToFirestore(payload){
    if (typeof firebase === 'undefined' || !firebase.firestore) return false;
    try{
      const db = firebase.firestore();
      if (firebase.firestore.FieldValue) payload._createdAt = firebase.firestore.FieldValue.serverTimestamp();
      await db.collection('reservas').add(payload);
      return true;
    }catch(_){
      return false;
    }
  }

  // ========= AUTH WALL (ya lo tienes en la página; aquí sólo comprobamos) =========
  function isLogged(){
    try{
      const a = firebase && firebase.auth && firebase.auth();
      const u = a && a.currentUser;
      return !!(u && !u.isAnonymous);
    }catch(_){ return false; }
  }

  // ========= INIT =========
  function attach(){
    const form = $('bookingForm');
    if (!form) return;

    // Muy importante: evita que el manejador genérico del navbar intercepte este formulario
    form.setAttribute('data-tpl-emailjs','false');

    form.addEventListener('submit', async function(e){
      e.preventDefault();

      // Valida nativo primero
      if (typeof form.reportValidity === 'function' && !form.reportValidity()){
        return;
      }

      // Exige sesión (tu UI ya bloquea sin login; esto es doble check)
      if (!isLogged()){
        showErrorOverlay('Para enviar la reserva debes iniciar sesión.');
        return;
      }

      // bloquea botón mientras envía
      const btn = form.querySelector('button[type="submit"], .cta-button');
      const btnText = btn ? btn.textContent : '';
      if (btn){ btn.disabled = true; btn.textContent = 'Enviando…'; }

      // payload para guardar (opcional)
      const fd = new FormData(form);
      const payloadForDb = Object.fromEntries(fd.entries());
      payloadForDb._tipo = 'reserva';
      payloadForDb._estado = 'enviada';
      payloadForDb._page = location.href;

      try{
        // 1) intentar guardar en Firestore (si está disponible)
        try { await saveToFirestore(payloadForDb); } catch(_){}

        // 2) enviar por EmailJS (con to_email) usando template_rao5n0c
        await sendBookingWithEmailJS(form);

        showSuccessOverlay(
          form.dataset.tplSuccess || 'Tu solicitud se ha enviado correctamente.',
          form.dataset.tplRedirect || 'perfil.html'
        );
        try { form.reset(); } catch(_){}
      }catch(err){
        // Si ves 422 aquí, es porque el template no acepta destino dinámico; ajusta el template en EmailJS para usar {{to_email}} como destinatario
        console.error('Reservas EmailJS error:', err);
        const msg = (err && err.text) || (err && err.message) || 'No se pudo enviar la solicitud (correo/servidor).';
        showErrorOverlay(msg, JSON.stringify(err, null, 2));
      }finally{
        if (btn){ btn.disabled = false; btn.textContent = btnText; }
      }
    });
  }

  if (document.readyState === 'loading'){
    document.addEventListener('DOMContentLoaded', attach);
  } else {
    attach();
  }
})();
