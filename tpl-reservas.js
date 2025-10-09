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
      const first = Math.min(1, dogs.length), second
