<!-- Archivo: tpl-emailjs.js -->
<script>
(() => {
  'use strict';

  const STYLE_ID = 'tpl-feedback-modal-css';
  const EMAILJS_URL = 'https://cdn.jsdelivr.net/npm/@emailjs/browser@4/dist/email.min.js';

  function injectStyles() {
    if (document.getElementById(STYLE_ID)) return;
    const css = `
      .tpl-modal-backdrop{position:fixed;inset:0;background:rgba(0,0,0,.45);display:flex;align-items:center;justify-content:center;z-index:9999}
      .tpl-modal{background:#fff;border-radius:14px;max-width:520px;width:92%;box-shadow:0 10px 30px rgba(0,0,0,.2);padding:20px}
      .tpl-modal h3{margin:0 0 6px;color:var(--tpl-ink,#58425a);font-size:1.25rem}
      .tpl-modal p{margin:0 0 14px;color:#444}
      .tpl-modal .tpl-actions{display:flex;justify-content:flex-end;gap:10px;margin-top:12px}
      .tpl-btn{appearance:none;border:none;border-radius:999px;padding:10px 16px;font-weight:600;cursor:pointer}
      .tpl-btn--primary{background:var(--tpl-primary,#339496);color:#fff}
      .tpl-btn--ghost{background:#f3f5f7;color:#222}
    `;
    const style = document.createElement('style');
    style.id = STYLE_ID;
    style.textContent = css;
    document.head.appendChild(style);
  }

  function showModal({title='Todo listo', message='Gracias. Hemos recibido tu solicitud.', ctaText='Aceptar', redirect}) {
    injectStyles();
    const backdrop = document.createElement('div');
    backdrop.className = 'tpl-modal-backdrop';
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
    const close = () => {
      backdrop.remove();
      if (redirect) location.href = redirect;
    };
    btn.addEventListener('click', close);
    backdrop.addEventListener('click', (e) => { if (e.target === backdrop) close(); });
    document.addEventListener('keydown', function esc(e){ if(e.key==='Escape'){ document.removeEventListener('keydown', esc); close(); }});
    btn.focus();
  }

  function loadEmailJS(publicKey) {
    return new Promise((resolve, reject) => {
      if (window.emailjs && window.emailjs.sendForm) {
        try { if (publicKey) window.emailjs.init({ publicKey }); } catch(e){}
        return resolve(window.emailjs);
      }
      const s = document.createElement('script');
      s.src = EMAILJS_URL;
      s.onload = () => {
        try { if (publicKey) window.emailjs.init({ publicKey }); } catch(e){}
        resolve(window.emailjs);
      };
      s.onerror = () => reject(new Error('No se pudo cargar EmailJS'));
      document.head.appendChild(s);
    });
  }

  function buildHTMLFromForm(form) {
    const fd = new FormData(form);
    const rows = [];
    const seen = new Set();
    fd.forEach((val, key) => {
      if (seen.has(key)) return;
      seen.add(key);
      const els = form.querySelectorAll(`[name="${(window.CSS && CSS.escape)?CSS.escape(key):key}"]`);
      let label = '';
      if (els[0]) {
        const id = els[0].id;
        if (id) {
          const lab = form.querySelector(`label[for="${(window.CSS && CSS.escape)?CSS.escape(id):id}"]`);
          if (lab) label = lab.textContent.trim();
        }
      }
      const prettyKey = label || key.replace(/[_-]+/g,' ').replace(/\b\w/g, c=>c.toUpperCase());
      const vals = [];
      fd.getAll(key).forEach(v=>{
        if (v instanceof File) {
          if (v.name) vals.push(`Archivo: ${v.name}`);
        } else {
          vals.push(String(v).trim());
        }
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

  function attachToForms(){
    const forms = document.querySelectorAll('form[data-tpl-emailjs="true"]');
    forms.forEach(form=>{
      if (form.__tplBound) return;
      form.__tplBound = true;
      form.addEventListener('submit', async (ev)=>{
        ev.preventDefault();
        const ds = form.dataset;
        const publicKey = ds.publicKey || (window.__TPL_EMAILJS && window.__TPL_EMAILJS.publicKey);
        const serviceId = ds.serviceId || (window.__TPL_EMAILJS && window.__TPL_EMAILJS.serviceId);
        const templateId = ds.templateId || (window.__TPL_EMAILJS && window.__TPL_EMAILJS.templateId);
        if (!serviceId || !templateId || !publicKey) {
          console.warn('TPL EmailJS: faltan IDs. Asegúrate de configurar data-service-id, data-template-id y data-public-key o window.__TPL_EMAILJS');
          showModal({
            title: 'Configuración incompleta',
            message: 'Faltan claves de EmailJS en este formulario. Revisa la configuración.',
            ctaText: 'Entendido'
          });
          return;
        }
        const type = (ds.type || '').toLowerCase();
        const subject = ds.subject || (type ? `Nueva ${type} — The Pets Lovers` : `Nuevo envío — The Pets Lovers`);
        const success = ds.success || (type === 'reserva'
          ? '¡Reserva enviada! Te contactaremos para la visita gratuita.'
          : type === 'cuestionario'
            ? '¡Candidatura enviada! Te avisaremos por email.'
            : '¡Enviado! Gracias por tu confianza.'
        );
        const cta = ds.cta || (type === 'reserva' ? 'Ir a mi perfil' : 'Volver al inicio');
        const redirect = ds.redirect || (type === 'reserva' ? 'perfil.html' : 'index.html');

        const submits = form.querySelectorAll('[type="submit"]');
        submits.forEach(b=>{ b.disabled = true; b.dataset._oldText = b.textContent; b.textContent = 'Enviando…'; });

        try{
          await loadEmailJS(publicKey);

          const html = buildHTMLFromForm(form);
          const hiddenHtml = document.createElement('input');
          hiddenHtml.type = 'hidden';
          hiddenHtml.name = 'message_html';
          hiddenHtml.value = html;

          const hiddenSubject = document.createElement('input');
          hiddenSubject.type = 'hidden';
          hiddenSubject.name = 'subject';
          hiddenSubject.value = subject;

          form.appendChild(hiddenHtml);
          form.appendChild(hiddenSubject);

          await window.emailjs.sendForm(serviceId, templateId, form);

          hiddenHtml.remove();
          hiddenSubject.remove();

          form.reset();
          showModal({ title: '¡Listo!', message: success, ctaText: cta, redirect });

        } catch(err){
          console.error('TPL EmailJS error:', err);
          showModal({
            title: 'No se pudo enviar',
            message: 'Ha ocurrido un error al enviar el formulario. Revisa tu conexión e inténtalo de nuevo.',
            ctaText: 'Cerrar'
          });
        } finally {
          submits.forEach(b=>{ b.disabled = false; if (b.dataset._oldText) b.textContent = b.dataset._oldText; });
        }
      });
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', attachToForms);
  } else {
    attachToForms();
  }
  new MutationObserver(attachToForms).observe(document.documentElement, {childList:true, subtree:true});
})();
</script>

