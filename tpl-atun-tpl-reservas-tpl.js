/* TPL · Reservas — mismo diseño, con fechas inicio/fin, visitas (60/90 y 1–2/día),
   mascotas desde Firestore, autorrelleno completo, contacto de emergencia,
   cálculo por rango, urgencia auto, margen exacto y EmailJS real.
*/
(function(){
  /*** Utils ***/
  const $  = (s,root=document)=>root.querySelector(s);
  const $$ = (s,root=document)=>Array.from(root.querySelectorAll(s));
  const fmt = n => (typeof n!=="number"||isNaN(n))?"—":n.toFixed(2).replace(".",",")+" €";
  const parseDate = v=>{const d=new Date(v); return isNaN(d)?null:d;};
  const round2 = n => Math.round((n||0)*100)/100;

  function daysInclusive(a,b){
    const d1 = parseDate(a), d2 = parseDate(b);
    if(!d1||!d2) return 0;
    return Math.round((d2-d1)/(1000*60*60*24)) + 1;
  }
  function eachDate(fromStr,toStr,cb){
    const d1=parseDate(fromStr), d2=parseDate(toStr); if(!d1||!d2) return;
    const dt = new Date(d1);
    while(dt<=d2){ cb(new Date(dt)); dt.setDate(dt.getDate()+1); }
  }
  function todayISO(){ const d=new Date(); const m=String(d.getMonth()+1).padStart(2,"0"); const dd=String(d.getDate()).padStart(2,"0"); return `${d.getFullYear()}-${m}-${dd}`; }
  function monthDayKey(date){ const m=String(date.getMonth()+1).padStart(2,"0"); const d=String(date.getDate()).padStart(2,"0"); return `${m}-${d}`; }

  /*** Sup/fiestas ***/
  const BIG_DAYS = ["12-24","12-25","12-31","01-01"]; // por día
  const FESTIVO_NORMAL_PLUS = 10; const FESTIVO_NORMAL_AUX = 8;
  const BIG_DAY_PLUS = 30; const BIG_DAY_AUX = 15;
  const URGENCIA_PLUS = 10;

  /*** Precios cliente ***/
  const PUBLIC = {
    guarderia_dia: { adult:15, puppy:20, bonosAdult:{10:135,20:250,30:315}, bonosPuppy:{10:185,20:350,30:465} },
    alojamiento_nocturno: { std:{d1_10:30, d11p:27}, puppy:{d1_10:35, d11p:32}, second:{d1_10:25, d11p:22} },
    paseo: { base:12, secondPet:8 },
    visita_gato: { base60:{d1_10:22,d11p:18}, base90:{d1_10:30,d11p:27}, med15:{d1_10:12,d11p:10},
                   extraCats:{ oneMore:12, twoEach:8, threePlusEach:6 } },
    exoticos_aves:20, exoticos_reptiles:20, exoticos_mamiferos:25,
    transporte:20
  };

  /*** Auxiliar (exacto, según tus reglas) ***/
  const AUX = {
    guarderia_dia:{ adult:12, puppy:15, bonosAdult:{10:11,20:10,30:9}, bonosPuppy:{10:16,20:14,30:12} },
    alojamiento_nocturno:{ std:{d1_10:25,d11p:22}, puppy:{d1_10:30,d11p:27}, second:{d1_10:20,d11p:17} },
    paseo:{ base:10, secondPet:5 },
    visita_gato:{ base60:{d1_10:17,d11p:12}, base90:{d1_10:25,d11p:21}, med15_publicEqualsAux:true,
                  extraCats:{ oneMore:10, twoEach:6, threePlusEach:4 } },
    exoticos_aves:15, exoticos_reptiles:15, exoticos_mamiferos:20,
    transporte:15
  };

  /*** Firebase helpers ***/
  const hasFB = ()=>!!(window.firebase && firebase.auth && firebase.firestore);
  const fbUser = ()=>{ try{ return firebase.auth().currentUser||null; }catch(_){ return null; } };
  async function getProfile(){
    try{
      const u = fbUser(); if(!u) return null;
      const doc = await firebase.firestore().collection('propietarios').doc(u.uid).get();
      if(!doc.exists) return { fullName:u.displayName||"", email:u.email||"", pets:[] };
      const p = doc.data()||{};
      // normalizaciones tolerantes con nombres antiguos
      return {
        fullName: p.fullName || [p.name,p.surname].filter(Boolean).join(' ') || '',
        email: p.email || u.email || '',
        phone: p.phone || p.telefono || '',
        address: p.address || '',
        postalCode: p.postalCode || p.cp || '',
        region: p.region || '',
        emergencyName: p.emergencyName || p.contactoEmergencia || '',
        emergencyPhone: p.emergencyPhone || p.telEmergencia || '',
        pets: Array.isArray(p.pets)?p.pets:[]
      };
    }catch(e){ console.warn('[TPL] Perfil Firestore error', e); return null; }
  }

  /*** UI helpers ***/
  function setGate(on){
    const gate = $("#sessionGate"), form=$("#reservaForm");
    if(on){ gate.style.display="block"; form.classList.add("disabled"); }
    else{ gate.style.display="none"; form.classList.remove("disabled"); }
  }
  function bindServiceSpecific(){
    const sel = $("#serviceType");
    const block = $("#visitCatControls");
    const toggle = ()=>{ block.style.display = (sel.value==="visita_gato") ? "grid" : "none"; };
    sel.addEventListener("change", toggle);
    toggle();
  }

  function ageMonths(birth){
    const d = parseDate(birth); if(!d) return null;
    const now = new Date();
    return (now.getFullYear()-d.getFullYear())*12 + (now.getMonth()-d.getMonth()) - (now.getDate()<d.getDate()?1:0);
  }
  function isPuppy(p){ return (p?.species==="perro") && (ageMonths(p.birth)<=6); }

  function renderPets(pets){
    const grid = $("#petsGrid"); grid.innerHTML="";
    if(!pets || !pets.length){
      grid.innerHTML = `<p class="tpl-lead" style="font-size:.95rem;color:#666">No hemos encontrado mascotas en tu perfil.</p>`;
      return;
    }
    pets.forEach(p=>{
      const puppy = isPuppy(p);
      const el = document.createElement("label");
      el.className = "pet-card";
      el.innerHTML = `
        <input type="checkbox" class="pet-check" data-id="${p.id}">
        <img class="pet-img" src="${p.img||""}" alt="${p.name||'Mascota'}" onerror="this.style.display='none'">
        <div style="flex:1">
          <div><strong>${p.name||'Mascota'}</strong>
            ${p.species==='perro' ? '<i class="fa-solid fa-dog"></i>' : p.species==='gato' ? '<i class="fa-solid fa-cat"></i>' : '<i class="fa-solid fa-kiwi-bird"></i>'}
            ${puppy ? '<span class="badge">Cachorro (≤6m)</span>' : ''}
          </div>
          <div class="pet-meta">${p.species || '—'} ${p.subtype?('· '+p.subtype):''} · Nac: ${p.birth||'—'}</div>
        </div>`;
      grid.appendChild(el);
    });
  }
  function selectedPets(all){
    const ids = $$(".pet-check:checked").map(x=>x.getAttribute("data-id"));
    return (all||[]).filter(p=>ids.includes(p.id));
  }
  function fillOwner(p){
    if(!p) return;
    if(p.fullName) $("#ownerFullName").value = p.fullName;
    if(p.email) $("#email").value = p.email;
    if(p.phone) $("#phone").value = p.phone;
    if(p.address) $("#address").value = p.address;
    if(p.postalCode) $("#postalCode").value = p.postalCode;
    if(p.region) $("#region").value = p.region;
    if(p.emergencyName) $("#emergencyName").value = p.emergencyName;
    if(p.emergencyPhone) $("#emergencyPhone").value = p.emergencyPhone;
  }

  /*** Cálculo precios — rango fechas ***/
  function calc(payload){
    const lines = [];
    const linesAux = [];
    let total = 0;
    let aux   = 0;

    const days = Math.max(0, daysInclusive(payload.startDate, payload.endDate));
    const pets = payload.pets||[];
    const numDogs = pets.filter(p=>p.species==='perro').length;
    const numCats = pets.filter(p=>p.species==='gato').length;
    const anyPuppy = pets.some(isPuppy);

    // Helper por día (para aloj/guard y suplementos)
    function priceTier(dIndex){ return (dIndex>=11) ? 'd11p' : 'd1_10'; }

    if(payload.serviceType==='guarderia_dia'){
      if([10,20,30].includes(days)){
        const bono = anyPuppy ? PUBLIC.guarderia_dia.bonosPuppy[days] : PUBLIC.guarderia_dia.bonosAdult[days];
        const bonoAuxDay = anyPuppy ? AUX.guarderia_dia.bonosPuppy[days] : AUX.guarderia_dia.bonosAdult[days];
        const ppx = (bono/days).toFixed(2);
        lines.push({label:`Base (Guardería · ${days} días)`, calc:`Bono ${days}d (${ppx} €/día)`, amount:bono});
        total += bono;

        const auxTotal = bonoAuxDay*days * Math.max(1, numDogs||pets.length||1);
        linesAux.push({label:`Aux (bono ${days}d)`, amount:auxTotal}); aux += auxTotal;
      }else{
        const dayPrice = anyPuppy ? PUBLIC.guarderia_dia.puppy : PUBLIC.guarderia_dia.adult;
        const dayAux   = anyPuppy ? AUX.guarderia_dia.puppy : AUX.guarderia_dia.adult;
        if(days>0){
          const pub = dayPrice*days * Math.max(1, pets.length||1);
          const a   = dayAux*days   * Math.max(1, pets.length||1);
          lines.push({label:`Base (Guardería · ${days} días · ${pets.length||1} mascota/s)`, amount:pub}); total+=pub;
          linesAux.push({label:`Aux guardería`, amount:a}); aux+=a;
        }
      }
    }

    if(payload.serviceType==='alojamiento_nocturno'){
      if(days>0){
        const dogs = Math.max(1, numDogs||pets.length||1);
        for(let i=1;i<=dogs;i++){
          let pub=0, a=0;
          const second = (i>=2);
          const puppy = anyPuppy && i===1; // si algún perro cachorro, aplica al primero
          for(let d=1; d<=days; d++){
            const t = priceTier(d);
            if(second){
              pub += PUBLIC.alojamiento_nocturno.second[t];
              a   += AUX.alojamiento_nocturno.second[t];
            }else if(puppy){
              pub += PUBLIC.alojamiento_nocturno.puppy[t];
              a   += AUX.alojamiento_nocturno.puppy[t];
            }else{
              pub += PUBLIC.alojamiento_nocturno.std[t];
              a   += AUX.alojamiento_nocturno.std[t];
            }
          }
          lines.push({label:`Base (Alojamiento · ${days} días · mascota ${i})`, amount:pub}); total+=pub;
          linesAux.push({label:`Aux (Alojamiento · mascota ${i})`, amount:a}); aux+=a;
        }
      }
    }

    if(payload.serviceType==='paseo'){
      const walks = 1; // si añades control de nº paseos, cámbialo
      const pub = PUBLIC.paseo.base*walks;
      const a   = AUX.paseo.base*walks;
      lines.push({label:`Base (Paseo · ${walks})`, amount:pub}); total+=pub;
      linesAux.push({label:`Aux paseo`, amount:a}); aux+=a;

      const extra = Math.max(0, (pets.length||1) - 1);
      if(extra>0){
        const pex = PUBLIC.paseo.secondPet*extra*walks;
        const aex = AUX.paseo.secondPet*extra*walks;
        lines.push({label:`Mascotas adicionales (${extra})`, amount:pex}); total+=pex;
        linesAux.push({label:`Aux extra mascotas`, amount:aex}); aux+=aex;
      }
    }

    if(payload.serviceType==='visita_gato'){
      const visitsPerDay = payload.vgPerDay||1;
      const duration = payload.vgDuration==='90' ? 'base90' : 'base60';
      const totalVisits = (days>0?days:1) * visitsPerDay;

      for(let d=1; d<=Math.max(1,days); d++){
        const t = priceTier(d);
        for(let v=1; v<=visitsPerDay; v++){
          const pub = (PUBLIC.visita_gato[duration][t]);
          const a   = (AUX.visita_gato[duration][t]);
          lines.push({label:`Base (Visita gato · ${duration==='base90'?'90':'60'}’ · día ${d} · visita ${v})`, amount:pub}); total+=pub;
          linesAux.push({label:`Aux visita gato · día ${d} · v${v}`, amount:a}); aux+=a;
        }
      }
      // gatos extra por visita
      const extraCats = Math.max(0, numCats-1);
      if(extraCats>0){
        let perClient, perAux;
        if(extraCats===1){ perClient=PUBLIC.visita_gato.extraCats.oneMore; perAux=AUX.visita_gato.extraCats.oneMore; }
        else if(extraCats===2){ perClient=PUBLIC.visita_gato.extraCats.twoEach; perAux=AUX.visita_gato.extraCats.twoEach; }
        else { perClient=PUBLIC.visita_gato.extraCats.threePlusEach; perAux=AUX.visita_gato.extraCats.threePlusEach; }
        const addC = perClient * extraCats * (days>0?days:1) * visitsPerDay;
        const addA = perAux * extraCats * (days>0?days:1) * visitsPerDay;
        lines.push({label:`Gatos extra (${extraCats})`, amount:addC}); total+=addC;
        linesAux.push({label:`Aux gatos extra`, amount:addA}); aux+=addA;
      }
    }

    if(payload.serviceType==='exoticos_aves' || payload.serviceType==='exoticos_reptiles' || payload.serviceType==='exoticos_mamiferos'){
      const pub = PUBLIC[payload.serviceType];
      const a   = AUX[payload.serviceType];
      lines.push({label:`Base (${labelService(payload.serviceType)})`, amount:pub}); total+=pub;
      linesAux.push({label:`Aux ${labelService(payload.serviceType)}`, amount:a}); aux+=a;
    }

    if(payload.serviceType==='transporte'){
      lines.push({label:`Transporte`, amount:PUBLIC.transporte}); total+=PUBLIC.transporte;
      linesAux.push({label:`Aux transporte`, amount:AUX.transporte}); aux+=AUX.transporte;
    }

    // Suplementos por día del rango
    if(days>0){
      eachDate(payload.startDate, payload.endDate, (d)=>{
        const key = monthDayKey(d);
        if(BIG_DAYS.includes(key)){ lines.push({label:`Día señalado (${key})`, amount:BIG_DAY_PLUS}); total+=BIG_DAY_PLUS; linesAux.push({label:`Aux día señalado`, amount:BIG_DAY_AUX}); aux+=BIG_DAY_AUX; }
        // Si marcas festivo por CA más adelante, aquí: else if (payload.festive) ...
      });
    }

    // Urgencia: si hoy y <2h para la hora de inicio (solo 1 vez)
    if(payload.startDate===todayISO() && payload.startTime){
      const now = new Date();
      const [hh,mm] = payload.startTime.split(':').map(Number);
      const st = new Date(); st.setHours(hh||0,mm||0,0,0);
      const diffM = Math.round((st-now)/60000);
      if(diffM>0 && diffM<120){ lines.push({label:`Suplemento urgencia (<2h)`, amount:URGENCIA_PLUS}); total+=URGENCIA_PLUS; }
    }

    if(payload.travelNeeded==='si'){
      lines.push({label:`Desplazamiento`, note:'pendiente'}); // no suma ahora
    }

    const payNow = Math.max(0, total - aux);
    const payLater = Math.max(0, total - payNow);
    return { linesPublic:lines, totalPublic: round2(total), totalAux: round2(aux), payNow: round2(payNow), payLater: round2(payLater) };
  }

  function labelService(s){
    return ({
      guarderia_dia:"Guardería de día",
      alojamiento_nocturno:"Alojamiento nocturno",
      paseo:"Paseo (60’)",
      visita_gato:"Visita a domicilio (gato)",
      exoticos_aves:"Exóticos (aves)",
      exoticos_reptiles:"Exóticos (reptiles)",
      exoticos_mamiferos:"Exóticos (mamíferos pequeños)",
      transporte:"Transporte"
    })[s]||s;
  }

  function renderSummary(calc, payload){
    const ctx = `${labelService(payload.serviceType)||"—"} · ${payload.startDate||"—"} → ${payload.endDate||"—"}${payload.startTime?(" · "+payload.startTime):""}${payload.endTime?("–"+payload.endTime):""} · ${(payload.pets||[]).length||0} mascota(s)`;
    $("#summaryContext").textContent = ctx;

    const box = $("#summaryLines"); box.innerHTML="";
    calc.linesPublic.forEach(l=>{
      const row = document.createElement("div");
      row.className = "line";
      const right = (l.note==="pendiente") ? '<span class="muted">pendiente</span>' : fmt(l.amount);
      row.innerHTML = `<span>${l.label}${l.calc?` <span class="muted">· ${l.calc}</span>`:""}</span><span>${right}</span>`;
      box.appendChild(row);
    });
    $("#subtotalTxt").textContent = fmt(calc.totalPublic);
    $("#payNowTxt").textContent = fmt(calc.payNow);
    $("#payLaterTxt").textContent = fmt(calc.payLater);
  }

  /*** Recolección ***/
  function collect(profile){
    const petsSel = selectedPets(profile?.pets||[]);
    return {
      serviceType: $("#serviceType").value,
      startDate: $("#startDate").value,
      endDate: $("#endDate").value,
      startTime: $("#startTime").value,
      endTime: $("#endTime").value,
      region: $("#region").value,
      address: $("#address").value,
      postalCode: $("#postalCode").value,
      travelNeeded: $("#travelNeeded").value,
      notes: $("#notes").value,
      vgDuration: $("#vgDuration").value,
      vgPerDay: parseInt($("#vgPerDay").value||"1",10),
      pets: petsSel
    };
  }

  /*** Emails + guardado mock ***/
  function saveReservationMock(r){
    const key="tpl.reservas";
    let arr=[]; try{ arr=JSON.parse(localStorage.getItem(key)||"[]"); }catch(_){}
    arr.unshift(r); localStorage.setItem(key, JSON.stringify(arr));
  }
  async function sendEmails(reservation){
    const EJ = window.EMAILJS||{};
    if(!EJ.enabled) { console.log("[EMAILJS OFF] Reserva:", reservation); return; }
    const varsCliente = {
      to_name: reservation.owner.fullName,
      total: fmt(reservation.pricing.totalClient),
      pay_now: fmt(reservation.pricing.payNow),
      pay_later: fmt(reservation.pricing.payLater),
      servicio: labelService(reservation.service.type),
      fecha: `${reservation.dates.startDate} → ${reservation.dates.endDate}` + (reservation.dates.startTime?` ${reservation.dates.startTime}`:""),
      mascotas: (reservation.pets||[]).map(p=>p.name).join(", ")||"—",
      admin_email: EJ.admin_email || "gestion@thepetslovers.es"
    };
    const varsGestion = {
      cliente: `${reservation.owner.fullName} · ${reservation.owner.email} · ${reservation.owner.phone}`,
      servicio: labelService(reservation.service.type),
      total: fmt(reservation.pricing.totalClient),
      pay_now: fmt(reservation.pricing.payNow),
      pay_later: fmt(reservation.pricing.payLater),
      json: JSON.stringify(reservation,null,2),
      admin_email: EJ.admin_email || "gestion@thepetslovers.es"
    };
    await emailjs.send(EJ.service_id, EJ.template_cliente, varsCliente);
    await emailjs.send(EJ.service_id, EJ.template_gestion, varsGestion);
  }
  function buildReservation(profile, calc, payload){
    return {
      id: "resv_"+Date.now(),
      status: "paid_review",
      createdAt: new Date().toISOString(),
      service: { type: payload.serviceType },
      dates: {
        startDate: payload.startDate, endDate: payload.endDate,
        startTime: payload.startTime||null, endTime: payload.endTime||null,
        vgDuration: payload.vgDuration, vgPerDay: payload.vgPerDay
      },
      region: payload.region,
      owner: {
        fullName: $("#ownerFullName").value.trim(),
        email: $("#email").value.trim(),
        phone: $("#phone").value.trim(),
        address: $("#address").value.trim(),
        postalCode: $("#postalCode").value.trim(),
        contactPref: $("#contactPref").value,
        contactTime: $("#contactTime").value,
        emergencyName: $("#emergencyName").value.trim(),
        emergencyPhone: $("#emergencyPhone").value.trim()
      },
      pets: payload.pets,
      flags: {
        urgency: calc.linesPublic.some(l=>/urgencia/i.test(l.label)),
        travelNeeded: payload.travelNeeded==='si'
      },
      pricing: {
        breakdownPublic: calc.linesPublic,
        totalClient: calc.totalPublic,
        payNow: calc.payNow,
        payLater: calc.payLater,
        currency: "EUR"
      },
      internal: {
        totalAux: calc.totalAux,
        margin: round2(calc.totalPublic - calc.totalAux)
      }
    };
  }

  /*** INIT ***/
  function bindRecalc(profile){
    ["serviceType","startDate","endDate","startTime","endTime","region","address","postalCode","travelNeeded","vgDuration","vgPerDay"]
      .forEach(id=>{ $("#"+id)?.addEventListener("input", ()=>{ const p=collect(profile); renderSummary(calc(p), p); }); });
    $("#petsGrid").addEventListener("change", ()=>{ const p=collect(profile); renderSummary(calc(p), p); });
  }

  function applyPortParams(){
    const q = new URLSearchParams(location.search);
    const service = q.get("service"); if(service) $("#serviceType").value = service;
    const sd = q.get("date") || q.get("startDate"); if(sd) $("#startDate").value = sd;
    const ed = q.get("endDate"); if(ed) $("#endDate").value = ed; else if(sd) $("#endDate").value = sd;
    const st = q.get("start"); if(st) $("#startTime").value = st;
    const en = q.get("end"); if(en) $("#endTime").value = en;
    const region = q.get("region"); if(region) $("#region").value = region;
    const notes = q.get("notes"); if(notes) $("#notes").value = notes;
  }

  async function start(){
    bindServiceSpecific();
    applyPortParams();

    if(!hasFB()){
      setGate(true); // modo demo sin completar
      renderPets([]); // sin datos
      return;
    }

    firebase.auth().onAuthStateChanged(async(u)=>{
      if(!u){ setGate(true); renderPets([]); return; }
      setGate(false);

      const profile = await getProfile() || {pets:[]};
      fillOwner(profile);
      renderPets(profile.pets||[]);

      bindRecalc(profile);
      const payload = collect(profile);
      renderSummary(calc(payload), payload);

      $("#btnReserve")?.addEventListener("click", async ()=>{
        const p = collect(profile);
        if(!p.serviceType) return alert("Selecciona un servicio.");
        if(!p.startDate || !p.endDate) return alert("Introduce fecha de inicio y fin.");
        if(parseDate(p.endDate) < parseDate(p.startDate)) return alert("La fecha fin debe ser igual o posterior a inicio.");
        if(p.startTime && p.endTime){
          const [h1,m1]=p.startTime.split(":").map(Number);
          const [h2,m2]=p.endTime.split(":").map(Number);
          if(h2*60+m2 <= h1*60+m1) return alert("Hora fin debe ser posterior a inicio.");
        }
        if((p.pets||[]).length===0) return alert("Elige al menos una mascota.");

        const c = calc(p);
        const res = buildReservation(profile, c, p);
        try{ await sendEmails(res); }catch(e){ console.warn("EmailJS error", e); }
        saveReservationMock(res);
        $("#reservaForm").style.display="none"; $("#thanks").style.display="block";
      });
    });
  }

  window.addEventListener("load", start);
})();
