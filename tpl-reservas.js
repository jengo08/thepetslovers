// reservas.js (REEMPLAZAR ENTERO)
// Lógica completa para gestionar reservas de The Pets Lovers. Incluye cálculo de precios,
// packs de días, suplementos, exóticos, autocompletado de servicio y nombre, control de
// autenticación, envío a Firestore y EmailJS y desgloses detallados.

(function(){
  'use strict';

  /* ===========================
     Unificar Nombre y Apellidos
     =========================== */
  function unifyNameFields(){
    const firstNameEl = document.getElementById('firstName');
    const lastNameEl  = document.getElementById('lastName');
    if(!firstNameEl || !lastNameEl) return;
    const label = document.querySelector('label[for="firstName"]');
    if(label) label.textContent = 'Nombre y apellidos';
    if(firstNameEl.placeholder) firstNameEl.placeholder = 'Nombre y apellidos';
    setTimeout(()=>{
      const nameVal = (firstNameEl.value || '').trim();
      const surVal  = (lastNameEl.value  || '').trim();
      if(surVal){
        if(!nameVal || !nameVal.toLowerCase().includes(surVal.toLowerCase())){
          firstNameEl.value = `${nameVal} ${surVal}`.trim();
          try{
            firstNameEl.dispatchEvent(new Event('input', { bubbles:true }));
            firstNameEl.dispatchEvent(new Event('change',{ bubbles:true }));
          }catch(_){}
        }
      }
      const container = lastNameEl.closest('.booking-field') || lastNameEl.parentElement;
      if(container) container.style.display = 'none';
    }, 800);
  }

  /* ===========================
     Preseleccionar servicio desde servicios.html
     =========================== */
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
        try{
          svcSelect.dispatchEvent(new Event('change', { bubbles:true }));
        }catch(_){}
      }
    }
  }

  /* ===========================
     Tarifas base, bonos y exóticos
     =========================== */
  const PRICES = {
    base: { visitas: 22, paseos: 12, guarderia: 15, alojamiento: 30, bodas: 0, postquirurgico: 0, transporte: 20, exoticos: 0 },
    puppyBase: { guarderia: 20, alojamiento: 35 },
    visita60: 22, visita90: 30, visita60_larga: 18, visita90_larga: 27,
    visitaMed: 12, visitaMed_larga: 10,
    paseoStd: 12,
    paseoExtraPerro: 8,
    paseoBonos: { 10:115, 15:168, 20:220, 25:270, 30:318 },
    alojSegundoPerroDia: 25,
    alojSegundoPerroD11: 22,
    depositPct: 0.30
  };
  const BUNDLE_GUARDERIA = {
    adult: { 10: 135, 20: 250, 30: 315 },
    puppy: { 10: 185, 20: 350, 30: 465 }
  };
  // Tarifas por día para animales exóticos; ajustar según tarifas reales
  const EXOTIC_PRICES = {
    conejo: 15,
    pajaro: 12,
    huron: 18,
    iguana: 20,
    otro: null // precio a consultar
  };

  /* ===========================
     Utilidades
     =========================== */
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

  /* ===========================
     Cambio dinámico de opciones exóticas
     =========================== */
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

  /* ===========================
     Cálculo de costes y desglose visible
     =========================== */
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

    let baseCost = 0;
    let visit1Cost = 0;
    let visit2Cost = 0;
    let supplementPetsCost = 0;
    let bono = 0;
    let discountDays = 0;
    let exoticUnpriced = false;
    let packInfo = null;

    if(svc === 'visitas'){
      const longStay = nDias >= 11;
      visit1Cost = (visitDur === 90 ? (longStay ? PRICES.visita90_larga : PRICES.visita90)
                                    : (longStay ? PRICES.visita60_larga : PRICES.visita60)) * nDias;
      visit2Cost = (visitDaily === 2 ? (longStay ? PRICES.visitaMed_larga : PRICES.visitaMed) : 0) * nDias;
      if(nMasc > 1){
        const extra = nMasc - 1;
        if(extra === 1) supplementPetsCost += 12;
        else if(extra === 2) supplementPetsCost += 8 * 2;
        else supplementPetsCost += 6 * extra;
      }
    } else if(svc === 'paseos'){
      const pricePerDay = PRICES.paseoStd;
      const packSizes = Object.keys(PRICES.paseoBonos)
        .map(s => parseInt(s,10))
        .filter(size => size <= nDias)
        .sort((a,b) => a - b);
      const normalCost = nDias * pricePerDay;
      if(packSizes.length > 0){
        const packDays = packSizes[packSizes.length - 1];
        const packPrice = PRICES.paseoBonos[packDays];
        const remaining = nDias - packDays;
        baseCost = packPrice + (remaining * pricePerDay);
        discountDays = packDays;
        bono = normalCost - baseCost;
        packInfo = { days: packDays, price: packPrice, remaining, perDay: pricePerDay };
      } else {
        baseCost = normalCost;
      }
      if(nMasc > 1){
        supplementPetsCost = (nMasc - 1) * nDias * PRICES.paseoExtraPerro;
      }
    } else if(svc === 'guarderia'){
      const isPuppy = (document.getElementById('isPuppy')?.value === 'si');
      const perDay = isPuppy ? (PRICES.puppyBase.guarderia ?? PRICES.base.guarderia) : PRICES.base.guarderia;
      const table  = isPuppy ? BUNDLE_GUARDERIA.puppy : BUNDLE_GUARDERIA.adult;
      const normalCost = perDay * nDias;
      const packSizes = Object.keys(table)
        .map(s => parseInt(s,10))
        .filter(size => size <= nDias)
        .sort((a,b) => a - b);
      if(packSizes.length > 0){
        const packDays = packSizes[packSizes.length - 1];
        const packPrice = table[packDays];
        const remaining = nDias - packDays;
        baseCost = packPrice + (remaining * perDay);
        discountDays = packDays;
        bono = normalCost - baseCost;
        packInfo = { days: packDays, price: packPrice, remaining, perDay: perDay };
      } else {
        baseCost = normalCost;
      }
      if(nMasc >= 2) supplementPetsCost += 12 * nDias;
      if(nMasc >= 3) supplementPetsCost += (nMasc - 2) * 8 * nDias;
    } else if(svc === 'alojamiento'){
      const isPuppy = (document.getElementById('isPuppy')?.value === 'si');
      const baseDia = isPuppy ? PRICES.puppyBase.alojamiento : PRICES.base.alojamiento;
      const baseLong= isPuppy ? 32 : 27;
      const rate    = (nDias >= 11) ? baseLong : baseDia;
      baseCost = rate * nDias;
      if(species === 'perro' && nMasc >= 2){
        const extraRate = (nDias >= 11) ? PRICES.alojSegundoPerroD11 : PRICES.alojSegundoPerroDia;
        supplementPetsCost = (nMasc - 1) * extraRate * nDias;
      }
    } else if(svc === 'exoticos'){
      const exoticType = species || 'otro';
      const pricePerDay = EXOTIC_PRICES[exoticType];
      if(pricePerDay != null){
        baseCost = pricePerDay * nDias;
      } else {
        exoticUnpriced = true;
        baseCost = 0;
      }
      if(nMasc > 1){
        supplementPetsCost = 0; // añadir si procede
      }
    } else {
      baseCost = PRICES.base[svc] || 0;
    }

    const totalBeforeBono = baseCost + visit1Cost + visit2Cost + supplementPetsCost;
    const subtotal = totalBeforeBono - bono;
    const deposit  = subtotal * PRICES.depositPct;

    // Actualización del panel
    const byId = id => document.getElementById(id);
    const els = {
      sumBase: byId('sumBase'),
      sumVisit1: byId('sumVisit1'),
      sumVisit2: byId('sumVisit2'),
      sumPets: byId('sumPets'),
      sumFestivo: byId('sumFestivo'),
      sumSenalado: byId('sumSenalado'),
      sumTravel: byId('sumTravel'),
      sumBono: byId('sumBono'),
      rowBono: document.getElementById('rowBono'),
      sumSubtotal: byId('sumSubtotal'),
      sumDeposit: byId('sumDeposit')
    };
    // Mostrar base; si no hay precio (exóticos sin tarifa), mostrar '—'
    els.sumBase.textContent = (!exoticUnpriced && baseCost > 0) ? currency(baseCost) : '—';
    els.sumVisit1.textContent = currency(visit1Cost);
    els.sumVisit2.textContent = currency(visit2Cost);
    els.sumPets.textContent   = currency(supplementPetsCost);
    // Tooltip con detalle del bono
    if(els.sumBase && els.sumBase.parentElement){
      if(packInfo){
        let tip = `Bono ${packInfo.days} días: ${currency(packInfo.price)} €`;
        if(packInfo.remaining > 0){
          tip += `; ${packInfo.remaining} × ${currency(packInfo.perDay)} € = ${currency(packInfo.remaining * packInfo.perDay)} €`;
        }
        els.sumBase.parentElement.title = tip;
        els.sumBase.parentElement.setAttribute('aria-label', tip);
      } else {
        els.sumBase.parentElement.title = '';
        els.sumBase.parentElement.removeAttribute('aria-label');
      }
    }
    // Reutilizar fila de Festivos para el bono
    const festLabelEl = els.sumFestivo?.previousElementSibling;
    if(festLabelEl && !festLabelEl.dataset.origLabel){
      festLabelEl.dataset.origLabel = festLabelEl.textContent;
    }
    if(packInfo){
      festLabelEl.textContent = `Paquete ${packInfo.days} días`;
      let valTxt = currency(packInfo.price);
      if(packInfo.remaining > 0){
        valTxt += ` (+${packInfo.remaining}×${currency(packInfo.perDay)}€)`;
      }
      els.sumFestivo.textContent = valTxt;
    } else {
      festLabelEl.textContent = festLabelEl.dataset.origLabel || 'Festivos (auto)';
      els.sumFestivo.textContent = '0.00';
    }
    // Bono/Descuento
    if(els.rowBono){
      if(bono > 0){
        els.rowBono.style.display = '';
        const label = els.rowBono.querySelector('.summary-label');
        if(label) label.textContent = `Descuento (${discountDays} días)`;
        els.sumBono.textContent = currency(bono);
      } else {
        els.rowBono.style.display = 'none';
        els.sumBono.textContent = '0.00';
      }
    }
    // Subtotal y depósito
    els.sumSubtotal.textContent = (!exoticUnpriced) ? currency(subtotal) : '—';
    els.sumDeposit.textContent  = (!exoticUnpriced) ? currency(deposit)  : '—';

    // Mostrar/ocultar filas de visitas
    const rowVisit1 = document.getElementById('rowVisit1');
    const rowVisit2 = document.getElementById('rowVisit2');
    if(rowVisit1) rowVisit1.style.display = (visit1Cost > 0) ? '' : 'none';
    if(rowVisit2) rowVisit2.style.display = (visit2Cost > 0) ? '' : 'none';

    // Construcción del resumen oculto
    const summaryArr = [];
    summaryArr.push(`Días: ${nDias}`);
    if(baseCost > 0 && !exoticUnpriced) summaryArr.push(`Base: ${currency(baseCost)} €`);
    if(visit1Cost > 0) summaryArr.push(`1ª visita: ${currency(visit1Cost)} €`);
    if(visit2Cost > 0) summaryArr.push(`2ª visita: ${currency(visit2Cost)} €`);
    if(packInfo){
      summaryArr.push(`Paquete ${packInfo.days} días: ${currency(packInfo.price)} €`);
      if(packInfo.remaining > 0){
        summaryArr.push(`${packInfo.remaining} día(s) extra: ${currency(packInfo.remaining * packInfo.perDay)} €`);
      }
    }
    if(supplementPetsCost > 0) summaryArr.push(`Suplementos mascotas: ${currency(supplementPetsCost)} €`);
    if(bono > 0) summaryArr.push(`Descuento (${discountDays} días): -${currency(bono)} €`);
    summaryArr.push(!exoticUnpriced ? `Subtotal: ${currency(subtotal)} €` : `Precio a consultar`);
    if(!exoticUnpriced) summaryArr.push(`Depósito: ${currency(deposit)} €`);
    const summaryField = document.getElementById('summaryField');
    if(summaryField) summaryField.value = summaryArr.join(' | ');
  }

  /* ===========================
     Enlazar eventos
     =========================== */
  function bindEvents(){
    const ids = ['service','species','isPuppy','startDate','endDate','visitDuration','visitDaily','numPets','numPetsExact'];
    ids.forEach(id=>{
      const el = document.getElementById(id);
      if(el) el.addEventListener('change', () => {
        if(id === 'service'){ toggleExoticSpecies(); }
        computeCosts();
      });
      if(el && el.tagName === 'INPUT') el.addEventListener('input', computeCosts);
    });
  }

  /* ===========================
     Inicialización y envío
     =========================== */
  document.addEventListener('DOMContentLoaded', () => {
    preselectService();
    unifyNameFields();
    toggleExoticSpecies();
    bindEvents();
    // Esperar a que otros scripts internos calculen y luego recalcular el desglose
    computeCosts();
    setTimeout(computeCosts, 500); // asegura que nuestro desglose prevalezca

    // Control de autenticación y habilitación del formulario
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

    // Gestión del envío del formulario
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
        // Recalcular desglose antes de enviar
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

  // Exponemos computeCosts() para que reserva.html pueda llamarlo al terminar recalc()
  window.updateSummaryFromJS = computeCosts;
})();
