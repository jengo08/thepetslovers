/* TPL · Único JS para Reservas (auth + UI + precios + Firestore + EmailJS)
   Requisitos en la página:
   - Firebase compat: app/auth/firestore inicializados.
   - EmailJS cargado y window.TPL_EMAILJS = {serviceId, publicKey, templates:{cliente,gestion}, adminEmail}
   - DOM con los IDs indicados en el mensaje.
*/
(function(){
  // ==== Comprobaciones básicas ====
  if (!(window.firebase && firebase.auth && firebase.firestore)) {
    console.warn('[TPL] Firebase no encontrado. Revisa que cargues app/auth/firestore compat + initializeApp.');
    return;
  }
  if (!(window.emailjs && window.TPL_EMAILJS && TPL_EMAILJS.serviceId && TPL_EMAILJS.publicKey)) {
    console.warn('[TPL] EmailJS o config TPL_EMAILJS no encontrados. Cargar https://cdn.jsdelivr.net/npm/emailjs-com@3/dist/email.min.js y setear window.TPL_EMAILJS.');
  }

  const auth = firebase.auth();
  const db   = firebase.firestore();

  // ==== Utilidades ====
  const $  = s => document.querySelector(s);
  const $$ = s => Array.from(document.querySelectorAll(s));
  const fmt = n => new Intl.NumberFormat('es-ES',{style:'currency', currency:'EUR'}).format(n||0);
  const todayStr = () => new Date().toISOString().slice(0,10);
  function daysInclusive(a,b){
    const d1 = new Date(a), d2 = new Date(b);
    if (isNaN(+d1)||isNaN(+d2)) return 0;
    return Math.round((d2-d1)/(1000*60*60*24)) + 1;
  }
  function getQueryService(){
    try{ const u = new URL(location.href); return u.searchParams.get('service') || u.searchParams.get('svc'); }
    catch{ return null; }
  }
  function show(el){ if(el) el.style.display='block'; }
  function hide(el){ if(el) el.style.display='none'; }

  // ==== Estado global (por si otros scripts lo necesitan) ====
  window.TPL_SESSION = { user:null, profile:null, pets:[] };

  // ==== Referencias DOM clave ====
  const form      = $('#tpl-form-reservas');
  const authWall  = $('#authWall');
  const petsList  = $('#petsList');
  const summaryGrid = $('#summaryGrid');
  const svcInline   = $('#svcInlineControls');

  function setDisabled(dis){
    form?.classList.toggle('disabled', !!dis);
    form?.querySelectorAll('input,select,textarea,button').forEach(el=>{
      if (el.id==='btnBack') return;
      el.disabled = !!dis;
    });
  }

  // ==== Precios (cliente) ====
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

  // ==== Coste auxiliar (oculto) ====
  // Si quieres exactitud al céntimo, rellena estos costes por día/visita.
  const AUX = {
    daycare:{ adult:null, puppy:null },
    visita_gato:{ base60:null, base90:null, med15:null },
    overnight:{ adult:null, puppy:null, secondDog:null },
    walk60:{ base:null, secondPet:null },
    exoticos:{ aves:null, reptiles:null, pequenos_mamiferos:null, otro:null },
    transporte:{ flat:null },
    festivo_aux:{ normal:8, senalado:15 }
  };
  const MARGIN_FALLBACK = 0.20; // 20% del subtotal si no defines AUX

  // ==== Estado del formulario ====
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

  // ==== Autorrelleno de perfil y mascotas ====
  function fillProfile(p){
    const set = (id,val)=>{ const el = document.getElementById(id); if(el) el.value = val || ''; };
    set('fullName',   p?.fullName);
    set('email',      p?.email);
    set('phone',      p?.phone);
    set('address',    p?.address);
    set('postalCode', p?.postalCode);
    set('region',     p?.region);
  }

  function renderPets(pets){
    petsList.innerHTML = '';
    if (!pets || !pets.length){
      petsList.innerHTML = `<p class="tpl-help">No tienes mascotas guardadas todavía.</p>`;
      return;
    }
    const sixMs = 1000*60*60*24*30.4375*6;
    pets.forEach(p=>{
      const isPuppy = p?.birth ? (Date.now()-new Date(p.birth).getTime()) <= sixMs : false;
      const row = document.createElement('div');
      row.className = 'pet-item';
      row.innerHTML = `
        <label style="display:flex;align-items:center;gap:.6rem;">
          <input type="checkbox" name="pets" value="${p.id||p.name}" data-species="${p.species||''}" data-ispuppy="${isPuppy?'1':'0'}">
          <span><strong>${p.name}</strong> · <span class="tpl-help">${p.species||'—'}</span></span>
        </label>
        ${isPuppy ? '<span class="badge">Cachorro ≤6m</span>' : ''}`;
      petsList.appendChild(row);
    });
  }

  auth.onAuthStateChanged(async(user)=>{
    window.TPL_SESSION.user = user || null;
    if (!user){ show(authWall); setDisabled(true); return; }
    hide(authWall); setDisabled(false);

    try{
      const snap = await db.collection('propietarios').doc(user.uid).get();
      const profile = snap.exists ? snap.data() : null;
      window.TPL_SESSION.profile = profile;
      window.TPL_SESSION.pets    = profile?.pets || [];
      fillProfile(profile||{});
      renderPets(window.TPL_SESSION.pets);
      // notificar para recalcular desglose
      document.dispatchEvent(new CustomEvent('tpl:pets-ready'));
    }catch(err){
      console.error('[TPL] Error perfil', err);
    }
  });

  // Botones del muro (enlaza con tu modal si lo tienes)
  $('#btnLogin')?.addEventListener('click', ()=> alert('Abre tu modal/página de inicio de sesión.'));
  $('#btnRegister')?.addEventListener('click', ()=> alert('Abre tu modal/página de registro.'));
  $('#btnBack')?.addEventListener('click', ()=>{ if (document.referrer) history.back(); else location.href='servicios.html'; });

  // ==== UI condicional (especie/subtipo + controles por servicio) ====
  function syncSpeciesUI(){
    const speciesField = $('#speciesField');
    const exoField     = $('#exoSubtypeField');
    const speciesInp   = $('#species');
    if (!speciesField || !exoField || !speciesInp) return;

    speciesField.hidden = true; exoField.hidden = true; speciesInp.value = '';
    if (S.service==='visita_gato'){ speciesField.hidden=false; speciesInp.value='Gato'; }
    if (S.service==='exoticos'){ speciesField.hidden=false; speciesInp.value='Exótico'; exoField.hidden=false; }
  }

  function ensureInlineControls(){
    if (!svcInline) return;
    if (svcInline.dataset.ready){
      svcInline.querySelectorAll('[data-for]').forEach(g=>{
        const t=g.getAttribute('data-for');
        g.hidden = !((t===S.service) || (t==='supps'));
      });
      return;
    }
    svcInline.dataset.ready='1';
    svcInline.innerHTML = `
      <div data-for="daycare" class="tpl-grid">
        <div class="tpl-field">
          <label>¿Bono guardería?</label>
          <select id="daycareBono">
            <option value="">Sin bono</option>
            <option value="10">Bono 10</option>
            <option value="20">Bono 20</option>
            <option value="30">Bono 30</option>
          </select>
        </div>
      </div>

      <div data-for="walk60" class="tpl-grid" hidden>
        <div class="tpl-field">
          <label>Nº de paseos</label>
          <input id="walkNum" type="number" min="1" value="1">
        </div>
        <div class="tpl-field">
          <label><input id="walkSecond" type="checkbox"> 2ª mascota</label>
        </div>
      </div>

      <div data-for="visita_gato" class="tpl-grid" hidden>
        <div class="tpl-field">
          <label>Duración</label>
          <select id="vgDur"><option value="60">60 min</option><option value="90">90 min</option></select>
        </div>
        <div class="tpl-field">
          <label>Visitas por día</label>
          <input id="vgVpd" type="number" min="1" value="1">
        </div>
        <div class="tpl-field">
          <label>Nº total de gatos</label>
          <input id="vgCats" type="number" min="1" value="1">
        </div>
        <div class="tpl-field">
          <label><input id="vgMed" type="checkbox"> ¿Medicaciones 15’?</label>
        </div>
      </div>

      <div data-for="supps" class="tpl-grid">
        <div class="tpl-field"><label><input id="supUrg" type="checkbox"> Urgencia</label></div>
        <div class="tpl-field"><label><input id="supFest" type="checkbox"> Festivo</label></div>
        <div class="tpl-field"><label><input id="supSen" type="checkbox"> Días señalados</label></div>
      </div>
    `;
    const bind = (id,key,type='value')=>{
      const el=document.getElementById(id); if(!el) return;
      const save = ()=> localStorage.setItem(key, (type==='checked')?(el.checked?'1':'0'):el.value);
      el.addEventListener('input', ()=>{ save(); refresh(); });
      el.addEventListener('change', ()=>{ save(); refresh(); });
    };
    bind('daycareBono','daycareBono');
    bind('walkNum','walkNum'); bind('walkSecond','walkSecond','checked');
    bind('vgDur','vgDur'); bind('vgVpd','vgVpd'); bind('vgCats','vgCats'); bind('vgMed','vgMed','checked');
    bind('supUrg','supUrg','checked'); bind('supFest','supFest','checked'); bind('supSen','supSen','checked');

    ensureInlineControls();
  }

  // ==== Captura estado desde el DOM ====
  function collect(){
    S.service   = $('#service')?.value || '';
    S.startDate = $('#startDate')?.value || '';
    S.endDate   = $('#endDate')?.value || '';
    S.startTime = $('#startTime')?.value || '';
    S.endTime   = $('#endTime')?.value || '';
    S.pets = $$('#petsList input[type="checkbox"]:checked').map(chk=>({
      id: chk.value,
      name: chk.closest('.pet-item')?.querySelector('strong')?.textContent || chk.value,
      species: chk.dataset.species || '',
      isPuppy: chk.dataset.ispuppy==='1'
    }));
    if (S.service==='daycare') S.bono = parseInt(localStorage.getItem('daycareBono')||'')||null;
    if (S.service==='walk60'){
      S.numWalks  = parseInt(localStorage.getItem('walkNum')||'1');
      S.secondPet = (localStorage.getItem('walkSecond')==='1');
    }
    if (S.service==='visita_gato'){
      S.duration = localStorage.getItem('vgDur')||'60';
      S.visitsPerDay = parseInt(localStorage.getItem('vgVpd')||'1');
      S.catsCount = parseInt(localStorage.getItem('vgCats')||'1');
      S.med15 = (localStorage.getItem('vgMed')==='1');
    }
    if (S.service==='exoticos') S.exoSubtype = $('#exoticosSubtype')?.value || 'otro';
    S.urgencia = (localStorage.getItem('supUrg')==='1');
    S.festivo  = (localStorage.getItem('supFest')==='1');
    S.senalado = (localStorage.getItem('supSen')==='1');
  }

  // ==== Cálculo del desglose ====
  function compute(){
    const items=[]; let subtotal=0; let festivoAux=0;
    const add=(label,amount)=>{ if(!amount) return; items.push([label,amount]); subtotal+=amount; };

    const d = daysInclusive(S.startDate,S.endDate);
    const isLong = d>=11;

    if (S.service==='daycare'){
      const anyPuppy = S.pets.some(p=>p.isPuppy);
      const rate = anyPuppy ? P.daycare.puppy : P.daycare.adult;
      if (S.bono && [10,20,30].includes(S.bono) && d===S.bono){
        const bono = anyPuppy ? P.daycare.bonosPuppy[S.bono] : P.daycare.bonosAdulto[S.bono];
        add(`Bono ${S.bono} días`, bono);
      } else {
        add(`Base (${d} día/s × ${Math.max(1,S.pets.length)} mascota/s)`, d*rate*Math.max(1,S.pets.length));
      }
    }

    if (S.service==='overnight'){
      const anyPuppy = S.pets.some(p=>p.isPuppy);
      const table = anyPuppy ? P.overnight.puppy : P.overnight.adult;
      const rate  = isLong ? table.d11p : table.d1_10;
      const dogs = S.pets.filter(p=>(p.species||'').toLowerCase()==='perro');
      const first=Math.min(1,dogs.length), second=Math.max(0,dogs.length-1);
      add(`Base 1º perro (${d}d)`, d*rate*first);
      if (second){
        const r2 = isLong ? P.overnight.secondDog.d11p : P.overnight.secondDog.d1_10;
        add(`2º perro (${d}d)`, d*r2*second);
      }
    }

    if (S.service==='walk60'){
      if (S.bono && P.walk60.bonos[S.bono]) add(`Bono paseos ×${S.bono}`, P.walk60.bonos[S.bono]);
      else {
        add(`Paseos (${S.numWalks}×)`, S.numWalks*P.walk60.price);
        if (S.secondPet) add(`2ª mascota (${S.numWalks}×)`, S.numWalks*P.walk60.secondPet);
      }
    }

    if (S.service==='visita_gato'){
      const visits = d*(S.visitsPerDay||1);
      const baseT = (S.duration==='90'?P.visita_gato.base90:P.visita_gato.base60);
      const rate  = isLong ? baseT.d11p : baseT.d1_10;
      add(`Visitas (${visits}×)`, visits*rate);
      if (S.med15){
        const mRate = isLong ? P.visita_gato.med15.d11p : P.visita_gato.med15.d1_10;
        add(`Medicaciones 15’ (${visits}×)`, visits*mRate);
      }
      const extra = Math.max(0, S.catsCount-1);
      if (extra>0){
        let supp=0;
        if (extra===1) supp = P.visita_gato.extraCats.oneMore * visits;
        else if (extra===2) supp = (2*P.visita_gato.extraCats.twoEach)*visits;
        else supp = (extra*P.visita_gato.extraCats.threePlusEach)*visits;
        add(`Supl. gatos adicionales (${visits}×)`, supp);
      }
    }

    if (S.service==='exoticos')  add(`Exóticos · ${S.exoSubtype}`, P.exoticos[S.exoSubtype]||P.exoticos.otro);
    if (S.service==='transporte') add('Transporte', P.transporte.flat);

    if (S.urgencia) add('Urgencia (mismo día <2h)', P.supplements.urgencia);
    if (S.festivo)  { add('Festivo', P.supplements.festivo);  festivoAux += (AUX.festivo_aux?.normal||0); }
    if (S.senalado) { add('Días señalados (24/12,25/12,31/12,01/01)', P.supplements.senalado); festivoAux += (AUX.festivo_aux?.senalado||0); }

    // Margen / pagar ahora
    let auxCost = 0;
    if (!auxCost) auxCost = Math.max(0, subtotal * (1 - MARGIN_FALLBACK)); // fallback si no defines AUX
    const pagar_ahora = Math.max(0, subtotal - (auxCost + festivoAux));
    const pendiente   = Math.max(0, subtotal - pagar_ahora);

    return { items, subtotal, pagar_ahora, pendiente };
  }

  function renderBreakdown(bk){
    if (!summaryGrid) return;
    summaryGrid.innerHTML='';
    bk.items.forEach(([label,amount])=>{
      summaryGrid.insertAdjacentHTML('beforeend', `<div class="summary-label">${label}</div><div class="summary-value">${fmt(amount)}</div>`);
    });
    summaryGrid.insertAdjacentHTML('beforeend', `<div style="grid-column:1/-1;border-top:1px solid #eee;margin:6px 0;"></div>`);
    summaryGrid.insertAdjacentHTML('beforeend', `<div class="summary-label"><strong>Subtotal</strong></div><div class="summary-value"><strong>${fmt(bk.subtotal)}</strong></div>`);
    summaryGrid.insertAdjacentHTML('beforeend', `<div class="summary-label"><strong>A pagar ahora</strong></div><div class="summary-value"><strong>${fmt(bk.pagar_ahora)}</strong></div>`);
    summaryGrid.insertAdjacentHTML('beforeend', `<div class="summary-label"><strong>Pendiente (12 días antes)</strong></div><div class="summary-value"><strong>${fmt(bk.pendiente)}</strong></div>`);
  }

  function collectAndRender(){ collect(); syncSpeciesUI(); ensureInlineControls(); renderBreakdown(compute()); }
  function refresh(){ collectAndRender(); }

  // ==== Eventos ====
  $('#service')?.addEventListener('change', ()=>{ localStorage.setItem('lastService', $('#service').value||''); refresh(); });
  ['startDate','endDate','startTime','endTime'].forEach(id=> $('#'+id)?.addEventListener('change', refresh));
  document.addEventListener('tpl:pets-ready', refresh);
  $('#petsList')?.addEventListener('change', refresh);

  // ==== Submit → Firestore + EmailJS ====
  form?.addEventListener('submit', async (e)=>{
    e.preventDefault();
    const user = firebase.auth().currentUser;
    if (!user){ alert('Inicia sesión para reservar.'); return; }

    // Validación fechas
    const sD = new Date($('#startDate').value); const eD = new Date($('#endDate').value);
    if (isNaN(+sD) || isNaN(+eD) || eD < sD){ alert('Revisa las fechas.'); return; }

    const bk = compute();
    const get = id => document.getElementById(id)?.value || '';

    const doc = {
      _estado: 'paid_review',
      _uid: user.uid,
      _email: user.email || get('email'),
      _createdAt: firebase.firestore.FieldValue.serverTimestamp(),

      service: S.service,
      startDate: S.startDate, endDate: S.endDate,
      Hora_inicio: S.startTime, Hora_fin: S.endTime,
      species: (S.service==='visita_gato' ? 'Gato' : (S.service==='exoticos' ? (S.exoSubtype||'Exótico') : '')),
      pets: S.pets, catsCount: S.catsCount || null,

      titular: {
        firstName: get('fullName'), email: get('email'), phone: get('phone'),
        region: get('region'), address: get('address'), postalCode: get('postalCode'),
        observations: get('observations')
      },

      total_cliente: bk.subtotal,
      pagar_ahora:   bk.pagar_ahora,
      pendiente:     bk.pendiente,
      total_txt:     fmt(bk.subtotal),
      pay_now_txt:   fmt(bk.pagar_ahora),
      pay_later_txt: fmt(bk.pendiente),
      summaryField:  $('#summaryGrid')?.innerText || ''
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
      try{ localStorage.setItem('lastReserva', JSON.stringify({ id: ref.id, ...doc })); }catch(_){}
      const redirect = form.getAttribute('data-redirect') || 'perfil.html';
      setTimeout(()=> location.href = redirect, 600);
    }catch(err){
      console.error(err);
      alert('No se pudo completar la reserva. Inténtalo de nuevo.');
    }
  });

  // ==== Init ====
  (function init(){
    // Fechas mínimas
    $('#startDate') && ($('#startDate').min = todayStr());
    $('#endDate') && ($('#endDate').min = todayStr());

    // Preselección por query o memoria
    const q = getQueryService();
    const remembered = localStorage.getItem('lastService');
    const sel = $('#service');
    const val = q || remembered;
    if (sel && val && sel.querySelector(`option[value="${val}"]`)) sel.value = val;

    S.service = $('#service')?.value || '';
    collectAndRender();
  })();
})();
