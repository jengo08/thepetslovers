// reservas.js (REEMPLAZAR ENTERO)
// Gestión de reservas completa: desglose detallado de costes, autorrelleno del perfil y guardado de datos.

(function(){
  'use strict';

  /* ============= Unificación Nombre y Apellidos (sin perder apellidos) ============= */
  function unifyNameFields(){
    const firstNameEl = document.getElementById('firstName'); // visible
    const lastNameEl  = document.getElementById('lastName');  // oculto
    if(!firstNameEl || !lastNameEl) return;

    const label = document.querySelector('label[for="firstName"]');
    if(label) label.textContent = 'Nombre y apellidos';
    if(firstNameEl.placeholder) firstNameEl.placeholder = 'Nombre y apellidos';

    function updateLastName(){
      const parts = firstNameEl.value.trim().split(/\s+/);
      lastNameEl.value = (parts.length >= 2) ? parts.slice(1).join(' ') : '';
    }
    function mergeOnLoad(){
      const nameVal = (firstNameEl.value || '').trim();
      const surVal  = (lastNameEl.value  || '').trim();
      if(surVal && !nameVal.toLowerCase().includes(surVal.toLowerCase())){
        firstNameEl.value = `${nameVal} ${surVal}`.trim();
      }
    }
    function hideLastNameField(){
      const container = lastNameEl.closest('.booking-field') || lastNameEl.parentElement;
      if(container) container.style.display = 'none';
    }
    setTimeout(() => { mergeOnLoad(); hideLastNameField(); updateLastName(); }, 800);
    firstNameEl.addEventListener('input', updateLastName);
    lastNameEl.addEventListener('input', () => { mergeOnLoad(); hideLastNameField(); updateLastName(); });
  }

  /* ============= Preselección de servicio desde la URL o localStorage ============= */
  function preselectService(){
    const svcSelect = document.getElementById('service');
    if(!svcSelect) return;
    const urlParams = new URLSearchParams(window.location.search);
    let svc = urlParams.get('service') || urlParams.get('svc') || null;
    if(!svc){
      svc = localStorage.getItem('tpl.lastService') || null;
      if(svc) localStorage.removeItem('tpl.lastService');
    }
    if(svc){
      const opt = Array.from(svcSelect.options).find(o => o.value === svc);
      if(opt){
        svcSelect.value = svc;
        try{ svcSelect.dispatchEvent(new Event('change',{ bubbles:true })); }catch(_){}
      }
    }
  }

  /* ============= Tarifas base, bonos y exóticos ============= */
  const PRICES = {
    base: { visitas: 22, paseos: 12, guarderia: 15, alojamiento: 30, bodas: 0, postquirurgico: 0, transporte: 20, exoticos: 0 },
    puppyBase: { guarderia: 20, alojamiento: 35 },

    // Visitas (gatos) — tramo desde día 11
    visita60: 22, visita90: 30,
    visita60_larga: 18, visita90_larga: 27,
    visitaMed: 12, visitaMed_larga: 10,

    // Paseos
    paseoStd: 12,
    paseoExtraPerro: 8,
    paseoBonos: { 10:115, 15:168, 20:220, 25:270, 30:318 },

    // Alojamiento — perro extra
    alojSegundoPerroDia: 25,
    alojSegundoPerroD11: 22,

    // Depósito
    depositPct: 0.30
  };

  // Bonos guardería (1 mascota)
  const BUNDLE_GUARDERIA = {
    adult: { 10: 135, 20: 250, 30: 315 },
    puppy: { 10: 185, 20: 350, 30: 465 }
  };

  // Exóticos: precio por VISITA (species → tipo)
  const EXOTIC_PRICES = {
    conejo: 25,   // pequeños mamíferos
    pajaro: 20,   // aves
    huron: 25,    // pequeños mamíferos
    iguana: 15,   // reptiles
    otro: null    // a consultar
  };

  /* ============= Utilidades genéricas ============= */
  const €fmt = new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR' });
  const fmtEUR = (n) => €fmt.format(Math.round((+n || 0) * 100) / 100);
  function currency(n){ return (Math.round((n || 0) * 100) / 100).toFixed(2); }
  function getNumMascotas(){
    const select = document.getElementById('numPets');
    if(!select) return 1;
    const val = select.value;
    if(val === '6+'){
      const exact = document.getElementById('numPetsExact');
      const n = parseInt((exact && exact.value) || '6', 10);
      return isNaN(n) ? 6 : Math.max(6, n);
    }
    const num = parseInt(val, 10);
    return isNaN(num) ? 1 : num;
  }
  function getDays(){
    const start = document.getElementById('startDate')?.value;
    const end   = document.getElementById('endDate')?.value;
    if(!start || !end) return 0;
    const d1 = new Date(start);
    const d2 = new Date(end);
    if(isNaN(d1) || isNaN(d2)) return 0;
    const diff = Math.floor((d2 - d1) / (1000 * 60 * 60 * 24));
    return diff >= 0 ? diff + 1 : 0;
  }
  function updateDaysRow(nDias){
    const labelEl = document.querySelector('#sumSenalado')?.previousElementSibling;
    if(labelEl) labelEl.textContent = 'Días';
    const valueDiv = document.getElementById('sumSenalado')?.parentElement;
    if(valueDiv){
      const text = nDias === 1 ? '1 día' : `${nDias} días`;
      valueDiv.innerHTML = `<span id="sumSenalado">${text}</span>`;
    }
  }

  /* ============= Detectar automáticamente “cachorro” (≤ 6 meses) + badge ============= */
  function parseDateSafe(str){
    if(!str) return null;
    const d = new Date(str);
    return isNaN(d) ? null : d;
  }
  function monthsBetween(d1, d2){
    let months = (d2.getFullYear() - d1.getFullYear()) * 12 + (d2.getMonth() - d1.getMonth());
    if(d2.getDate() < d1.getDate()) months -= 1;
    return months;
  }
  function computeIsPuppyAuto(){
    const now = new Date();

    // 1) Fecha de nacimiento
    const dobIds = ['petBirthdate','petDob','birthDatePet','pet_dob','mascotaNacimiento'];
    for(const id of dobIds){
      const v = document.getElementById(id)?.value || '';
      const d = parseDateSafe(v);
      if(d){
        const m = Math.max(0, monthsBetween(d, now));
        return m <= 6;
      }
    }

    // 2) Edad en meses / años
    const monthsIds = ['petAgeMonths','ageMonths','mascotaMeses'];
    for(const id of monthsIds){
      const v = document.getElementById(id)?.value;
      const n = parseInt(v, 10);
      if(Number.isFinite(n)) return n <= 6;
    }
    const yearsIds = ['petAgeYears','ageYears','mascotaAnios'];
    for(const id of yearsIds){
      const v = document.getElementById(id)?.value;
      const n = parseFloat(v);
      if(Number.isFinite(n)) return (n * 12) <= 6;
    }

    // 3) Pareja valor + unidad
    const ageVal = document.getElementById('petAge')?.value;
    const ageUnit = (document.getElementById('petAgeUnit')?.value || '').toLowerCase();
    if(ageVal){
      const n = parseFloat(ageVal);
      if(Number.isFinite(n)){
        const months = (ageUnit.startsWith('año')) ? n*12 : n;
        return months <= 6;
      }
    }

    return null; // sin datos
  }
  function ensurePuppyBadge(){
    let badge = document.getElementById('puppyBadge');
    if(badge) return badge;
    // Insertar badge al lado de #isPuppy si existe, si no al lado del selector de servicio
    const host = document.getElementById('isPuppy')?.closest('.booking-field') || document.getElementById('service')?.closest('.booking-field') || document.body;
    badge = document.createElement('span');
    badge.id = 'puppyBadge';
    badge.style.display = 'none';
    badge.style.marginLeft = '8px';
    badge.style.padding = '2px 8px';
    badge.style.borderRadius = '999px';
    badge.style.fontSize = '12px';
    badge.style.fontWeight = '600';
    badge.style.background = '#16a34a20';
    badge.style.color = '#166534';
    badge.style.border = '1px solid #16a34a';
    host && host.appendChild(badge);
    return badge;
  }
  function setPuppyBadge(isPuppy){
    const badge = ensurePuppyBadge();
    if(isPuppy){
      badge.textContent = 'Cachorro detectado (≤ 6 m)';
      badge.style.display = 'inline-block';
    } else {
      badge.textContent = '';
      badge.style.display = 'none';
    }
  }
  function syncPuppyUI(isPuppy){
    const sel = document.getElementById('isPuppy');
    if(sel){
      const newVal = isPuppy ? 'si' : 'no';
      if(sel.value !== newVal){
        sel.value = newVal;
        try{ sel.dispatchEvent(new Event('change',{bubbles:true})); }catch(_){}
      }
    }
    const g = document.getElementById('guard-puppy');
    if(g && g.checked !== !!isPuppy){
      g.checked = !!isPuppy;
      try{ g.dispatchEvent(new Event('change',{bubbles:true})); }catch(_){}
    }
    const a = document.getElementById('aloj-puppy');
    if(a && a.checked !== !!isPuppy){
      a.checked = !!isPuppy;
      try{ a.dispatchEvent(new Event('change',{bubbles:true})); }catch(_){}
    }
    setPuppyBadge(!!isPuppy);
  }

  /* ============= Opciones exóticas dinámicas ============= */
  function toggleExoticSpecies(){
    const svc = document.getElementById('service')?.value || '';
    const speciesSelect = document.getElementById('species');
    if(!speciesSelect) return;
    if(!speciesSelect.dataset.originalOptions){
      speciesSelect.dataset.originalOptions = speciesSelect.innerHTML;
    }
    if(svc === 'exoticos'){
      speciesSelect.innerHTML = `
        <option value="conejo">Conejo</option>
        <option value="pajaro">Pájaro</option>
        <option value="huron">Hurón</option>
        <option value="iguana">Iguana</option>
        <option value="otro">Otro exótico</option>
      `;
    } else {
      speciesSelect.innerHTML = speciesSelect.dataset.originalOptions;
    }
  }

  /* ============= Cálculo de costes y desglose visible ============= */
  function computeCosts(){
    const svc = document.getElementById('service')?.value || '';
    const species = document.getElementById('species')?.value || 'perro';
    const visitDur  = parseInt(document.getElementById('visitDuration')?.value || '60', 10);
    const visitDaily= parseInt(document.getElementById('visitDaily')?.value || '1', 10);
    const nMasc = getNumMascotas();
    let nDias = getDays();
    if(nDias === 0 && ['transporte','bodas','postquirurgico','exoticos'].includes(svc)){
      nDias = 1;
    }
    updateDaysRow(nDias);

    // === Auto Cachorro
    const auto = computeIsPuppyAuto(); // true | false | null
    if(auto !== null) syncPuppyUI(auto);

    // Importes (separados para poder pintar el desglose correctamente)
    let baseCost = 0;            // suelto (paseos/guardería fuera del bono) o tarifa base
    let visit1Cost = 0;          // 1ª visita/día (visitas gatos)
    let visit2Cost = 0;          // 2ª+ visitas/día de medicación (15 min)
    let supplementPetsCost = 0;  // suplementos por nº de mascotas
    let exoticUnpriced = false;

    // Bono (separado)
    let packInfo = null;         // {days, price, remaining, perDay}
    let packCost = 0;            // importe del bono (1 mascota)
    let extraDaysCost = 0;       // coste de días sueltos (fuera del bono)

    if(svc === 'visitas'){
      // VISITAS A DOMICILIO (GATOS) — 1ª visita vs 2ª+ (medicación)
      const longStay = nDias >= 11;

      // 1ª visita/día a la duración elegida (60/90/15)
      const tarifa1 = (visitDur === 90)
        ? (longStay ? PRICES.visita90_larga : PRICES.visita90)
        : (visitDur === 15)
          ? (longStay ? PRICES.visitaMed_larga : PRICES.visitaMed)
          : (longStay ? PRICES.visita60_larga : PRICES.visita60);
      visit1Cost = tarifa1 * nDias * 1;

      // 2ª+ visitas/día SI visitDaily > 1 → todas son de medicación (15 min)
      const extrasPorDia = Math.max(0, visitDaily - 1);
      if(extrasPorDia > 0){
        const tarifaMed = longStay ? PRICES.visitaMed_larga : PRICES.visitaMed;
        visit2Cost = tarifaMed * nDias * extrasPorDia;
      }

      // Suplementos POR VISITA: se multiplican por todas las visitas (1ª + extras)
      const totalVisitas = nDias * Math.max(1, visitDaily);
      if(nMasc > 1){
        const extras = nMasc - 1;
        let supPorVisita = 0;
        if(extras === 1) supPorVisita = 12;
        else if(extras === 2) supPorVisita = 2 * 8;
        else supPorVisita = extras * 6;
        supplementPetsCost = supPorVisita * totalVisitas;
      }

    } else if(svc === 'paseos'){
      // PASEOS 60 min — bono (1 perro) separado y suelto separado
      const pricePerDay = PRICES.paseoStd;
      const normalCost  = nDias * pricePerDay;

      const packSizes = Object.keys(PRICES.paseoBonos)
        .map(s => parseInt(s,10))
        .filter(size => size <= nDias)
        .sort((a,b) => a - b);

      if(packSizes.length > 0){
        const packDays  = packSizes[packSizes.length - 1];
        const packPrice = PRICES.paseoBonos[packDays]; // bono 1 perro
        const remaining = nDias - packDays;

        packInfo      = { days: packDays, price: packPrice, remaining, perDay: pricePerDay };
        packCost      = packPrice;                 // Coste del bono (fila propia)
        baseCost      = remaining * pricePerDay;   // Suelto fuera del bono
        extraDaysCost = baseCost;                  // Para rotular “Coste días extra”
      } else {
        baseCost = normalCost;
      }

      // Suplementos: +8 €/paseo por cada perro extra (el bono NO cubre extras)
      if(nMasc > 1){
        supplementPetsCost = (nMasc - 1) * nDias * PRICES.paseoExtraPerro;
      }

    } else if(svc === 'guarderia'){
      // GUARDERÍA DE DÍA — bono (1 mascota) separado y suelto separado
      const manualPuppy = (document.getElementById('isPuppy')?.value === 'si');
      const isPuppy = (auto !== null) ? auto : manualPuppy;

      const perDay = isPuppy ? (PRICES.puppyBase.guarderia ?? PRICES.base.guarderia) : PRICES.base.guarderia;
      const table  = isPuppy ? BUNDLE_GUARDERIA.puppy : BUNDLE_GUARDERIA.adult;

      const normalCost = perDay * nDias;
      const packSizes = Object.keys(table)
        .map(s => parseInt(s,10))
        .filter(size => size <= nDias)
        .sort((a,b) => a - b);

      if(packSizes.length > 0){
        const packDays  = packSizes[packSizes.length - 1];
        const packPrice = table[packDays];        // bono 1 mascota
        const remaining = nDias - packDays;

        packInfo      = { days: packDays, price: packPrice, remaining, perDay: perDay };
        packCost      = packPrice;                // Coste del bono (fila propia)
        baseCost      = remaining * perDay;       // Suelto fuera del bono
        extraDaysCost = baseCost;                 // Para rotular
      } else {
        baseCost = normalCost;
      }

      // Suplementos guardería: 1→0 ; 2→12 €/día ; ≥3→ (n-1)*8 €/día
      if(nMasc >= 2){
        if(nMasc === 2) supplementPetsCost += 12 * nDias;
        else supplementPetsCost += (nMasc - 1) * 8 * nDias;
      }

    } else if(svc === 'alojamiento'){
      // ALOJAMIENTO (estancias)
      const manualPuppy = (document.getElementById('isPuppy')?.value === 'si');
      const isPuppy = (auto !== null) ? auto : manualPuppy;

      const baseDia = isPuppy ? PRICES.puppyBase.alojamiento : PRICES.base.alojamiento;
      const baseLong= isPuppy ? 32 : 27; // desde día 11
      const rate    = (nDias >= 11) ? baseLong : baseDia;
      baseCost = rate * nDias;

      if(species === 'perro' && nMasc >= 2){
        const extraRate = (nDias >= 11) ? PRICES.alojSegundoPerroD11 : PRICES.alojSegundoPerroDia;
        supplementPetsCost = (nMasc - 1) * extraRate * nDias;
      }

    } else if(svc === 'exoticos'){
      // EXÓTICOS — precio por VISITA según especie/tipo
      const exoticType = species || 'otro';
      const pricePerVisit = EXOTIC_PRICES[exoticType];

      if(pricePerVisit != null){
        const vxd = Math.max(1, visitDaily);
        baseCost = pricePerVisit * nDias * vxd;
      } else {
        exoticUnpriced = true;
        baseCost = 0;
      }
      // sin suplementos exóticos por ahora

    } else {
      baseCost = PRICES.base[svc] || 0;
    }

    // ---------- PINTADO DEL DESGLOSE ----------
    const els = {
      sumBase: document.getElementById('sumBase'),
      sumVisit1: document.getElementById('sumVisit1'),
      sumVisit2: document.getElementById('sumVisit2'),
      sumPets: document.getElementById('sumPets'),
      sumFestivo: document.getElementById('sumFestivo'),
      sumSenalado: document.getElementById('sumSenalado'),
      sumBono: document.getElementById('sumBono'),
      rowBono: document.getElementById('rowBono'),
      sumSubtotal: document.getElementById('sumSubtotal'),
      sumDeposit: document.getElementById('sumDeposit')
    };

    // Base suelto
    els.sumBase && (els.sumBase.textContent = (!exoticUnpriced && baseCost > 0) ? currency(baseCost) : '0.00');

    // Visitas (dos filas)
    els.sumVisit1 && (els.sumVisit1.textContent = currency(visit1Cost));
    els.sumVisit2 && (els.sumVisit2.textContent = currency(visit2Cost));

    // Suplementos
    els.sumPets && (els.sumPets.textContent = currency(supplementPetsCost));

    // Etiquetas dinámicas para bono/días extra
    const festLabelEl  = els.sumFestivo?.previousElementSibling;
    const senalLabelEl = els.sumSenalado?.previousElementSibling;

    if (packInfo && packCost > 0){
      // Coste del bono
      if (festLabelEl) festLabelEl.textContent = `Coste del bono (${packInfo.days} ${packInfo.days === 1 ? 'día' : 'días'})`;
      els.sumFestivo && (els.sumFestivo.textContent = currency(packCost));

      // Coste de días extra (suelto fuera del bono)
      if (senalLabelEl) senalLabelEl.textContent = `Coste días extra (${packInfo.remaining})`;
      els.sumSenalado && (els.sumSenalado.textContent = currency(extraDaysCost));
    } else {
      if (festLabelEl){
        if(!festLabelEl.dataset.orig) festLabelEl.dataset.orig = festLabelEl.textContent || '';
        festLabelEl.textContent = festLabelEl.dataset.orig || 'Festivos (auto)';
      }
      if (senalLabelEl){
        if(!senalLabelEl.dataset.orig) senalLabelEl.dataset.orig = senalLabelEl.textContent || '';
        senalLabelEl.textContent = senalLabelEl.dataset.orig || 'Días especiales (auto)';
      }
      els.sumFestivo && (els.sumFestivo.textContent = currency(0));
      els.sumSenalado && (els.sumSenalado.textContent = currency(0));
    }

    // Ocultar “Descuento (bono)”
    if (els.rowBono){
      els.rowBono.style.display = 'none';
      els.sumBono && (els.sumBono.textContent = '0.00');
    }

    // ---------- SUBTOTALES / DEPÓSITO ----------
    const subtotalBefore = baseCost + visit1Cost + visit2Cost + supplementPetsCost + packCost;
    const subtotal = (!exoticUnpriced) ? subtotalBefore : 0;
    const deposit  = (!exoticUnpriced) ? (subtotal * PRICES.depositPct) : 0;

    els.sumSubtotal && (els.sumSubtotal.textContent = (!exoticUnpriced) ? currency(subtotal) : '—');
    els.sumDeposit  && (els.sumDeposit.textContent  = (!exoticUnpriced) ? currency(deposit)  : '—');

    // ---------- RESUMEN OCULTO ----------
    const summaryField = document.getElementById('summaryField');
    if(summaryField){
      const s = [];
      s.push(`Días: ${nDias}`);
      if(!exoticUnpriced){
        if(packCost > 0) s.push(`Coste del bono (${packInfo.days}): ${currency(packCost)} €`);
        if(extraDaysCost > 0) s.push(`Coste días extra (${packInfo?.remaining || 0}): ${currency(extraDaysCost)} €`);
        if(baseCost > 0) s.push(`Base suelto: ${currency(baseCost)} €`);
        if(visit1Cost > 0) s.push(`Visitas (principal): ${currency(visit1Cost)} €`);
        if(visit2Cost > 0) s.push(`Visitas (medicación): ${currency(visit2Cost)} €`);
        if(supplementPetsCost > 0) s.push(`Suplementos mascotas: ${currency(supplementPetsCost)} €`);
        s.push(`Subtotal: ${currency(subtotal)} €`);
        s.push(`Depósito: ${currency(deposit)} €`);
      } else {
        s.push(`Precio a consultar`);
      }
      summaryField.value = s.join(' | ');
    }
  }

  /* ============= Enlazar eventos ============= */
  function bindEvents(){
    const ids = ['service','species','isPuppy','startDate','endDate','visitDuration','visitDaily','numPets','numPetsExact',
                 'petBirthdate','petDob','birthDatePet','pet_dob','mascotaNacimiento',
                 'petAgeMonths','ageMonths','mascotaMeses','petAgeYears','ageYears','mascotaAnios',
                 'petAge','petAgeUnit'];
    ids.forEach(id=>{
      const el = document.getElementById(id);
      if(!el) return;
      const handler = () => { computeCosts(); };
      el.addEventListener('change', handler);
      if(el.tagName === 'INPUT' || el.tagName === 'SELECT'){
        el.addEventListener('input', handler);
      }
    });
  }

  /* ============= Inicialización y envío ============= */
  document.addEventListener('DOMContentLoaded', () => {
    preselectService();
    unifyNameFields();
    toggleExoticSpecies();
    bindEvents();
    computeCosts();
    setTimeout(computeCosts, 400);

    // Control de autenticación (muestra/oculta formulario según sesión)
    if(typeof firebase !== 'undefined' && firebase.auth){
      const auth = firebase.auth();
      const form = document.getElementById('bookingForm');
      const wall = document.getElementById('authWall');
      auth.onAuthStateChanged((user) => {
        const logged = !!user;
        if(form) form.classList.toggle('disabled', !logged);
        if(wall) wall.style.display = logged ? 'none' : 'block';
      });
    }

    // Envío (Firestore + EmailJS)
    const form = document.getElementById('bookingForm');
    if(form){
      form.addEventListener('submit', async (ev) => {
        ev.preventDefault(); ev.stopPropagation();
        const auth = (typeof firebase !== 'undefined' && firebase.auth) ? firebase.auth() : null;
        const user = auth?.currentUser || null;
        if(!user){
          alert('Debes iniciar sesión para reservar.');
          return;
        }
        // Verificar perfil en Firestore
        try{
          const db = firebase.firestore();
          const col = (window.TPL_COLLECTIONS?.owners) || 'propietarios';
          const doc = await db.collection(col).doc(user.uid).get();
          if(!doc.exists){
            alert('Completa tu perfil antes de hacer una reserva.');
            if(window.location.pathname.indexOf('perfil')===-1) {
              window.location.href = 'perfil.html';
            }
            return;
          }
        }catch(_){}
        // Recalcular antes de enviar
        computeCosts();
        // Preparar payload
        const fd = new FormData(form);
        const payload = {};
        for(const [k,v] of fd.entries()){ payload[k] = v; }
        payload._estado = 'pending';
        payload._uid = user.uid;
        payload._email = user.email || null;
        if(firebase.firestore && firebase.firestore.FieldValue){
          payload._createdAt = firebase.firestore.FieldValue.serverTimestamp();
        }
        // Guardar en Firestore
        let saved = false;
        let docId = null;
        try{
          if(firebase.firestore){
            const docRef = await firebase.firestore().collection('reservas').add(payload);
            saved = true;
            docId = docRef.id;
          }
        }catch(err){ console.warn('No se pudo guardar la reserva en Firestore', err); }
        // Enviar EmailJS
        let mailed = false;
        try{
          if(window.emailjs){
            const cfg = window.TPL_EMAILJS || {};
            const service  = cfg.serviceId || cfg.service || '<YOUR_SERVICE_ID>';
            const template = (cfg.templates && (cfg.templates.reserva || cfg.templates.booking)) || cfg.templateReserva || cfg.templateBooking || '<YOUR_TEMPLATE_ID>';
            const pubKey   = cfg.publicKey || cfg.userId || '<YOUR_PUBLIC_KEY>';
            const params   = Object.assign({}, payload, { reserva_id: docId });
            const resp = await emailjs.send(service, template, params, pubKey);
            if(resp && resp.status >= 200 && resp.status < 300) mailed = true;
          }
        }catch(err){ console.warn('No se pudo enviar la reserva por EmailJS', err); }
        if(saved || mailed){
          alert('Tu reserva se ha enviado correctamente.');
          const redirect = form.dataset.tplRedirect || form.getAttribute('data-tpl-redirect');
          const wait = parseInt(form.dataset.tplWait || form.getAttribute('data-tpl-wait') || '800', 10);
          if(redirect){ setTimeout(() => { window.location.href = redirect; }, wait); }
          else { form.reset(); }
        } else {
          alert('No se pudo enviar la reserva. Por favor, inténtalo de nuevo.');
        }
      });
    }
  });

  // Exponer recálculo manual
  window.updateSummaryFromJS = computeCosts;
})();
