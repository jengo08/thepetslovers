/*
  TPL · Lógica de reservas: preselección, cálculo de desglose, envío a Firestore y EmailJS
  - Preselección por ?service= / ?svc= y localStorage('lastService')
  - Cálculo de precios (cliente) + suplementos + días (inclusivo)
  - Cálculo de "A pagar ahora":
      pagar_ahora = subtotal - (coste_auxiliar + festivo_auxiliar)
    Si no configuras costes internos, fallback a margen porcentual (20%)
  - Guardado en reservas y envío de emails (cliente + gestión)
*/
(function(){
  const db = firebase.firestore();

  // ====== CONFIG PRECIOS (CLIENTE) ======
  window.TPL_PRICING = {
    daycare: { adult: 15, puppy: 20, bonosAdulto: {10:135,20:250,30:315}, bonosPuppy:{10:185,20:350,30:465} },
    visita_gato: {
      base60: { d1_10: 22, d11p: 18 },
      base90: { d1_10: 30, d11p: 27 },
      med15: { d1_10: 12, d11p: 10 },
      // suplementos por nº de gatos adicionales por visita
      extraCats: { oneMore: 12, twoEach: 8, threePlusEach: 6 }
    },
    overnight: { adult: { d1_10: 30, d11p: 27 }, puppy: { d1_10: 35, d11p: 32 }, secondDog: { d1_10: 25, d11p: 22 } },
    walk60: { price: 12, secondPet: 8, bonos: {10:115,15:168,20:220,25:270,30:318} },
    exoticos: { aves: 20, reptiles: 20, pequenos_mamiferos: 25, otro: 20 },
    transporte: { flat: 20 },
    supplements: { urgencia: 10, festivo: 10, senalado: 30 }
  };

  // ====== CONFIG AUXILIAR (OCULTA) ======
  // Pon aquí tus costes internos si quieres cálculo exacto (por día/visita).
  // Si los dejas en null, se usará fallback MARGIN_FALLBACK sobre el subtotal.
  window.TPL_AUX_RULES = {
    daycare: { adult: null, puppy: null },
    visita_gato: { base60: null, base90: null, med15: null, extraCat: null },
    overnight: { adult: null, puppy: null, secondDog: null },
    walk60: { base: null, secondPet: null },
    exoticos: { aves: null, reptiles: null, pequenos_mamiferos: null, otro: null },
    transporte: { flat: null },
    festivo_aux: { normal: 8, senalado: 15 }
  };
  const MARGIN_FALLBACK = 0.20; // 20% del subtotal si no hay reglas internas

  // ====== UTILS ======
  const $ = sel => document.querySelector(sel);
  const $$ = sel => Array.from(document.querySelectorAll(sel));
  const fmt = n => new Intl.NumberFormat('es-ES', { style:'currency', currency:'EUR'}).format(n||0);
  const todayStr = () => new Date().toISOString().slice(0,10);

  function daysInclusive(a, b){
    const d1 = new Date(a), d2 = new Date(b);
    if (isNaN(+d1) || isNaN(+d2)) return 0;
    const diff = Math.round((d2 - d1) / (1000*60*60*24));
    return diff + 1;
  }

  function getQueryService(){
    const url = new URL(location.href);
    return url.searchParams.get('service') || url.searchParams.get('svc');
  }

  function preselectService(){
    const sel = $('#service');
    const q = getQueryService();
    const remembered = localStorage.getItem('lastService');
    const value = q || remembered;
    if (value && sel.querySelector(`option[value="${value}"]`)) {
      sel.value = value;
      sel.dispatchEvent(new Event('change'));
    }
  }

  // ====== UI REACTIVA (especie/subtipo) ======
  function syncSpeciesUI(){
    const service = $('#service').value;
    const row = $('#speciesRow');
    const sub = $('#exoticosSubtypeWrap');
    const inp = $('#species');
    row.style.display = 'none'; sub.style.display = 'none'; inp.readOnly = true; inp.value = '';

    if (service === 'visita_gato') { row.style.display='grid'; inp.value = 'Gato'; }
    if (service === 'exoticos')    { row.style.display='grid'; inp.value='Exótico'; sub.style.display='block'; }
  }

  // ====== DESGLOSE ======
  function compute(state){
    const P = window.TPL_PRICING;
    const A = window.TPL_AUX_RULES;

    const items = [];
    let subtotal = 0; let festivoAux = 0;

    const d = daysInclusive(state.startDate, state.endDate);
    const isLong = d >= 11; // regla "desde día 11"

    // Helper
    const add = (label, amount) => { if(!amount) return; items.push({label, amount}); subtotal += amount; };

    // === Por servicio ===
    if (state.service === 'daycare') {
      // Si hay cachorros en selección → tarifa cachorro, si no → estándar
      const anyPuppy = state.pets.some(p => p.isPuppy);
      const rate = anyPuppy ? P.daycare.puppy : P.daycare.adult;
      // Bonos opcionales (10/20/30) aplican si días == bono
      let base;
      if (state.bono && [10,20,30].includes(state.bono) && d === state.bono) {
        base = anyPuppy ? P.daycare.bonosPuppy[state.bono] : P.daycare.bonosAdulto[state.bono];
        add(`Bono ${state.bono} días`, base);
      } else {
        base = d * rate * Math.max(1, state.pets.length);
        add(`Base (${d} día/s × ${state.pets.length} mascota/s)`, base);
      }
      const auxRate = (anyPuppy ? A.daycare.puppy : A.daycare.adult);
      const auxCost = (auxRate!=null ? auxRate * d * Math.max(1, state.pets.length) : null);
      state._auxCost = auxCost;
    }

    if (state.service === 'overnight') {
      const anyPuppy = state.pets.some(p => p.isPuppy);
      const table = anyPuppy ? P.overnight.puppy : P.overnight.adult;
      const rate = isLong ? table.d11p : table.d1_10;
      // 1º y 2º perro
      const dogs = state.pets.filter(p=> (p.species||'').toLowerCase()==='perro');
      const first = Math.min(1, dogs.length), second = Math.max(0, dogs.length-1);
      const firstCost = d * rate * first;
      const secondRate = isLong ? P.overnight.secondDog.d11p : P.overnight.secondDog.d1_10;
      const secondCost = d * secondRate * second;
      add(`Base 1º perro (${d}d)`, firstCost);
      if (second) add(`2º perro (${d}d)`, secondCost);
      state._auxCost = null; // pon tus reglas si las sabes (sino, fallback)
    }

    if (state.service === 'walk60') {
      if (state.bono && P.walk60.bonos[state.bono]) {
        add(`Bono paseos ×${state.bono}`, P.walk60.bonos[state.bono]);
      } else {
        const base = state.numWalks * P.walk60.price;
        add(`Paseos (${state.numWalks}×)`, base);
        if (state.secondPet) add(`2ª mascota (${state.numWalks}×)`, state.numWalks * P.walk60.secondPet);
      }
      state._auxCost = null;
    }

    if (state.service === 'visita_gato') {
      const visits = d * (state.visitsPerDay || 1);
      const baseTable = (state.duration==='90' ? P.visita_gato.base90 : P.visita_gato.base60);
      const baseRate = isLong ? baseTable.d11p : baseTable.d1_10;
      add(`Visitas (${visits}×)`, visits * baseRate);

      if (state.med15) {
        const medRate = isLong ? P.visita_gato.med15.d11p : P.visita_gato.med15.d1_10;
        add(`Medicaciones 15’ (${visits}×)`, visits * medRate);
      }

      // Suplementos por nº de gatos adicionales por visita
      const extraCats = Math.max(0, state.catsCount - 1);
      if (extraCats>0) {
        let supp = 0;
        if (extraCats === 1) supp = P.visita_gato.extraCats.oneMore * visits;
        else if (extraCats === 2) supp = (2 * P.visita_gato.extraCats.twoEach) * visits;
        else if (extraCats >= 3) supp = (extraCats * P.visita_gato.extraCats.threePlusEach) * visits;
        add(`Supl. gatos adicionales (${visits}×)`, supp);
      }
      state._auxCost = null;
    }

    if (state.service === 'exoticos') {
      const subtype = state.exoSubtype || 'otro';
      add(`Exóticos · ${subtype}`, P.exoticos[subtype] || P.exoticos.otro);
      state._auxCost = null;
    }

    if (state.service === 'transporte') {
      add('Transporte', P.transporte.flat);
      state._auxCost = null;
    }

    // === SUPLEMENTOS GENERALES ===
    if (state.urgencia) add('Urgencia (mismo día <2h)', P.supplements.urgencia);
    if (state.festivo)  { add('Festivo', P.supplements.festivo); festivoAux += (A.festivo_aux?.normal || 0); }
    if (state.senalado) { add('Días señalados (24/12,25/12,31/12,01/01)', P.supplements.senalado); festivoAux += (A.festivo_aux?.senalado || 0); }

    // === MARGEN / PAGO AHORA ===
    let auxCost = 0;
    if (state._auxCost != null) auxCost += state._auxCost;
    // Si no hay reglas internas suficientes, fallback: margen % del subtotal
    if (!auxCost) auxCost = Math.max(0, subtotal * (1 - MARGIN_FALLBACK));

    const pagar_ahora = Math.max(0, subtotal - (auxCost + festivoAux));
    const pendiente   = Math.max(0, subtotal - pagar_ahora);

    return { items, subtotal, pagar_ahora, pendiente, festivoAux };
  }

  function renderBreakdown(bk){
    const wrap = document.getElementById('breakdown');
    wrap.innerHTML = '';
    bk.items.forEach(it => {
      const row = document.createElement('div');
      row.style.display='flex'; row.style.justifyContent='space-between';
      row.innerHTML = `<span>${it.label}</span><strong>${fmt(it.amount)}</strong>`;
      wrap.appendChild(row);
    });
    const hr = () => { const d = document.createElement('hr'); d.style.border='none'; d.style.borderTop='1px solid #eee'; d.style.margin='.5rem 0'; return d; };
    const rowKV = (k,v)=>{ const d=document.createElement('div'); d.style.display='flex'; d.style.justifyContent='space-between'; d.innerHTML=`<span><strong>${k}</strong></span><strong>${v}</strong>`; return d; };
    wrap.appendChild(hr());
    wrap.appendChild(rowKV('Subtotal', fmt(bk.subtotal)));
    wrap.appendChild(rowKV('A pagar ahora', fmt(bk.pagar_ahora)));
    wrap.appendChild(rowKV('Pendiente (12 días antes)', fmt(bk.pendiente)));
  }

  // ====== ESTADO ======
  const state = {
    service:'', startDate:'', endDate:'', startTime:'', endTime:'',
    pets:[], // [{id,name,species,isPuppy}]
    // específicos
    bono:null, // 10/20/30 (daycare)
    numWalks: 1, secondPet: false,            // walk60
    duration:'60', med15:false, visitsPerDay:1, catsCount:1, // visita_gato
    exoSubtype:'aves',
    urgencia:false, festivo:false, senalado:false
  };

  // ====== BINDINGS ======
  function collectState(){
    state.service = $('#service').value;
    state.startDate = $('#startDate').value; state.endDate = $('#endDate').value;
    state.startTime = $('#startTime').value; state.endTime = $('#endTime').value;
    state.pets = $$('#petsList input[type="checkbox"]:checked').map(chk => ({
      id: chk.value, name: chk.closest('.pet-item')?.querySelector('strong')?.textContent || chk.value,
      species: chk.dataset.species || '',
      isPuppy: chk.dataset.ispuppy === '1'
    }));

    // Campos condicionales por servicio
    if (state.service === 'daycare')   state.bono = parseInt(localStorage.getItem('daycareBono')||'') || null;
    if (state.service === 'walk60')    { state.numWalks = parseInt(localStorage.getItem('walkNum')||'1'); state.secondPet = localStorage.getItem('walkSecond') === '1'; }
    if (state.service === 'visita_gato') {
      state.duration = localStorage.getItem('vgDur') || '60';
      state.med15 = localStorage.getItem('vgMed') === '1';
      state.visitsPerDay = parseInt(localStorage.getItem('vgVpd')||'1');
      state.catsCount = parseInt(localStorage.getItem('vgCats')||'1');
    }
    if (state.service === 'exoticos')  state.exoSubtype = $('#exoticosSubtype')?.value || 'otro';

    state.urgencia = localStorage.getItem('supUrg') === '1';
    state.festivo  = localStorage.getItem('supFest') === '1';
    state.senalado = localStorage.getItem('supSen') === '1';

    return state;
  }

  // Controles ligeros (debajo de Datos del servicio)
  function ensureInlineControls(){
    const host = document.getElementById('inlineControls');
    if(!host.dataset.ready){
      host.dataset.ready='1';
      host.innerHTML = `
        <div style="display:none" data-for="daycare">
          <label>¿Bono guardería?</label>
          <select id="daycareBono">
            <option value="">Sin bono</option>
            <option value="10">Bono 10</option>
            <option value="20">Bono 20</option>
            <option value="30">Bono 30</option>
          </select>
        </div>
        <div style="display:none" data-for="walk60">
          <label>Nº de paseos</label>
          <input id="walkNum" type="number" min="1" value="1" />
          <label style="display:flex; align-items:center; gap:.4rem; margin-top:.4rem;"><input id="walkSecond" type="checkbox" /> 2ª mascota</label>
        </div>
        <div style="display:none" data-for="visita_gato">
          <div class="row two">
            <div>
              <label>Duración</label>
              <select id="vgDur"><option value="60">60 min</option><option value="90">90 min</option></select>
            </div>
            <div>
              <label>Visitas por día</label>
              <input id="vgVpd" type="number" min="1" value="1" />
            </div>
          </div>
          <div class="row two">
            <div>
              <label>Nº total de gatos</label>
              <input id="vgCats" type="number" min="1" value="1" />
            </div>
            <div>
              <label>¿Medicaciones 15’?</label>
              <input id="vgMed" type="checkbox" />
            </div>
          </div>
        </div>
        <div data-for="supps" class="row two" style="margin-top:.5rem;">
          <label style="display:flex; align-items:center; gap:.4rem;"><input id="supUrg" type="checkbox" /> Urgencia</label>
          <label style="display:flex; align-items:center; gap:.4rem;"><input id="supFest" type="checkbox" /> Festivo</label>
          <label style="display:flex; align-items:center; gap:.4rem;"><input id="supSen" type="checkbox" /> Días señalados</label>
        </div>`;

      // Persistencia en localStorage + refresco
      const bind = (id, key, type='value') => {
        const el = document.getElementById(id); if(!el) return;
        const save = () => localStorage.setItem(key, (type==='checked') ? (el.checked?'1':'0') : el.value);
        el.addEventListener('input', () => { save(); refresh(); });
        el.addEventListener('change', () => { save(); refresh(); });
      };
      bind('daycareBono','daycareBono');
      bind('walkNum','walkNum'); bind('walkSecond','walkSecond','checked');
      bind('vgDur','vgDur'); bind('vgVpd','vgVpd'); bind('vgCats','vgCats'); bind('vgMed','vgMed','checked');
      bind('supUrg','supUrg','checked'); bind('supFest','supFest','checked'); bind('supSen','supSen','checked');
    }

    // Mostrar/ocultar grupos según servicio
    const service = $('#service').value;
    host.querySelectorAll('[data-for]')?.forEach(g => {
      const t = g.getAttribute('data-for');
      g.style.display = (t===service) || (t==='supps') ? 'block' : 'none';
    });
  }

  function refresh(){
    const s = collectState();
    syncSpeciesUI();
    ensureInlineControls();
    const bk = compute(s);
    renderBreakdown(bk);
  }

  // Eventos de formulario
  $('#service').addEventListener('change', ()=>{ localStorage.setItem('lastService',$('#service').value); refresh(); });
  ['startDate','endDate','startTime','endTime'].forEach(id=> $('#'+id).addEventListener('change', refresh));
  document.getElementById('petsList').addEventListener('change', refresh);

  // Botón atrás
  $('#btnBack').addEventListener('click', ()=>{
    if (document.referrer) history.back(); else location.href = '/servicios.html';
  });

  // Submit → Guardar + emails + redirect
  $('#reservaForm').addEventListener('submit', async (e)=>{
    e.preventDefault();
    const user = firebase.auth().currentUser;
    if (!user) { alert('Inicia sesión para reservar.'); return; }

    const s = collectState();
    const bk = compute(s);

    // Componer documento
    const doc = {
      _estado: 'paid_review',
      _uid: user.uid,
      _email: user.email || $('#email').value,
      _createdAt: firebase.firestore.FieldValue.serverTimestamp(),
      service: s.service,
      startDate: s.startDate, endDate: s.endDate,
      Hora_inicio: s.startTime, Hora_fin: s.endTime,
      species: (s.service==='visita_gato' ? 'Gato' : (s.service==='exoticos' ? (s.exoSubtype||'Exótico') : '')),
      pets: s.pets, catsCount: s.catsCount || null,
      titular: {
        firstName: $('#fullName').value, email: $('#email').value, phone: $('#phone').value,
        region: $('#region').value, address: $('#address').value, postalCode: $('#postalCode').value,
        observations: $('#observations').value
      },
      total_cliente: bk.subtotal, pagar_ahora: bk.pagar_ahora, pendiente: bk.pendiente,
      total_txt: fmt(bk.subtotal), pay_now_txt: fmt(bk.pagar_ahora), pay_later_txt: fmt(bk.pendiente),
      summaryField: document.getElementById('breakdown').innerText
    };

    try {
      const ref = await db.collection('reservas').add(doc);

      // EmailJS → parámetros comunes
      const params = {
        reserva_id: ref.id,
        service: doc.service, startDate: doc.startDate, endDate: doc.endDate,
        Hora_inicio: doc.Hora_inicio, Hora_fin: doc.Hora_fin,
        species: doc.species, summaryField: doc.summaryField,
        firstName: doc.titular.firstName, email: doc.titular.email, phone: doc.titular.phone,
        region: doc.titular.region, address: doc.titular.address, postalCode: doc.titular.postalCode,
        observations: doc.titular.observations,
        _estado: doc._estado, _uid: doc._uid, _email: doc._email,
        total_cliente: doc.total_cliente, pagar_ahora: doc.pagar_ahora, pendiente: doc.pendiente,
        total_txt: doc.total_txt, pay_now_txt: doc.pay_now_txt, pay_later_txt: doc.pay_later_txt,
        admin_email: (window.TPL_EMAILJS?.adminEmail || 'gestion@thepetslovers.es')
      };

      // Email al cliente
      await emailjs.send(window.TPL_EMAILJS.serviceId, window.TPL_EMAILJS.templates.cliente, params);
      // Email a gestión
      await emailjs.send(window.TPL_EMAILJS.serviceId, window.TPL_EMAILJS.templates.gestion, params);

      alert('Tu reserva se ha registrado y está en revisión.');
      // Copia a localStorage (respaldo)
      try { localStorage.setItem('lastReserva', JSON.stringify({ id: ref.id, ...doc })); } catch(e) {}
      // Redirect suave a perfil
      setTimeout(()=> location.href = '/perfil.html', 600);
    }
    catch(err){
      console.error(err);
      alert('No se pudo completar la reserva. Revísalo e inténtalo de nuevo.');
    }
  });

  // Inicialización
  (function init(){
    // Fechas mínimas (hoy)
    $('#startDate').min = todayStr();
    $('#endDate').min = todayStr();

    // Preselección servicio por query/localStorage
    preselectService();
    syncSpeciesUI();
    ensureInlineControls();
    refresh();
  })();
})();
