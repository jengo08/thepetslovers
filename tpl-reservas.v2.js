/* TPL · reservas v2 — cálculo, UI y envío (DOM de tu reserva.html) */
(function(){
  const hasFb = !!(window.firebase && firebase.firestore && firebase.auth);
  if (!hasFb){ console.warn('[TPL] Falta Firebase.'); return; }
  const db = firebase.firestore();

  // ====== PRECIOS (cliente) ======
  const P = {
    daycare: { adult: 15, puppy: 20, bonosAdulto:{10:135,20:250,30:315}, bonosPuppy:{10:185,20:350,30:465} },
    visita_gato: {
      base60:{ d1_10:22, d11p:18 },
      base90:{ d1_10:30, d11p:27 },
      med15:{ d1_10:12, d11p:10 },
      extraCats:{ oneMore:12, twoEach:8, threePlusEach:6 }
    },
    overnight:{ adult:{ d1_10:30, d11p:27 }, puppy:{ d1_10:35, d11p:32 }, secondDog:{ d1_10:25, d11p:22 } },
    walk60:{ price:12, secondPet:8, bonos:{10:115,15:168,20:220,25:270,30:318} },
    exoticos:{ aves:20, reptiles:20, pequenos_mamiferos:25, otro:20 },
    transporte:{ flat:20 },
    supplements:{ urgencia:10, festivo:10, senalado:30 }
  };

  // ====== COSTE AUXILIAR (para calcular tu margen) ======
  // Si quieres exactitud al céntimo, pon aquí tus costes internos por día/visita.
  const AUX = {
    daycare:{ adult:null, puppy:null },              // p.ej. 11 y 15 si los tienes
    visita_gato:{ base60:null, base90:null, med15:null },
    overnight:{ adult:null, puppy:null, secondDog:null },
    walk60:{ base:null, secondPet:null },
    exoticos:{ aves:null, reptiles:null, pequenos_mamiferos:null, otro:null },
    transporte:{ flat:null },
    festivo_aux:{ normal:8, senalado:15 }
  };
  const MARGIN_FALLBACK = 0.20; // 20% si no hay AUX

  // ====== DOM ======
  const $ = s=>document.querySelector(s);
  const $$ = s=>Array.from(document.querySelectorAll(s));
  const fmt = n=> new Intl.NumberFormat('es-ES',{style:'currency',currency:'EUR'}).format(n||0);
  const todayStr = ()=> new Date().toISOString().slice(0,10);

  const inlineHost = document.getElementById('inlineControls');
  const summaryGrid = document.getElementById('summaryGrid');

  function daysInclusive(a,b){
    const d1 = new Date(a), d2 = new Date(b);
    if (isNaN(+d1)||isNaN(+d2)) return 0;
    return Math.round((d2-d1)/(1000*60*60*24)) + 1;
  }
  function getQueryService(){
    const u = new URL(location.href);
    return u.searchParams.get('service') || u.searchParams.get('svc');
  }

  // ====== Estado ======
  const S = {
    service:'', startDate:'', endDate:'', startTime:'', endTime:'',
    pets:[], // {id,name,species,isPuppy}
    // específicos
    bono:null,                 // daycare 10/20/30
    numWalks:1, secondPet:false, // walk60
    duration:'60', med15:false, visitsPerDay:1, catsCount:1, // visita gato
    exoSubtype:'aves',
    urgencia:false, festivo:false, senalado:false
  };

  // ====== UI condicional ======
  function syncSpeciesUI(){
    const row = $('#speciesRow');
    const wrapExo = $('#exoticosSubtypeWrap');
    const inp = $('#species');
    row.hidden = true; wrapExo.hidden = true; inp.value = '';
    if (S.service==='visita_gato'){ row.hidden=false; inp.value='Gato'; }
    if (S.service==='exoticos'){ row.hidden=false; inp.value='Exótico'; wrapExo.hidden=false; }
  }

  function ensureInlineControls(){
    if (inlineHost.dataset.ready) {
      // toggle
      inlineHost.querySelectorAll('[data-for]').forEach(g=>{
        const t = g.getAttribute('data-for');
        g.hidden = !((t===S.service) || (t==='supps'));
      });
      return;
    }
    inlineHost.dataset.ready = '1';
    inlineHost.innerHTML = `
      <div class="booking-section" data-for="daycare">
        <div class="row two">
          <div>
            <label>¿Bono guardería?</label>
            <select id="daycareBono">
              <option value="">Sin bono</option>
              <option value="10">Bono 10</option>
              <option value="20">Bono 20</option>
              <option value="30">Bono 30</option>
            </select>
          </div>
        </div>
      </div>

      <div class="booking-section" data-for="walk60" hidden>
        <div class="row two">
          <div>
            <label>Nº de paseos</label>
            <input id="walkNum" type="number" min="1" value="1" />
          </div>
          <div style="display:flex; align-items:center; gap:.4rem;">
            <input id="walkSecond" type="checkbox" /> <label for="walkSecond">2ª mascota</label>
          </div>
        </div>
      </div>

      <div class="booking-section tpl-visitas-only" data-for="visita_gato" hidden>
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
          <div style="display:flex; align-items:center; gap:.4rem;">
            <input id="vgMed" type="checkbox" /> <label for="vgMed">¿Medicaciones 15’?</label>
          </div>
        </div>
      </div>

      <div class="booking-section" data-for="supps">
        <div class="row three">
          <label style="display:flex; align-items:center; gap:.4rem;"><input id="supUrg" type="checkbox" /> Urgencia</label>
          <label style="display:flex; align-items:center; gap:.4rem;"><input id="supFest" type="checkbox" /> Festivo</label>
          <label style="display:flex; align-items:center; gap:.4rem;"><input id="supSen" type="checkbox" /> Días señalados</label>
        </div>
      </div>
    `;

    const bind = (id, key, type='value')=>{
      const el = document.getElementById(id); if(!el) return;
      const save = ()=> localStorage.setItem(key, (type==='checked') ? (el.checked ? '1':'0') : el.value);
      el.addEventListener('input', ()=>{ save(); refresh(); });
      el.addEventListener('change', ()=>{ save(); refresh(); });
    };
    bind('daycareBono','daycareBono');
    bind('walkNum','walkNum'); bind('walkSecond','walkSecond','checked');
    bind('vgDur','vgDur'); bind('vgVpd','vgVpd'); bind('vgCats','vgCats'); bind('vgMed','vgMed','checked');
    bind('supUrg','supUrg','checked'); bind('supFest','supFest','checked'); bind('supSen','supSen','checked');

    // primer toggle
    ensureInlineControls();
  }

  // ====== Cálculo del desglose ======
  function compute(){
    const items=[]; let subtotal=0; let festivoAux=0;
    const add = (label,amount)=>{ if(!amount) return; items.push([label,amount]); subtotal += amount; };

    const d = daysInclusive(S.startDate, S.endDate);
    const isLong = d >= 11;

    if (S.service==='daycare'){
      const anyPuppy = S.pets.some(p=>p.isPuppy);
      const rate = anyPuppy ? P.daycare.puppy : P.daycare.adult;
      if (S.bono && [10,20,30].includes(S.bono) && d===S.bono){
        const bono = anyPuppy ? P.daycare.bonosPuppy[S.bono] : P.daycare.bonosAdulto[S.bono];
        add(`Bono ${S.bono} días`, bono);
      } else {
        add(`Base (${d} día/s × ${Math.max(1,S.pets.length)} mascota/s)`, d * rate * Math.max(1,S.pets.length));
      }
    }

    if (S.service==='overnight'){
      const anyPuppy = S.pets.some(p=>p.isPuppy);
      const table = anyPuppy ? P.overnight.puppy : P.overnight.adult;
      const rate = isLong ? table.d11p : table.d1_10;
      const dogs = S.pets.filter(p=>(p.species||'').toLowerCase()==='perro');
      const first = Math.min(1,dogs.length), second = Math.max(0, dogs.length-1);
      add(`Base 1º perro (${d}d)`, d*rate*first);
      if (second){
        const r2 = isLong ? P.overnight.secondDog.d11p : P.overnight.secondDog.d1_10;
        add(`2º perro (${d}d)`, d*r2*second);
      }
    }

    if (S.service==='walk60'){
      if (S.bono && P.walk60.bonos[S.bono]) add(`Bono paseos ×${S.bono}`, P.walk60.bonos[S.bono]);
      else {
        add(`Paseos (${S.numWalks}×)`, S.numWalks * P.walk60.price);
        if (S.secondPet) add(`2ª mascota (${S.numWalks}×)`, S.numWalks * P.walk60.secondPet);
      }
    }

    if (S.service==='visita_gato'){
      const visits = d * (S.visitsPerDay||1);
      const table = (S.duration==='90' ? P.visita_gato.base90 : P.visita_gato.base60);
      const rate  = isLong ? table.d11p : table.d1_10;
      add(`Visitas (${visits}×)`, visits * rate);
      if (S.med15){
        const medRate = isLong ? P.visita_gato.med15.d11p : P.visita_gato.med15.d1_10;
        add(`Medicaciones 15’ (${visits}×)`, visits * medRate);
      }
      const extra = Math.max(0, S.catsCount-1);
      if (extra>0){
        let supp = 0;
        if (extra===1) supp = P.visita_gato.extraCats.oneMore * visits;
        else if (extra===2) supp = (2 * P.visita_gato.extraCats.twoEach) * visits;
        else supp = (extra * P.visita_gato.extraCats.threePlusEach) * visits;
        add(`Supl. gatos adicionales (${visits}×)`, supp);
      }
    }

    if (S.service==='exoticos')  add(`Exóticos · ${S.exoSubtype}`, P.exoticos[S.exoSubtype] || P.exoticos.otro);
    if (S.service==='transporte') add('Transporte', P.transporte.flat);

    if (S.urgencia) add('Urgencia (mismo día <2h)', P.supplements.urgencia);
    if (S.festivo)  { add('Festivo', P.supplements.festivo); festivoAux += (AUX.festivo_aux?.normal || 0); }
    if (S.senalado) { add('Días señalados (24/12,25/12,31/12,01/01)', P.supplements.senalado); festivoAux += (AUX.festivo_aux?.senalado || 0); }

    // Cálculo margen ahora / pendiente
    // Si no defines AUX detallado, estimamos auxiliar = (1 - MARGIN_FALLBACK) * subtotal
    let aux = 0;
    if (!aux) aux = Math.max(0, subtotal * (1 - MARGIN_FALLBACK));
    const pagar_ahora = Math.max(0, subtotal - (aux + festivoAux));
    const pendiente   = Math.max(0, subtotal - pagar_ahora);

    return { items, subtotal, pagar_ahora, pendiente };
  }

  function renderBreakdown(bk){
    summaryGrid.innerHTML = '';
    bk.items.forEach(([label,amount])=>{
      const l = document.createElement('div'); l.className='summary-row';
      l.innerHTML = `<div class="summary-label">${label}</div><div class="summary-value">${fmt(amount)}</div>`;
      summaryGrid.appendChild(l);
    });
    const sep = document.createElement('div'); sep.style.gridColumn='1 / -1'; sep.style.borderTop='1px solid #eee'; sep.style.margin='6px 0';
    summaryGrid.appendChild(sep);
    summaryGrid.insertAdjacentHTML('beforeend', `<div class="summary-label"><strong>Subtotal</strong></div><div class="summary-value"><strong>${fmt(bk.subtotal)}</strong></div>`);
    summaryGrid.insertAdjacentHTML('beforeend', `<div class="summary-label"><strong>A pagar ahora</strong></div><div class="summary-value"><strong>${fmt(bk.pagar_ahora)}</strong></div>`);
    summaryGrid.insertAdjacentHTML('beforeend', `<div class="summary-label"><strong>Pendiente (12 días antes)</strong></div><div class="summary-value"><strong>${fmt(bk.pendiente)}</strong></div>`);
  }

  // ====== Captura de estado desde el DOM ======
  function collect(){
    const get = id => document.getElementById(id);
    S.service = get('service').value;
    S.startDate = get('startDate').value; S.endDate = get('endDate').value;
    S.startTime = get('startTime').value; S.endTime = get('endTime').value;

    // mascotas
    S.pets = $$('#petsList input[type="checkbox"]:checked').map(chk=>({
      id: chk.value,
      name: chk.closest('.pet-item')?.querySelector('strong')?.textContent || chk.value,
      species: chk.dataset.species || '',
      isPuppy: chk.dataset.ispuppy === '1'
    }));

    // específicos
    if (S.service==='daycare') S.bono = parseInt(localStorage.getItem('daycareBono')||'') || null;
    if (S.service==='walk60'){
      S.numWalks = parseInt(localStorage.getItem('walkNum')||'1');
      S.secondPet = (localStorage.getItem('walkSecond')==='1');
    }
    if (S.service==='visita_gato'){
      S.duration = localStorage.getItem('vgDur')||'60';
      S.visitsPerDay = parseInt(localStorage.getItem('vgVpd')||'1');
      S.catsCount = parseInt(localStorage.getItem('vgCats')||'1');
      S.med15 = (localStorage.getItem('vgMed')==='1');
    }
    if (S.service==='exoticos') S.exoSubtype = document.getElementById('exoticosSubtype').value || 'otro';

    // suplementos
    S.urgencia = (localStorage.getItem('supUrg')==='1');
    S.festivo  = (localStorage.getItem('supFest')==='1');
    S.senalado = (localStorage.getItem('supSen')==='1');

    return S;
  }

  function refresh(){
    collect();
    syncSpeciesUI();
    ensureInlineControls();
    const bk = compute();
    renderBreakdown(bk);
  }

  // ====== Lista de eventos ======
  document.getElementById('service').addEventListener('change', ()=>{
    localStorage.setItem('lastService', S.service = document.getElementById('service').value);
    refresh();
  });
  ['startDate','endDate','startTime','endTime'].forEach(id=> document.getElementById(id).addEventListener('change', refresh));
  document.getElementById('petsList').addEventListener('change', refresh);

  // ====== Submit → Firestore + EmailJS ======
  document.getElementById('bookingForm').addEventListener('submit', async (e)=>{
    e.preventDefault();
    const user = firebase.auth().currentUser;
    if (!user){ alert('Inicia sesión para reservar.'); return; }

    const bk = compute();
    const g = id=>document.getElementById(id)?.value||'';

    const doc = {
      _estado: 'paid_review',
      _uid: user.uid,
      _email: user.email || g('email'),
      _createdAt: firebase.firestore.FieldValue.serverTimestamp(),

      service: S.service,
      startDate: S.startDate, endDate: S.endDate,
      Hora_inicio: S.startTime, Hora_fin: S.endTime,
      species: (S.service==='visita_gato' ? 'Gato' : (S.service==='exoticos' ? (S.exoSubtype||'Exótico') : '')),
      pets: S.pets, catsCount: S.catsCount || null,

      titular: {
        firstName: g('fullName'), email: g('email'), phone: g('phone'),
        region: g('region'), address: g('address'), postalCode: g('postalCode'),
        observations: g('observations')
      },

      total_cliente: bk.subtotal,
      pagar_ahora:   bk.pagar_ahora,
      pendiente:     bk.pendiente,
      total_txt:     fmt(bk.subtotal),
      pay_now_txt:   fmt(bk.pagar_ahora),
      pay_later_txt: fmt(bk.pendiente),
      summaryField:  document.getElementById('summaryGrid').innerText
    };

    try{
      const ref = await db.collection('reservas').add(doc);
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
      await emailjs.send(window.TPL_EMAILJS.serviceId, window.TPL_EMAILJS.templates.cliente, params);
      await emailjs.send(window.TPL_EMAILJS.serviceId, window.TPL_EMAILJS.templates.gestion, params);

      alert('Tu reserva se ha registrado y está en revisión.');
      try{ localStorage.setItem('lastReserva', JSON.stringify({id: ref.id, ...doc})); }catch(_){}
      setTimeout(()=> location.href='perfil.html', 500);
    }catch(err){
      console.error(err);
      alert('No se pudo completar la reserva. Revísalo e inténtalo de nuevo.');
    }
  });

  // ====== Init ======
  (function init(){
    // Fechas mínimas
    document.getElementById('startDate').min = todayStr();
    document.getElementById('endDate').min   = todayStr();

    // Preselección por ?service / ?svc o por memoria
    const q = getQueryService();
    const remembered = localStorage.getItem('lastService');
    const sel = document.getElementById('service');
    const val = q || remembered;
    if (val && sel.querySelector(`option[value="${val}"]`)) sel.value = val;

    // Estado inicial
    S.service = sel.value || '';
    syncSpeciesUI();
    ensureInlineControls();
    refresh();
  })();
})();
