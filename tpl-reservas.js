// reservas.js (REEMPLAZAR ENTERO)
// Lógica de reservas para The Pets Lovers. Calcula tarifas, muestra el desglose de días,
// suplementos y descuentos por packs de varios días, bloquea el envío sin perfil,
// guarda en Firestore y envía notificación por EmailJS.

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
     Preseleccionar servicio
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
     Tarifas base y bonos
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
  /* Actualiza la fila de días en el resumen */
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
     Cálculo de costes y actualización UI
     =========================== */
  function computeCosts(){
    const svc = document.getElementById('service')?.value || '';
    const species = document.getElementById('species')?.value || 'perro';
    const visitDur  = parseInt(document.getElementById('visitDuration')?.value || '60', 10);
    const visitDaily= parseInt(document.getElementById('visitDaily')?.value || '1', 10);
    const nMasc = getNumMascotas();
    const rawDays = getDays();
    const nDias = Math.max(rawDays, 1);
    // Actualiza el contador de días en el resumen
    updateDaysRow(nDias);

    let baseCost = 0;      // Precio base para 1 mascota
    let visit1Cost = 0;    // Coste de visitas principales
    let visit2Cost = 0;    // Coste de visitas secundarias
    let supplementPetsCost = 0; // Suplementos por mascotas adicionales
    let bono = 0;          // Descuento por packs o bonos
    let discountDays = 0;  // Número de días que originan el bono

    if(svc === 'visitas'){
      // Cálculo para visitas a domicilio (gatos)
      const longStay = nDias >= 11;
      const pricePerDay = (visitDur === 90) ? (longStay ? PRICES.visita90_larga : PRICES.visita90) :
                                             (longStay ? PRICES.visita60_larga : PRICES.visita60);
      visit1Cost = pricePerDay * nDias;
      if(visitDaily === 2){
        const priceMed = longStay ? PRICES.visitaMed_larga : PRICES.visitaMed;
        visit2Cost = priceMed * nDias;
      }
      if(nMasc > 1){
        const extras = nMasc - 1;
        if(extras === 1) supplementPetsCost = 12;
        else if(extras === 2) supplementPetsCost = 8 * 2;
        else supplementPetsCost = extras * 6;
      }
      baseCost = 0;
    } else if(svc === 'paseos'){
      // Paseos con bono por packs de 10/15/20/25/30 días
      const bonoWalks = PRICES.paseoBonos[nDias] || null;
      const normalCost = nDias * PRICES.paseoStd;
      if(bonoWalks !== null){
        baseCost = bonoWalks;
        bono = normalCost - bonoWalks;
        discountDays = nDias;
      } else {
        baseCost = normalCost;
      }
      if(nMasc > 1){
        supplementPetsCost = (nMasc - 1) * nDias * PRICES.paseoExtraPerro;
      }
    } else if(svc === 'guarderia'){
      // Guardería de día con paquetes para adultos o cachorros
      const isPuppy = (document.getElementById('isPuppy')?.value === 'si');
      const perDay = isPuppy ? (PRICES.puppyBase.guarderia ?? PRICES.base.guarderia) : PRICES.base.guarderia;
      const table  = isPuppy ? BUNDLE_GUARDERIA.puppy : BUNDLE_GUARDERIA.adult;
      const bundle = table[nDias] || null;
      const normalCost = perDay * nDias;
      if(bundle){
        baseCost = bundle;
        bono = normalCost - bundle;
        discountDays = nDias;
      } else {
        baseCost = normalCost;
      }
      if(nMasc >= 2){
        supplementPetsCost += 12 * nDias;       // segundo perro
        if(nMasc >= 3) supplementPetsCost += (nMasc - 2) * 8 * nDias; // tercero y sucesivos
      }
    } else if(svc === 'alojamiento'){
      // Alojamiento: tarifa diferente a partir del día 11 y suplementos por perro extra
      const isPuppy = (document.getElementById('isPuppy')?.value === 'si');
      const baseDia = isPuppy ? PRICES.puppyBase.alojamiento : PRICES.base.alojamiento;
      const baseLong= isPuppy ? 32 : 27;
      const rate    = (nDias >= 11) ? baseLong : baseDia;
      baseCost = rate * nDias;
      if(species === 'perro' && nMasc >= 2){
        const extraRate = (nDias >= 11) ? PRICES.alojSegundoPerroD11 : PRICES.alojSegundoPerroDia;
        supplementPetsCost = (nMasc - 1) * extraRate * nDias;
      }
    } else {
      // Otros servicios (bodas, postquirúrgico, transporte, exóticos)
      baseCost = PRICES.base[svc] || 0;
      supplementPetsCost = 0;
    }

    // Totales
    const totalBeforeBono = baseCost + visit1Cost + visit2Cost + supplementPetsCost;
    const subtotal = totalBeforeBono - bono;
    const deposit  = subtotal * PRICES.depositPct;

    // Actualiza UI
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
    els.sumBase.textContent     = currency(baseCost);
    els.sumVisit1.textContent   = currency(visit1Cost);
    els.sumVisit2.textContent   = currency(visit2Cost);
    els.sumPets.textContent     = currency(supplementPetsCost);
    els.sumFestivo.textContent  = '0.00';
    // sumSenalado se actualiza con updateDaysRow
    // Desplazamiento permanece como 'pendiente'

    // Mostrar/ocultar filas de visita
    const rowVisit1 = document.getElementById('rowVisit1');
    const rowVisit2 = document.getElementById('rowVisit2');
    if(rowVisit1) rowVisit1.style.display = (visit1Cost > 0) ? '' : 'none';
    if(rowVisit2) rowVisit2.style.display = (visit2Cost > 0) ? '' : 'none';

    // Descuento por bono (guardería o paseos)
    if(els.rowBono){
      if(bono > 0){
        els.rowBono.style.display = '';
        const label = els.rowBono.querySelector('.summary-label');
        if(label){
          label.textContent = `Descuento (${discountDays} días)`;
        }
        els.sumBono.textContent = currency(bono);
      }else{
        els.rowBono.style.display = 'none';
        els.sumBono.textContent = '0.00';
      }
    }
    els.sumSubtotal.textContent = currency(subtotal);
    els.sumDeposit.textContent  = currency(deposit);

    // Componer el resumen para el campo oculto
    const summaryArr = [];
    summaryArr.push(`Días: ${nDias}`);
    if(baseCost > 0) summaryArr.push(`Base: ${currency(baseCost)} €`);
    if(visit1Cost > 0) summaryArr.push(`1ª visita: ${currency(visit1Cost)} €`);
    if(visit2Cost > 0) summaryArr.push(`2ª visita: ${currency(visit2Cost)} €`);
    if(supplementPetsCost > 0) summaryArr.push(`Suplementos mascotas: ${currency(supplementPetsCost)} €`);
    if(bono > 0) summaryArr.push(`Descuento (${discountDays} días): -${currency(bono)} €`);
    summaryArr.push(`Subtotal: ${currency(subtotal)} €`);
    summaryArr.push(`Depósito: ${currency(deposit)} €`);
    const summaryField = document.getElementById('summaryField');
    if(summaryField) summaryField.value = summaryArr.join(' | ');
  }

  function bindEvents(){
    const ids = ['service','species','isPuppy','startDate','endDate','visitDuration','visitDaily','numPets','numPetsExact'];
    ids.forEach(id=>{
      const el = document.getElementById(id);
      if(el) el.addEventListener('change', computeCosts);
      if(el && el.tagName === 'INPUT') el.addEventListener('input', computeCosts);
    });
  }

  /* ===========================
     Inicialización
     =========================== */
  document.addEventListener('DOMContentLoaded', () => {
    preselectService();
    unifyNameFields();
    bindEvents();
    computeCosts();
    // Bloqueo/activación según login
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
    // Envío del formulario: crea reserva en Firestore y envía EmailJS
    const form = document.getElementById('bookingForm');
    if(form){
      form.addEventListener('submit', async (ev) => {
        ev.preventDefault();
        ev.stopPropagation();
        // Verificar sesión
        const auth = (typeof firebase !== 'undefined' && firebase.auth) ? firebase.auth() : null;
        const user = auth?.currentUser || null;
        if(!user){
          alert('Debes iniciar sesión para reservar.');
          return;
        }
        // Asegurar que el usuario tenga perfil (colección propietarios/usuarios)
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
        // Actualiza desglose antes de enviar
        computeCosts();
        // Preparar carga útil a partir del formulario
        const fd = new FormData(form);
        const payload = {};
        for(const [k,v] of fd.entries()){
          payload[k] = v;
        }
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
        }catch(err){
          console.warn('No se pudo guardar la reserva en Firestore', err);
        }
        // Enviar EmailJS (usa placeholders si no hay datos reales)
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
        }catch(err){
          console.warn('No se pudo enviar la reserva por EmailJS', err);
        }
        if(saved || mailed){
          alert('Tu reserva se ha enviado correctamente.');
          const redirect = form.dataset.tplRedirect || form.getAttribute('data-tpl-redirect');
          const wait = parseInt(form.dataset.tplWait || form.getAttribute('data-tpl-wait') || '800', 10);
          if(redirect){
            setTimeout(() => { window.location.href = redirect; }, wait);
          } else {
            form.reset();
          }
        } else {
          alert('No se pudo enviar la reserva. Por favor, inténtalo de nuevo.');
        }
      });
    }
  });
})();
