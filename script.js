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

  // Inyectar HTML del modal
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
    backdrop: modal.querySelector('[data-close]'),
    closeBtn: modal.querySelector('.tpl-modal__close'),
    form: modal.querySelector('#tpl-reserva-form'),
    servicioHidden: modal.querySelector('#tpl-servicio'),
    servicioSelect: modal.querySelector('#tpl-servicio-select'),
    fecha: modal.querySelector('#tpl-fecha'),
    hora: modal.querySelector('#tpl-hora'),
    title: modal.querySelector('#tpl-modal-title')
  };

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

  // Manejo submit (placeholder). Aquí podrás conectar Formspree/EmailJS.
  els.form.addEventListener('submit', (e)=>{
    e.preventDefault();
    const data = Object.fromEntries(new FormData(els.form).entries());
    // TODO: integrar con Formspree/EmailJS si quieres
    console.log('Solicitud de reserva enviada:', data);
    alert('¡Gracias! Hemos recibido tu solicitud. Te contactaremos para confirmar.');
    closeModal();
    els.form.reset();
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
      const key = params.get('servicio') || guessServiceFromContext(a);
      openModal(key);
    }
  });

  // Si no llega ?servicio=, intentamos deducirlo mirando el contexto (título de tarjeta, etc.)
  function guessServiceFromContext(anchor) {
    // Buscar h3 cercano
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
<!-- TPL: INICIO BLOQUE NUEVO [Helper logout] -->
<script>
  // Si pones un botón con id="tpl-logout-btn" en tu navbar/menu, esto cierra sesión
  document.addEventListener('click', async (e) => {
    const btn = e.target.closest('#tpl-logout-btn');
    if (!btn) return;
    try {
      await auth.signOut();
      const here = location.pathname.split('/').pop();
      if (here === 'reserva.html') {
        location.href = 'login.html?next=reserva.html';
      } else {
        location.reload();
      }
    } catch (err) {
      console.error(err);
    }
  });
</script>
<!-- TPL: FIN BLOQUE NUEVO -->

/* ================================================
   TPL: INICIO BLOQUE NUEVO [Hotfix reservas robusto - no dejar la página en blanco]
   - No rompe tu diseño ni clases existentes.
   - Renderiza un calendario básico si falla algo.
   - Marca festivos cuando el JSON esté disponible.
================================================== */

(function () {
  // -------- Utilidades pequeñas y seguras
  const $ = (sel, ctx = document) => ctx.querySelector(sel);
  const $$ = (sel, ctx = document) => Array.from(ctx.querySelectorAll(sel));

  // Formato YYYY-MM-DD
  const fmt = (d) => d.toISOString().slice(0, 10);

  // Parse seguro de fechas "YYYY-MM-DD"
  const parseISO = (s) => {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return null;
    const [y, m, d] = s.split("-").map(Number);
    return new Date(y, m - 1, d);
  };

  // Set de fechas deshabilitadas (festivos + personalizadas)
  const disabledDates = new Set();

  // Intenta cargar festivos si existe el JSON (no rompe si falla)
  async function tryLoadHolidays(year, ccaa) {
    // Si ya están en memoria global (por otro script), úsalos
    if (window.TPL_FESTIVOS && Array.isArray(window.TPL_FESTIVOS)) {
      window.TPL_FESTIVOS.forEach((iso) => disabledDates.add(iso));
      return;
    }

    // Carga consolidado 2025/2026 si existen en raíz (opcional)
    const files = [`/festivos-es-${year}.json`, `festivos-es-${year}.json`];
    for (const url of files) {
      try {
        const res = await fetch(url, { cache: "no-store" });
        if (!res.ok) continue;
        const data = await res.json();

        // nacionales
        if (Array.isArray(data.national)) {
          data.national.forEach((f) => f?.date && disabledDates.add(f.date));
        }
        // autonómicos
        if (data.regions && ccaa && data.regions[ccaa]) {
          data.regions[ccaa].forEach((f) => f?.date && disabledDates.add(f.date));
        }
        // Si viene en formato plano (otra implementación), normalízalo
        if (Array.isArray(data)) {
          data.forEach((f) => {
            if (typeof f === "string" && /^\d{4}-\d{2}-\d{2}$/.test(f)) disabledDates.add(f);
            if (f?.date) disabledDates.add(f.date);
          });
        }
        return; // cargado alguno, salimos
      } catch (_) {
        // Silencioso: si falla uno, probamos el siguiente
      }
    }
  }

  // Render calendario mínimo en un contenedor
  function renderCalendar(container, year, month /* 0-11 */) {
    container.innerHTML = "";

    const header = document.createElement("div");
    header.className = "tpl-cal-header";
    header.style.display = "flex";
    header.style.justifyContent = "space-between";
    header.style.alignItems = "center";
    header.style.margin = "0 0 12px 0";

    const btnPrev = document.createElement("button");
    btnPrev.type = "button";
    btnPrev.setAttribute("aria-label", "Mes anterior");
    btnPrev.textContent = "‹";
    btnPrev.style.border = "1px solid #eee";
    btnPrev.style.borderRadius = "8px";
    btnPrev.style.padding = "6px 10px";
    btnPrev.style.background = "#fff";
    btnPrev.style.cursor = "pointer";

    const btnNext = btnPrev.cloneNode(true);
    btnNext.textContent = "›";
    btnNext.setAttribute("aria-label", "Mes siguiente");

    const title = document.createElement("div");
    title.style.fontWeight = "700";
    title.style.fontFamily = "Poppins, system-ui, -apple-system, Segoe UI, Roboto, Ubuntu, Cantarell, Noto Sans, Helvetica, Arial, sans-serif";
    title.style.color = "var(--color-texto, #58425a)";
    const monthNames = ["Enero","Febrero","Marzo","Abril","Mayo","Junio","Julio","Agosto","Septiembre","Octubre","Noviembre","Diciembre"];
    title.textContent = `${monthNames[month]} ${year}`;

    header.append(btnPrev, title, btnNext);

    const grid = document.createElement("table");
    grid.className = "tpl-cal-grid";
    grid.style.width = "100%";
    grid.style.borderCollapse = "collapse";
    grid.style.tableLayout = "fixed";
    grid.style.fontFamily = "Montserrat, system-ui, -apple-system, Segoe UI, Roboto, Ubuntu, Cantarell, Noto Sans, Helvetica, Arial, sans-serif";

    const thead = document.createElement("thead");
    const trHead = document.createElement("tr");
    ["L","M","X","J","V","S","D"].forEach((d) => {
      const th = document.createElement("th");
      th.textContent = d;
      th.style.padding = "6px 0";
      th.style.fontWeight = "600";
      th.style.color = "var(--color-texto, #58425a)";
      th.style.fontSize = "0.9rem";
      trHead.appendChild(th);
    });
    thead.appendChild(trHead);

    const tbody = document.createElement("tbody");

    // Primer día del mes (comenzando Lunes)
    const first = new Date(year, month, 1);
    const startIdx = (first.getDay() + 6) % 7; // convertir: dom=0 -> 6
    const daysInMonth = new Date(year, month + 1, 0).getDate();

    let day = 1 - startIdx;
    for (let r = 0; r < 6; r++) {
      const tr = document.createElement("tr");
      for (let c = 0; c < 7; c++, day++) {
        const td = document.createElement("td");
        td.style.height = "44px";
        td.style.border = "1px solid #eee";
        td.style.textAlign = "center";
        td.style.verticalAlign = "middle";
        td.style.fontSize = "0.95rem";
        td.style.userSelect = "none";

        if (day < 1 || day > daysInMonth) {
          td.style.background = "#fafafa";
          tr.appendChild(td);
          continue;
        }

        const d = new Date(year, month, day);
        const iso = fmt(d);

        td.textContent = String(day);

        // Hoy
        const today = new Date();
        if (d.toDateString() === new Date(today.getFullYear(), today.getMonth(), today.getDate()).toDateString()) {
          td.style.outline = "2px solid var(--color-principal, #339496)";
          td.style.outlineOffset = "-2px";
          td.style.fontWeight = "700";
        }

        // Festivo / deshabilitado
        const isDisabled = disabledDates.has(iso);
        if (isDisabled) {
          td.setAttribute("aria-disabled", "true");
          td.style.background = "#f4f4f4";
          td.style.color = "#b0a5b5";
        } else {
          td.style.cursor = "pointer";
          td.addEventListener("click", () => {
            // seleccionar fecha
            $$(".tpl-cal-grid td.is-selected", container).forEach((n) => {
              n.classList.remove("is-selected");
              n.style.background = "";
              n.style.color = "";
              n.style.fontWeight = "";
            });
            td.classList.add("is-selected");
            td.style.background = "rgba(51,148,150,0.12)";
            td.style.fontWeight = "700";
            container.dispatchEvent(new CustomEvent("tpl:date-select", { detail: { date: iso } }));
          });
        }
        tr.appendChild(td);
      }
      tbody.appendChild(tr);
    }

    grid.append(thead, tbody);
    container.append(header, grid);

    // Navegación de meses
    btnPrev.addEventListener("click", () => {
      const prev = new Date(year, month, 1);
      prev.setMonth(prev.getMonth() - 1);
      renderCalendar(container, prev.getFullYear(), prev.getMonth());
    });
    btnNext.addEventListener("click", () => {
      const next = new Date(year, month, 1);
      next.setMonth(next.getMonth() + 1);
      renderCalendar(container, next.getFullYear(), next.getMonth());
    });

    // Leyenda mínima (opcional, no invasiva)
    const legend = document.createElement("div");
    legend.style.display = "flex";
    legend.style.gap = "12px";
    legend.style.marginTop = "10px";
    legend.style.fontSize = "0.9rem";
    const item = (label, bg = "rgba(51,148,150,0.12)") => {
      const span = document.createElement("span");
      span.style.display = "inline-flex";
      span.style.alignItems = "center";
      span.style.gap = "6px";
      const dot = document.createElement("i");
      dot.style.display = "inline-block";
      dot.style.width = "14px";
      dot.style.height = "14px";
      dot.style.borderRadius = "3px";
      dot.style.background = bg;
      span.append(dot, document.createTextNode(label));
      return span;
    };
    legend.append(item("Seleccionado"), item("Festivo / no disponible", "#f4f4f4"));
    container.append(legend);
  }

  // --------- Entrada principal segura
  document.addEventListener("DOMContentLoaded", async () => {
    // Detecta si la página actual tiene módulo de reservas
    const root =
      $('[data-tpl="reservas"]') ||
      $('#tpl-reservas') ||
      $('#tpl-calendar') ||
      $('#calendar') ||
      $('.tpl-reservas');

    // Si no hay contenedor, no hacemos nada (no rompemos otras páginas)
    if (!root) return;

    // Comportamiento de login: si existe tplAuth lo respetamos; si no existe, no bloqueamos
    const requiresLogin = !!(window.tplAuth && typeof window.tplAuth.isLoggedIn === "function");
    if (requiresLogin) {
      try {
        const logged = await Promise.resolve(window.tplAuth.isLoggedIn());
        if (!logged) {
          // Muestra un aviso discreto en vez de dejar la página en blanco
          const box = document.createElement("div");
          box.setAttribute("role", "status");
          box.style.margin = "12px 0 16px";
          box.style.padding = "12px";
          box.style.border = "1px dashed #ddd";
          box.style.borderRadius = "10px";
          box.style.background = "#fff";
          box.style.color = "var(--color-texto, #58425a)";
          box.innerHTML = "<strong>Inicia sesión</strong> para completar tu reserva. Si ya has iniciado sesión, recarga la página.";
          root.prepend(box);
        }
      } catch (_) {
        // Si falla la comprobación de login, seguimos mostrando el calendario (no bloqueamos)
      }
    }

    // Año/CCAA por defecto
    const now = new Date();
    const year = now.getFullYear();
    const ccaa =
      (root.getAttribute("data-ccaa") || "MD").trim(); // por defecto Madrid

    // Carga de festivos (si no existe el JSON, no rompe la UI)
    await tryLoadHolidays(year, ccaa);

    // Render inicial
    renderCalendar(root, now.getFullYear(), now.getMonth());

    // Exponemos un hook pequeño para que tu otro JS pueda escuchar la fecha elegida
    root.addEventListener("tpl:date-select", (ev) => {
      // Puedes leer ev.detail.date (YYYY-MM-DD)
      // Ejemplo: auto-rellenar un input oculto si existe
      const hidden = $('#tpl-fecha-seleccionada');
      if (hidden) hidden.value = ev.detail.date;
    });
  });
})();

/* ================================================
   TPL: FIN BLOQUE NUEVO [Hotfix reservas robusto]
================================================== */

<!-- TPL: INICIO BLOQUE NUEVO [Airbag reservas + diagnóstico visible] -->
<script>
(function(){
  // Mensaje discreto de carga (se quita al renderizar)
  const root = document.querySelector('[data-tpl="reservas"], #tpl-reservas, #tpl-calendar, .tpl-reservas');
  if (root && !root.dataset.tplInit) {
    root.dataset.tplInit = "1";
    const loading = document.createElement('div');
    loading.id = 'tpl-reservas-loading';
    loading.style.cssText = 'margin:10px 0;padding:10px;border:1px dashed #ddd;border-radius:10px;background:#fff;color:#58425a;font:500 14px/1.4 Montserrat,system-ui';
    loading.textContent = 'Cargando calendario…';
    root.appendChild(loading);
  }

  // Si mi lógica principal ya estaba, no hacemos nada más
  if (window.__TPL_RESERVAS_OK__) return;

  // Pequeño calendario mínimo si no se ha dibujado nada (fallback)
  function drawFallbackCalendar(container){
    if (!container) return;
    container.innerHTML = '';
    const box = document.createElement('div');
    box.style.cssText = 'border:1px solid #eee;border-radius:12px;padding:12px;background:#fff;box-shadow:0 2px 12px rgba(0,0,0,.05)';
    const h = document.createElement('div');
    h.style.cssText = 'font-weight:700;margin-bottom:8px;color:#58425a;font-family:Poppins,system-ui';
    const now = new Date();
    const m = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'][now.getMonth()];
    h.textContent = `Disponibilidad — ${m} ${now.getFullYear()}`;
    const p = document.createElement('p');
    p.style.cssText = 'margin:0;color:#58425a';
    p.textContent = 'Si ves este calendario básico, la lógica avanzada no cargó. Puedes seguir enviando la solicitud; los festivos se aplicarán al revisar.';
    box.append(h,p);
    container.append(box);
  }

  // Si a los 800ms no hay nada más que el "loading", pinto fallback
  setTimeout(()=>{
    const cont = document.querySelector('[data-tpl="reservas"], #tpl-reservas, #tpl-calendar, .tpl-reservas');
    const onlyLoading = cont && cont.children.length === 1 && cont.querySelector('#tpl-reservas-loading');
    if (onlyLoading) {
      drawFallbackCalendar(cont);
    }
  }, 800);

  // Capturo errores globales y los muestro (sin romper estética)
  function showError(msg){
    const bar = document.getElementById('tpl-reservas-error') || document.createElement('div');
    bar.id = 'tpl-reservas-error';
    bar.style.cssText = 'margin:10px 0;padding:10px;border:1px solid #f3c2c2;border-radius:10px;background:#fff7f7;color:#7a2c2c;font:500 13px/1.5 Montserrat';
    bar.innerHTML = 'Ha ocurrido un problema con el script de reservas. <br><small>'+ (msg||'Error desconocido') +'</small>';
    (root || document.body).prepend(bar);
  }
  window.addEventListener('error', (e)=>{ showError(e.message); });
  window.addEventListener('unhandledrejection', (e)=>{ showError((e.reason && e.reason.message) || 'Promesa rechazada'); });
})();
</script>
<!-- TPL: FIN BLOQUE NUEVO -->

