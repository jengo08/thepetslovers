// reservas.js (REEMPLAZAR ENTERO)
// Este script gestiona el cálculo de tarifas, bloqueo de envío, alta en Firestore y envío con EmailJS.
// Además, unifica los campos de nombre y apellidos en un único campo para evitar confusión.

(function(){
  'use strict';

  /* ===========================
     Unificar Nombre y Apellidos
     =========================== */
  /**
   * Combina el contenido de los campos de nombre y apellidos en un solo campo.
   * Oculta el campo de apellidos para simplificar el formulario. Mantiene el input
   * de apellidos en el DOM (aunque oculto) para que otros scripts que dependan
   * de su existencia no fallen. Actualiza la etiqueta del campo de nombre.
   */
  function unifyNameFields(){
    const firstNameEl = document.getElementById('firstName');
    const lastNameEl  = document.getElementById('lastName');
    if(!firstNameEl || !lastNameEl) return;
    // Cambiar etiqueta del primer campo
    const label = document.querySelector('label[for="firstName"]');
    if(label) label.textContent = 'Nombre y apellidos';
    // Cambiar placeholder
    if(firstNameEl.placeholder) firstNameEl.placeholder = 'Nombre y apellidos';
    // Unir valores (esperamos a que otros scripts autocompleten primero)
    setTimeout(()=>{
      const nameVal = (firstNameEl.value || '').trim();
      const surVal  = (lastNameEl.value  || '').trim();
      if(surVal){
        // Si el apellido aún no está incluido en el nombre, combínalos
        if(!nameVal || !nameVal.toLowerCase().includes(surVal.toLowerCase())){
          firstNameEl.value = `${nameVal} ${surVal}`.trim();
          try{
            firstNameEl.dispatchEvent(new Event('input', { bubbles:true }));
            firstNameEl.dispatchEvent(new Event('change',{ bubbles:true }));
          }catch(_){/* ignore */}
        }
      }
      // Ocultar el campo de apellidos conservando el input (para compatibilidad)
      const container = lastNameEl.closest('.booking-field') || lastNameEl.parentElement;
      if(container) container.style.display = 'none';
    }, 800);
  }

  /* ===========================
     Tarifas base y bonos
     =========================== */
  // Las tarifas se definen como constantes para mantener el cálculo centralizado.
  const PRICES = {
    base: { visitas: 22, paseos: 12, guarderia: 15, alojamiento: 30, bodas: 0, postquirurgico: 0, transporte: 20, exoticos: 0 },
    puppyBase: { guarderia: 20, alojamiento: 35 },
    visita60: 22, visita90: 30, visita60_larga: 18, visita90_larga: 27,
    visitaMed: 12, visitaMed_larga: 10,
    paseoStd: 12,
    paseoExtraPerro: 8,
    paseoBonos: { 10: 115, 15: 168, 20: 220, 25: 270, 30: 318 },
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

  /* ===========================
     Cálculo de costes y actualización UI
     =========================== */
  function computeCosts(){
    const svc = document.getElementById('service')?.value || '';
    const species = document.getElementById('species')?.value || 'perro';
    const isPuppy = document.getElementById('isPuppy')?.value === 'si';
    const visitDur  = parseInt(document.getElementById('visitDuration')?.value || '60', 10);
    const visitDaily= parseInt(document.getElementById('visitDaily')?.value || '1', 10);
    const nMasc = getNumMascotas();
    const nDias = getDays();

    let base = 0, visit1 = 0, visit2 = 0, extras = 0, bono = 0;

    if(svc === 'visitas'){
      const long = nDias >= 11;
      visit1 = (visitDur === 90 ? (long ? PRICES.visita90_larga : PRICES.visita90) :
                               (long ? PRICES.visita60_larga : PRICES.visita60)) * nDias;
      visit2 = (visitDaily === 2 ? (long ? PRICES.visitaMed_larga : PRICES.visitaMed) : 0) * nDias;
      if(nMasc > 1){
        const extra = nMasc - 1;
        if(extra === 1) extras += 12;
        else if(extra === 2) extras += 8 * 2;
        else extras += 6 * extra;
      }
    } else if(svc === 'paseos'){
      const bonoWalks = PRICES.paseoBonos[nDias] || null;
      const firstDog = bonoWalks !== null ? bonoWalks : (nDias * PRICES.paseoStd);
      const extrasPerro = (nMasc - 1) > 0 ? (nMasc - 1) * nDias * PRICES.paseoExtraPerro : 0;
      base = firstDog + extrasPerro;
    } else if(svc === 'guarderia'){
      const perDay = isPuppy ? (PRICES.puppyBase.guarderia ?? PRICES.base.guarderia) : PRICES.base.guarderia;
      const table  = isPuppy ? BUNDLE_GUARDERIA.puppy : BUNDLE_GUARDERIA.adult;
      const bundle = table[nDias] || null;
      if(bundle){
        base = bundle;
        if(nMasc >= 2) base += 12 * nDias;
        if(nMasc >= 3) base += (nMasc - 2) * 8 * nDias;
        const normalTotal = perDay * nDias;
        bono = Math.max(0, normalTotal - bundle);
      } else {
        base = perDay * nDias;
        if(nMasc >= 2) base += 12 * nDias;
        if(nMasc >= 3) base += (nMasc - 2) * 8 * nDias;
      }
    } else if(svc === 'alojamiento'){
      const dayBase = isPuppy ? PRICES.puppyBase.alojamiento : PRICES.base.alojamiento;
      const dayLong = isPuppy ? 32 : 27;
      const rate1 = (nDias >= 11) ? dayLong : dayBase;
      base = rate1 * nDias;
      if(species === 'perro' && nMasc >= 2){
        const extraRate = (nDias >= 11) ? PRICES.alojSegundoPerroD11 : PRICES.alojSegundoPerroDia;
        base += (nMasc - 1) * extraRate * nDias;
      }
    } else {
      const svcBase = PRICES.base[svc] || 0;
      base = svcBase;
    }

    const sumBase = base + visit1 + visit2 + extras;
    const subtotal = sumBase - bono;
    const deposit = subtotal * PRICES.depositPct;

    // Actualiza el desglose en pantalla
    const setText = (id, val) => {
      const el = document.getElementById(id);
      if(el) el.textContent = val;
    };
    setText('sumBase', currency(sumBase));
    setText('sumVisit1', currency(visit1));
    setText('sumVisit2', currency(visit2));
    setText('sumPets', currency(extras));
    setText('sumFestivo', currency(0));
    setText('sumSenalado', currency(0));
    setText('sumBono', currency(bono));
    setText('sumSubtotal', currency(subtotal));
    setText('sumDeposit', currency(deposit));

    // Mostrar u ocultar filas según corresponda
    const rowVisit1 = document.getElementById('rowVisit1');
    const rowVisit2 = document.getElementById('rowVisit2');
    const rowBono   = document.getElementById('rowBono');
    if(rowVisit1) rowVisit1.style.display = visit1 > 0 ? '' : 'none';
    if(rowVisit2) rowVisit2.style.display = visit2 > 0 ? '' : 'none';
    if(rowBono)   rowBono.style.display   = bono > 0 ? '' : 'none';

    // Genera texto resumido para el campo oculto Desglose
    const summaryArr = [];
    summaryArr.push(`Base: ${currency(sumBase)} €`);
    if(visit1 > 0 || visit2 > 0) summaryArr.push(`Visitas: ${currency(visit1 + visit2)} €`);
    if(extras > 0) summaryArr.push(`Suplementos: ${currency(extras)} €`);
    if(bono > 0) summaryArr.push(`Bono: -${currency(bono)} €`);
    summaryArr.push(`Subtotal: ${currency(subtotal)} €`);
    summaryArr.push(`Depósito: ${currency(deposit)} €`);
    const summaryTxt = summaryArr.join(' | ');
    const summaryField = document.getElementById('summaryField');
    if(summaryField) summaryField.value = summaryTxt;
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
    // Unificar campos de nombre y apellidos
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
        }catch(_){ /* si falla, seguimos, pero es probable que no haya perfil */ }
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
          // Redirige si el HTML define data-tpl-redirect y data-tpl-wait
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
