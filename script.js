/* ===========================
   TPL: INICIO BLOQUE NUEVO [Modal de reservas inline + interceptar enlaces]
   =========================== */
(function () {
  const SERVICE_LABELS = {
    "guarderia-dia": "Guardería de día",
    "visitas": "Visitas a domicilio (gatos)",
    "alojamiento": "Alojamiento nocturno",
    "paseos": "Paseos",
    "transporte": "Transporte",
    "bodas": "Bodas",
    "postoperatorio": "Postoperatorio",
    "exoticos": "Exóticos"
  };

  // Inyectar estilos mínimos (no toca tu CSS)
  const css = `
  .tpl-modal{position:fixed;inset:0;z-index:9999;display:none}
  .tpl-modal[aria-hidden="false"]{display:block}
  .tpl-modal__backdrop{position:absolute;inset:0;background:rgba(0,0,0,.45)}
  .tpl-modal__dialog{position:relative;max-width:640px;margin:5vh auto;background:#fff;border-radius:12px;padding:18px;box-shadow:0 10px 30px rgba(0,0,0,.2)}
  .tpl-modal__header{display:flex;align-items:center;justify-content:space-between;gap:8px;margin-bottom:8px}
  .tpl-modal__title{font-size:1.1rem;font-weight:700;margin:0;color:var(--color-texto, #333)}
  .tpl-modal__close{appearance:none;border:none;background:#f3f3f3;border-radius:8px;padding:8px 10px;cursor:pointer}
  .tpl-modal__close:hover{background:#e9e9e9}
  .tpl-form{display:grid;gap:12px}
  @media (min-width:760px){.tpl-form{grid-template-columns:1fr 1fr}}
  .tpl-form .full{grid-column:1 / -1}
  .tpl-input,.tpl-select,.tpl-textarea{width:100%;padding:10px;border:1px solid #ddd;border-radius:8px;font:inherit}
  .tpl-submit{background:var(--color-principal,#339496);color:#fff;border:none;border-radius:8px;padding:12px 16px;font-weight:700;cursor:pointer}
  .tpl-submit:hover{background:#2a7e80}
  .tpl-help{font-size:.9rem;color:#555}
  `;
  const style = document.createElement('style');
  style.textContent = css;
  document.head.appendChild(style);

  <!-- TPL: INICIO BLOQUE NUEVO [Modal de reservas inline + interceptar enlaces — SOLO muestra duración y nº visitas en VISITAS GATOS] -->
<script>
(function () {
  const SERVICE_LABELS = {
    "guarderia-dia": "Guardería de día",
    "visitas": "Visitas a domicilio (gatos)",
    "alojamiento": "Alojamiento nocturno",
    "paseos": "Paseos",
    "transporte": "Transporte",
    "bodas": "Bodas",
    "postoperatorio": "Postoperatorio",
    "exoticos": "Exóticos"
  };

  // CSS mínimo del modal (no toca tu CSS global)
  const css = `
  .tpl-modal{position:fixed;inset:0;z-index:9999;display:none}
  .tpl-modal[aria-hidden="false"]{display:block}
  .tpl-modal__backdrop{position:absolute;inset:0;background:rgba(0,0,0,.45)}
  .tpl-modal__dialog{position:relative;max-width:640px;margin:5vh auto;background:#fff;border-radius:12px;padding:18px;box-shadow:0 10px 30px rgba(0,0,0,.2)}
  .tpl-modal__header{display:flex;align-items:center;justify-content:space-between;gap:8px;margin-bottom:8px}
  .tpl-modal__title{font-size:1.1rem;font-weight:700;margin:0;color:var(--color-texto, #333)}
  .tpl-modal__close{appearance:none;border:none;background:#f3f3f3;border-radius:8px;padding:8px 10px;cursor:pointer}
  .tpl-modal__close:hover{background:#e9e9e9}
  .tpl-form{display:grid;gap:12px}
  @media (min-width:760px){.tpl-form{grid-template-columns:1fr 1fr}}
  .tpl-form .full{grid-column:1 / -1}
  .tpl-input,.tpl-select,.tpl-textarea{width:100%;padding:10px;border:1px solid #ddd;border-radius:8px;font:inherit}
  .tpl-submit{background:var(--color-principal,#339496);color:#fff;border:none;border-radius:8px;padding:12px 16px;font-weight:700;cursor:pointer}
  .tpl-submit:hover{background:#2a7e80}
  .tpl-help{font-size:.9rem;color:#555}
  `;
  const style = document.createElement('style');
  style.textContent = css;
  document.head.appendChild(style);

  // HTML del modal (añadimos los grupos específicos de VISITAS GATOS)
  const modal = document.createElement('div');
  modal.className = 'tpl-modal';
  modal.id = 'tpl-modal-reserva';
  modal.setAttribute('aria-hidden', 'true');
  modal.innerHTML = `
    <div class="tpl-modal__backdrop" data-close></div>
    <div class="tpl-modal__dialog" role="dialog" aria-modal="true" aria-labelledby="tpl-modal-title">
      <div class="tpl-modal__header">
        <h3 class="tpl-modal__title" id="tpl-modal-title">Reserva rápida</h3>
        <button class="tpl-modal__close" type="button" aria-label="Cerrar" data-close>✕</button>
      </div>
      <form id="tpl-reserva-form" class="tpl-form" action="#" method="post" novalidate>
        <input type="hidden" id="tpl-servicio" name="servicio" value="">
        <div class="full">
          <label for="tpl-servicio-select">Servicio</label>
          <select id="tpl-servicio-select" class="tpl-select" required>
            <option value="" disabled selected>Selecciona un servicio</option>
            ${Object.entries(SERVICE_LABELS).map(([k,v]) => `<option value="${k}">${v}</option>`).join('')}
          </select>
        </div>

        <!-- SOLO para VISITAS GATOS -->
        <div id="tpl-visitas-block" class="full" style="display:none">
          <div class="tpl-form">
            <div>
              <label for="tpl-visitas-duracion">Duración de la visita (gatos)</label>
              <select id="tpl-visitas-duracion" name="visitas_duracion" class="tpl-select">
                <option value="60">60 minutos</option>
                <option value="90">90 minutos</option>
              </select>
            </div>
            <div>
              <label for="tpl-visitas-diarias">Visitas diarias</label>
              <select id="tpl-visitas-diarias" name="visitas_diarias" class="tpl-select">
                <option value="1">1 visita al día</option>
                <option value="2">2 visitas al día</option>
              </select>
              <small class="tpl-help">La 2ª visita del día es de medicación y se tarifica como tal.</small>
            </div>
          </div>
        </div>
        <!-- FIN SOLO VISITAS GATOS -->

        <div>
          <label for="tpl-fecha">Fecha</label>
          <input type="date" id="tpl-fecha" name="fecha" class="tpl-input" required>
        </div>
        <div>
          <label for="tpl-hora">Hora estimada</label>
          <input type="time" id="tpl-hora" name="hora" class="tpl-input" required>
        </div>
        <div>
          <label for="tpl-nombre">Tu nombre</label>
          <input type="text" id="tpl-nombre" name="nombre" class="tpl-input" placeholder="Nombre y apellidos" required>
        </div>
        <div>
          <label for="tpl-telefono">Teléfono</label>
          <input type="tel" id="tpl-telefono" name="telefono" class="tpl-input" inputmode="tel" placeholder="+34 ..." required>
        </div>
        <div class="full">
          <label for="tpl-direccion">Dirección (si aplica)</label>
          <input type="text" id="tpl-direccion" name="direccion" class="tpl-input" placeholder="Calle, nº, localidad">
        </div>
        <div class="full">
          <label for="tpl-notas">Notas</label>
          <textarea id="tpl-notas" name="notas" class="tpl-textarea" rows="3" placeholder="Hábitos, medicación, pautas del adiestrador..."></textarea>
        </div>
        <div class="full" style="display:flex;gap:10px;align-items:center;flex-wrap:wrap">
          <button type="submit" class="tpl-submit">Enviar solicitud</button>
          <span class="tpl-help">Al enviar, te contactaremos para confirmar disponibilidad y el/la cuidador/a más adecuado/a.</span>
        </div>
      </form>
    </div>
  `;
  document.body.appendChild(modal);

  const els = {
    modal,
    closeBtn: modal.querySelector('.tpl-modal__close'),
    form: modal.querySelector('#tpl-reserva-form'),
    servicioHidden: modal.querySelector('#tpl-servicio'),
    servicioSelect: modal.querySelector('#tpl-servicio-select'),
    fecha: modal.querySelector('#tpl-fecha'),
    hora: modal.querySelector('#tpl-hora'),
    title: modal.querySelector('#tpl-modal-title'),
    visitasBlock: modal.querySelector('#tpl-visitas-block')
  };

  function setMinDateToday() {
    const t = new Date();
    els.fecha.min = `${t.getFullYear()}-${String(t.getMonth()+1).padStart(2,'0')}-${String(t.getDate()).padStart(2,'0')}`;
  }
  function roundTimeToNextQuarter() {
    const d = new Date();
    d.setMinutes(d.getMinutes() + (15 - (d.getMinutes()%15))%15, 0, 0);
    els.hora.value = d.toTimeString().slice(0,5);
  }
  function labelFromKey(key) { return SERVICE_LABELS[key] || key || 'Servicio'; }

  // Mostrar/ocultar campos exclusivos de VISITAS GATOS
  function syncVisitFields() {
    const isVisitas = (els.servicioSelect.value === 'visitas');
    if (els.visitasBlock) els.visitasBlock.style.display = isVisitas ? 'block' : 'none';
  }

  function preselectService(key) {
    if (!key) return;
    els.servicioHidden.value = key;
    els.servicioSelect.value = key;
    els.title.textContent = `Reserva rápida — ${labelFromKey(key)}`;
    syncVisitFields();
  }

  function openModal(key) {
    preselectService(key);
    setMinDateToday();
    roundTimeToNextQuarter();
    modal.setAttribute('aria-hidden','false');
    setTimeout(()=> els.servicioSelect.focus(), 0);
    document.documentElement.style.overflow = 'hidden';
  }
  function closeModal() {
    modal.setAttribute('aria-hidden','true');
    document.documentElement.style.overflow = '';
  }

  modal.addEventListener('click', (e)=>{
    if (e.target.matches('[data-close]')) closeModal();
  });
  els.closeBtn.addEventListener('click', closeModal);
  document.addEventListener('keydown', (e)=>{
    if (e.key === 'Escape' && modal.getAttribute('aria-hidden') === 'false') closeModal();
  });

  // Cambio de servicio => sincroniza campos VISITAS
  els.servicioSelect.addEventListener('change', syncVisitFields);

  // Submit (placeholder; integra Formspree/EmailJS si quieres)
  els.form.addEventListener('submit', (e)=>{
    e.preventDefault();
    const data = Object.fromEntries(new FormData(els.form).entries());
    console.log('Solicitud de reserva enviada:', data);
    alert('¡Gracias! Hemos recibido tu solicitud. Te contactaremos para confirmar.');
    closeModal();
    els.form.reset();
    syncVisitFields();
  });

  // Global para abrir desde botones: onclick="abrirReserva('guarderia-dia')"
  window.abrirReserva = function(key){ openModal(key); };

  // Intercepta enlaces a #reserva-rapida o reserva.html[?servicio=...]
  document.addEventListener('click', function(e){
    const a = e.target.closest('a'); if (!a) return;

    if (a.getAttribute('href') === '#reserva-rapida') {
      e.preventDefault(); openModal('guarderia-dia'); return;
    }

    const href = a.getAttribute('href') || '';
    if (href.startsWith('reserva.html')) {
      e.preventDefault();
      const params = new URLSearchParams((href.split('?')[1]||''));
      const key = params.get('servicio') || guessServiceFromContext(a);
      openModal(key || '');
    }
  });

  function guessServiceFromContext(anchor) {
    const card = anchor.closest('.service-card');
    const h3 = card ? card.querySelector('h3') : null;
    const txt = (h3 ? h3.textContent : '').toLowerCase();
    if (txt.includes('guardería')) return 'guarderia-dia';
    if (txt.includes('visitas')) return 'visitas';
    if (txt.includes('alojamiento')) return 'alojamiento';
    if (txt.includes('paseos')) return 'paseos';
    if (txt.includes('transporte')) return 'transporte';
    if (txt.includes('bodas')) return 'bodas';
    if (txt.includes('post')) return 'postoperatorio';
    if (txt.includes('exót') || txt.includes('exot')) return 'exoticos';
    return '';
  }

  // Auto-abrir si ya viene ?servicio= en la URL actual
  (function autoOpenFromQuery(){
    try {
      const params = new URLSearchParams(location.search);
      const key = params.get('servicio');
      if (key) openModal(key);
    } catch(e){}
  })();
})();
</script>
<!-- TPL: FIN BLOQUE NUEVO -->


  // ====== TPL: INICIO BLOQUE NUEVO [Campos SOLO para "visitas"] ======
  function ensureVisitFields(show){
    const existing = {
      dur: document.getElementById('tpl-visita-duracion'),
      per: document.getElementById('tpl-visitas-dia')
    };
    if (show){
      // crear si no existen
      if (!existing.dur){
        const wrap = document.createElement('div');
        wrap.className = 'full';
        wrap.id = 'tpl-visita-duracion';
        wrap.innerHTML = `
          <label for="tpl-visit-duration">Duración de la visita (gatos)</label>
          <select id="tpl-visit-duration" name="duracion_visita" class="tpl-select" required>
            <option value="60" selected>60 minutos</option>
            <option value="90">90 minutos</option>
          </select>
        `;
        els.anchorVisitas.after(wrap);
      }
      if (!existing.per){
        const wrap2 = document.createElement('div');
        wrap2.className = 'full';
        wrap2.id = 'tpl-visitas-dia';
        wrap2.innerHTML = `
          <label for="tpl-visit-perday">Visitas diarias</label>
          <select id="tpl-visit-perday" name="visitas_diarias" class="tpl-select" required>
            <option value="1" selected>1 visita/día</option>
            <option value="2">2 visitas/día (2ª es medicación)</option>
          </select>
        `;
        const anchor = document.getElementById('tpl-visita-duracion') || els.anchorVisitas;
        anchor.after(wrap2);
      }
    }else{
      // quitar si existen
      if (existing.dur) existing.dur.remove();
      if (existing.per) existing.per.remove();
    }
  }
  // ====== TPL: FIN BLOQUE NUEVO ======

  function setMinDateToday() {
    const today = new Date();
    const yyyy = today.getFullYear();
    const mm = String(today.getMonth()+1).padStart(2,'0');
    const dd = String(today.getDate()).padStart(2,'0');
    els.fecha.min = `${yyyy}-${mm}-${dd}`;
  }

  function roundTimeToNextQuarter() {
    const d = new Date();
    d.setMinutes(d.getMinutes() + (15 - (d.getMinutes()%15))%15, 0, 0);
    els.hora.value = d.toTimeString().slice(0,5);
  }

  function labelFromKey(key) {
    return SERVICE_LABELS[key] || key || 'Servicio';
  }

  function preselectService(key) {
    if (!key) return;
    els.servicioHidden.value = key;
    els.servicioSelect.value = key;
    els.title.textContent = `Reserva rápida — ${labelFromKey(key)}`;

    // TPL: SOLO mostrar campos de visitas si el servicio es "visitas"
    ensureVisitFields(key === 'visitas');
  }

  function openModal(key) {
    preselectService(key);
    setMinDateToday();
    roundTimeToNextQuarter();
    els.modal.setAttribute('aria-hidden','false');
    // foco
    setTimeout(()=> els.servicioSelect.focus(), 0);
    // bloquear scroll de fondo
    document.documentElement.style.overflow = 'hidden';
  }

  function closeModal() {
    els.modal.setAttribute('aria-hidden','true');
    document.documentElement.style.overflow = '';
  }

  // Cerrar con click en fondo o botón
  modal.addEventListener('click', (e)=>{
    if (e.target.matches('[data-close]')) closeModal();
  });
  els.closeBtn.addEventListener('click', closeModal);
  // Cerrar con ESC
  document.addEventListener('keydown', (e)=>{
    if (e.key === 'Escape' && modal.getAttribute('aria-hidden') === 'false') {
      closeModal();
    }
  });

  // Cambio de servicio dentro del modal → toggle de campos
  els.servicioSelect.addEventListener('change', ()=>{
    ensureVisitFields(els.servicioSelect.value === 'visitas');
  });

  // Manejo submit (placeholder). Aquí podrás conectar Formspree/EmailJS.
  els.form.addEventListener('submit', (e)=>{
    e.preventDefault();
    const data = Object.fromEntries(new FormData(els.form).entries());
    // TODO: integrar con Formspree/EmailJS si quieres
    console.log('Solicitud de reserva enviada:', data);
    alert('¡Gracias! Hemos recibido tu solicitud. Te contactaremos para confirmar.');
    closeModal();
    els.form.reset();
    ensureVisitFields(false);
  });

  // Exponer función global por si la quieres usar en botones: onclick="abrirReserva('guarderia-dia')"
  window.abrirReserva = function(key){ openModal(key); };

  // Interceptar ENLACES a reserva.html o #reserva-rapida y abrir modal
  document.addEventListener('click', function(e){
    const a = e.target.closest('a');
    if (!a) return;

    // 1) #reserva-rapida (antiguo comportamiento)
    if (a.getAttribute('href') === '#reserva-rapida') {
      e.preventDefault();
      openModal('guarderia-dia'); // por defecto
      return;
    }

    // 2) Links a reserva.html (con o sin ?servicio=)
    const href = a.getAttribute('href') || '';
    if (href.startsWith('reserva.html')) {
      e.preventDefault();
      // intentar leer ?servicio=xxx
      const q = href.split('?')[1] || '';
      const params = new URLSearchParams(q);
      const key = params.get('servicio') || guessServiceFromContext(a) || 'guarderia-dia';
      openModal(key);
    }
  });

  // Si no llega ?servicio=, intentamos deducirlo mirando el contexto (título de tarjeta, etc.)
  function guessServiceFromContext(anchor) {
    const card = anchor.closest('.service-card');
    const h3 = card ? card.querySelector('h3') : null;
    const txt = (h3 ? h3.textContent : '').toLowerCase();
    if (txt.includes('guardería')) return 'guarderia-dia';
    if (txt.includes('visitas')) return 'visitas';
    if (txt.includes('alojamiento')) return 'alojamiento';
    if (txt.includes('paseos')) return 'paseos';
    if (txt.includes('transporte')) return 'transporte';
    if (txt.includes('bodas')) return 'bodas';
    if (txt.includes('post')) return 'postoperatorio';
    if (txt.includes('exót') || txt.includes('exot')) return 'exoticos';
    return '';
  }

  // Si la URL actual ya viene con ?servicio=... (por si abres directamente)
  (function autoOpenFromQuery(){
    try {
      const params = new URLSearchParams(location.search);
      const key = params.get('servicio');
      if (key) openModal(key);
    } catch(e){ /* noop */ }
  })();

})();
 /* ===========================
    TPL: FIN BLOQUE NUEVO
    =========================== */

<!-- TPL: INICIO BLOQUE NUEVO [Airbag JS mínimo para evitar pantalla en blanco] -->
(function(){
  try {
    // Nada intrusivo: solo deja una traza útil si algo peta.
    window.addEventListener('error', function(e){
      console.warn('TPL: error global capturado:', e.message);
    });
    window.addEventListener('unhandledrejection', function(e){
      console.warn('TPL: promesa rechazada:', (e.reason && e.reason.message) || e.reason);
    });
  } catch(_) {}
})();
<!-- TPL: FIN BLOQUE NUEVO -->

