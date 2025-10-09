/* TPL · Reservas (v2)
   - Autorrelleno desde propietarios/{uid} (mapea nombres alternativos)
   - Servicio preseleccionado: ?service= o ?svc= o localStorage['tpl.lastService']
   - Fechas inicio/fin + horas
   - Visita gato: si vgPerDay=2 -> segunda visita = medicación 15' (12€ / 10€ desde día 11)
   - Guardería: bonos auto 10/20/30
   - Alojamiento: descuento desde día 11 aplicado día a día
   - Selector Número de mascotas (#petsCount) limita la selección de tarjetas
   - EmailJS: un único template para cliente y gestión (ya configurado en HTML)
*/
(function(){
  /* ==== Helpers ==== */
  const $  = (s,root=document)=>root.querySelector(s);
  const $$ = (s,root=document)=>Array.from(root.querySelectorAll(s));
  const fmt = n => (typeof n!=="number"||isNaN(n))?"—":n.toFixed(2).replace(".",",")+" €";
  const parseDate = v=>{const d=new Date(v); return isNaN(d)?null:d;};
  const round2 = n => Math.round((n||0)*100)/100;

  function daysInclusive(a,b){ const d1=parseDate(a), d2=parseDate(b); if(!d1||!d2) return 0; return Math.round((d2-d1)/86400000)+1; }
  function eachDate(fromStr,toStr,cb){ const d1=parseDate(fromStr), d2=parseDate(toStr); if(!d1||!d2) return; const t=new Date(d1); while(t<=d2){ cb(new Date(t)); t.setDate(t.getDate()+1); } }
  function todayISO(){ const d=new Date(); const m=String(d.getMonth()+1).padStart(2,"0"); const dd=String(d.getDate()).padStart(2,"0"); return `${d.getFullYear()}-${m}-${dd}`; }
  function monthDayKey(date){ const m=String(date.getMonth()+1).padStart(2,"0"); const d=String(date.getDate()).padStart(2,"0"); return `${m}-${d}`; }

  const BIG_DAYS = ["12-24","12-25","12-31","01-01"];
  const FESTIVO_NORMAL_PLUS = 10, FESTIVO_NORMAL_AUX = 8;
  const BIG_DAY_PLUS = 30, BIG_DAY_AUX = 15;
  const URGENCIA_PLUS = 10;

  /* ==== Precios (cliente/aux) ==== */
  const PUBLIC = {
    guarderia_dia: { adult:15, puppy:20, bonosAdult:{10:135,20:250,30:315}, bonosPuppy:{10:185,20:350,30:465} },
    alojamiento_nocturno: { std:{d1_10:30, d11p:27}, puppy:{d1_10:35, d11p:32}, second:{d1_10:25, d11p:22} },
    paseo: { base:12, secondPet:8 },
    visita_gato: {
      base60:{d1_10:22,d11p:18}, base90:{d1_10:30,d11p:27},
      med15:{d1_10:12,d11p:10}, // <-- segunda visita
      extraCats:{ oneMore:12, twoEach:8, threePlusEach:6 }
    },
    exoticos_aves:20, exoticos_reptiles:20, exoticos_mamiferos:25,
    transporte:20
  };
  const AUX = {
    guarderia_dia:{ adult:12, puppy:15, bonosAdult:{10:11,20:10,30:9}, bonosPuppy:{10:16,20:14,30:12} },
    alojamiento_nocturno:{ std:{d1_10:25,d11p:22}, puppy:{d1_10:30,d11p:27}, second:{d1_10:20,d11p:17} },
    paseo:{ base:10, secondPet:5 },
    visita_gato:{ base60:{d1_10:17,d11p:12}, base90:{d1_10:25,d11p:21}, med15:{d1_10:12,d11p:10},
                  extraCats:{ oneMore:10, twoEach:6, threePlusEach:4 } },
    exoticos_aves:15, exoticos_reptiles:15, exoticos_mamiferos:20,
    transporte:15
  };

  /* ==== Firebase / sesión ==== */
  const hasFB = ()=>!!(window.firebase && firebase.auth && firebase.firestore);

  async function ensureProfileDocument(uid, user){
    try{
      const db = firebase.firestore();
      const ref = db.collection('propietarios').doc(uid);
      const snap = await ref.get();
      if(!snap.exists){
        const base = {
          fullName: user.displayName || "",
          email: user.email || "",
          phone: "",
          address: "",
          postalCode: "",
          region: "",
          emergencyName: "",
          emergencyPhone: "",
          pets: []
        };
        await ref.set(base, {merge:true});
        return base;
      }
      const p = snap.data()||{};
      // Mapear nombres alternativos por si tu colección los usa
      const pets = Array.isArray(p.pets) ? p.pets
        : Array.isArray(p.mascotas) ? p.mascotas
        : [];
      // Normalizar cada mascota
      const petsNorm = pets.map((x,i)=>({
        id: x.id || x.uid || `pet_${i}`,
        name: x.name || x.nombre || "Mascota",
        species: (x.species || x.especie || x.tipo || x.animalType || "").toLowerCase().includes("perr") ? "perro"
               : (x.species || x.especie || x.tipo || x.animalType || "").toLowerCase().includes("gat") ? "gato"
               : "exotico",
        birth: x.birth || x.fechaNac || x.fnac || "",
        subtype: x.subtype || x.subtipo || "",
        img: x.img || x.foto || x.photo || ""
      }));
      return {
        fullName: p.fullName || [p.name,p.surname].filter(Boolean).join(' ') || "",
        email: p.email || user.email || "",
        phone: p.phone || p.telefono || "",
        address: p.address || p.direccion || "",
        postalCode: p.postalCode || p.cp || "",
        region: p.region || p.comunidad || "",
        emergencyName: p.emergencyName || p.contactoEmergencia || "",
        emergencyPhone: p.emergencyPhone || p.telEmergencia || "",
        pets: petsNorm
      };
    }catch(e){
      console.warn("[TPL] ensureProfileDocument error", e);
      return null;
    }
  }

  /* ==== Gate y controles específicos ==== */
  function setGate(on){
    const gate = $("#sessionGate"), form=$("#reservaForm");
    if(on){ gate.style.display="block"; form.classList.add("disabled"); }
    else{ gate.style.display="none"; form.classList.remove("disabled"); }
  }
  function bindServiceSpecific(){
    const sel = $("#serviceType");
    const visitBlock = $("#visitCatControls");
    const toggle = ()=>{ visitBlock.style.display = (sel.value==="visita_gato") ? "grid" : "none"; };
    sel.addEventListener("change", toggle); toggle();
  }

  /* ==== Mascotas UI ==== */
  function ageMonths(b){ const d=parseDate(b); if(!d) return null; const n=new Date(); return (n.getFullYear()-d.getFullYear())*12 + (n.getMonth()-d.getMonth()) - (n.getDate()<d.getDate()?1:0); }
  function isPuppy(p){ return (p?.species==='perro') && (ageMonths(p.birth)<=6); }

  function renderPets(pets){
    const grid = $("#petsGrid"); grid.innerHTML="";
    if(!pets || !pets.length){ grid.innerHTML = `<p class="tpl-lead" style="font-size:.92rem;color:#666">No hemos encontrado mascotas en tu perfil.</p>`; return; }
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

    // Límite de selección por #petsCount
    $("#petsGrid").addEventListener("change", ()=>{
      const max = parseInt($("#petsCount").value||"1",10);
      const checks = $$(".pet-check");
      const selected = checks.filter(c=>c.checked);
      if(selected.length>max){
        // Desmarca el último que marcaste
        const last = checks.findLast ? checks.findLast(c=>c.checked) : selected[selected.length-1];
        if(last){ last.checked = false; }
        alert(`Puedes seleccionar como máximo ${max} mascota(s).`);
      }
    });
  }
  function selectedPets(all){
    const ids = $$(".pet-check:checked").map(x=>x.getAttribute("data-id"));
    return (all||[]).filter(p=>ids.includes(p.id));
  }

  /* ==== Autorrelleno titular ==== */
  function fillOwner(p){
    if(!p) return;
    if(p.fullName)      $("#ownerFullName").value = p.fullName;
    if(p.email)         $("#email").value = p.email;
    if(p.phone)         $("#phone").value = p.phone;
    if(p.region)        $("#region").value = p.region;
    if(p.address)       $("#address").value = p.address;
    if(p.postalCode)    $("#postalCode").value = p.postalCode;
    if(p.emergencyName) $("#emergencyName").value = p.emergencyName;
    if(p.emergencyPhone)$("#emergencyPhone").value = p.emergencyPhone;
  }

  /* ==== Cálculo ==== */
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

  function calc(payload){
    const lines=[], linesAux=[]; let total=0, aux=0;
    const days = Math.max(0, daysInclusive(payload.startDate, payload.endDate));
    const pets = payload.pets||[];
    const numDogs = pets.filter(p=>p.species==='perro').length;
    const numCats = pets.filter(p=>p.species==='gato').length;
    const anyPuppy = pets.some(p=> (p?.species==='perro') && (ageMonths(p.birth)<=6) );
    const priceTier = (dIndex)=> dIndex>=11 ? 'd11p' : 'd1_10';

    // Guardería (bono exacto 10/20/30 por total de días, multiplicado por nº mascotas seleccionadas)
    if(payload.serviceType==='guarderia_dia'){
      if([10,20,30].includes(days)){
        const bonoPub = anyPuppy ? PUBLIC.guarderia_dia.bonosPuppy[days] : PUBLIC.guarderia_dia.bonosAdult[days];
        const bonoAuxPerDay = anyPuppy ? AUX.guarderia_dia.bonosPuppy[days] : AUX.guarderia_dia.bonosAdult[days];
        const m = Math.max(1, (pets.length||1));
        lines.push({label:`Base (Guardería · ${days} días · ${m} mascota/s)`, calc:`Bono ${days}d`, amount:bonoPub*m}); total+=bonoPub*m;
        linesAux.push({label:`Aux (bono ${days}d)`, amount:bonoAuxPerDay*days*m}); aux+=bonoAuxPerDay*days*m;
      }else if(days>0){
        const pd = anyPuppy ? PUBLIC.guarderia_dia.puppy : PUBLIC.guarderia_dia.adult;
        const ad = anyPuppy ? AUX.guarderia_dia.puppy   : AUX.guarderia_dia.adult;
        const m = Math.max(1, (pets.length||1));
        const pub = pd*days*m, a=ad*days*m;
        lines.push({label:`Base (Guardería · ${days} días · ${m} mascota/s)`, amount:pub}); total+=pub;
        linesAux.push({label:`Aux guardería`, amount:a}); aux+=a;
      }
    }

    // Alojamiento (día a día: desde día 11 cambia precio)
    if(payload.serviceType==='alojamiento_nocturno' && days>0){
      const dogs = Math.max(1, numDogs||pets.length||1);
      for(let i=1;i<=dogs;i++){
        let pub=0, a=0; const second=(i>=2), puppy=(anyPuppy && i===1);
        for(let d=1; d<=days; d++){
          const t=priceTier(d);
          if(second){ pub+=PUBLIC.alojamiento_nocturno.second[t]; a+=AUX.alojamiento_nocturno.second[t]; }
          else if(puppy){ pub+=PUBLIC.alojamiento_nocturno.puppy[t]; a+=AUX.alojamiento_nocturno.puppy[t]; }
          else { pub+=PUBLIC.alojamiento_nocturno.std[t]; a+=AUX.alojamiento_nocturno.std[t]; }
        }
        lines.push({label:`Base (Alojamiento · ${days} días · mascota ${i})`, amount:pub}); total+=pub;
        linesAux.push({label:`Aux (Alojamiento · mascota ${i})`, amount:a}); aux+=a;
      }
    }

    // Paseo
    if(payload.serviceType==='paseo'){
      const walks = 1;
      const pub = PUBLIC.paseo.base*walks, a=AUX.paseo.base*walks;
      lines.push({label:`Base (Paseo · ${walks})`, amount:pub}); total+=pub;
      linesAux.push({label:`Aux paseo`, amount:a}); aux+=a;
      const extra = Math.max(0, (pets.length||1)-1);
      if(extra>0){
        const ep = PUBLIC.paseo.secondPet*extra*walks, ea = AUX.paseo.secondPet*extra*walks;
        lines.push({label:`Mascotas adicionales (${extra})`, amount:ep}); total+=ep;
        linesAux.push({label:`Aux extra mascotas`, amount:ea}); aux+=ea;
      }
    }

    // Visita gato: 1ª visita = 60/90; 2ª visita = medicación 15'
    if(payload.serviceType==='visita_gato'){
      const perDay = payload.vgPerDay||1;
      const dur = payload.vgDuration==='90' ? 'base90' : 'base60';
      const D = Math.max(1,days||1);
      for(let d=1; d<=D; d++){
        const t=priceTier(d);
        // Primera visita (duración elegida)
        const p1=PUBLIC.visita_gato[dur][t], a1=AUX.visita_gato[dur][t];
        lines.push({label:`Base (Visita gato · ${dur==='base90'?'90':'60'}’ · día ${d})`, amount:p1}); total+=p1;
        linesAux.push({label:`Aux visita gato · día ${d}`, amount:a1}); aux+=a1;
        // Segunda visita (si aplica): medicación 15'
        if(perDay>=2){
          const p2=PUBLIC.visita_gato.med15[t], a2=AUX.visita_gato.med15[t];
          lines.push({label:`Segunda visita (15’) · día ${d}`, amount:p2}); total+=p2;
          linesAux.push({label:`Aux segunda visita (15’) · día ${d}`, amount:a2}); aux+=a2;
        }
      }
      // Gatos extra (sobre nº de gatos)
      const extraCats = Math.max(0, numCats-1);
      if(extraCats>0){
        let perC, perA;
        if(extraCats===1){ perC=PUBLIC.visita_gato.extraCats.oneMore; perA=AUX.visita_gato.extraCats.oneMore; }
        else if(extraCats===2){ perC=PUBLIC.visita_gato.extraCats.twoEach; perA=AUX.visita_gato.extraCats.twoEach; }
        else { perC=PUBLIC.visita_gato.extraCats.threePlusEach; perA=AUX.visita_gato.extraCats.threePlusEach; }
        const visitsTotal = D * (perDay>=2 ? 2 : 1);
        lines.push({label:`Gatos extra (${extraCats})`, amount: perC*extraCats*visitsTotal}); total += perC*extraCats*visitsTotal;
        linesAux.push({label:`Aux gatos extra`, amount: perA*extraCats*visitsTotal}); aux += perA*extraCats*visitsTotal;
      }
    }

    // Exóticos / transporte
    if(/exoticos_/.test(payload.serviceType)){
      const pub = PUBLIC[payload.serviceType], a=AUX[payload.serviceType];
      lines.push({label:`Base (${labelService(payload.serviceType)})`, amount:pub}); total+=pub;
      linesAux.push({label:`Aux ${labelService(payload.serviceType)}`, amount:a}); aux+=a;
    }
    if(payload.serviceType==='transporte'){
      lines.push({label:`Transporte`, amount:PUBLIC.transporte}); total+=PUBLIC.transporte;
      linesAux.push({label:`Aux transporte`, amount:AUX.transporte}); aux+=AUX.transporte;
    }

    // Suplementos del rango
    if(days>0){
      eachDate(payload.startDate, payload.endDate, (d)=>{
        const key = monthDayKey(d);
        if(BIG_DAYS.includes(key)){ lines.push({label:`Día señalado (${key})`, amount:BIG_DAY_PLUS}); total+=BIG_DAY_PLUS; linesAux.push({label:`Aux día señalado`, amount:BIG_DAY_AUX}); aux+=BIG_DAY_AUX; }
        // (Festivo normal por CA cuando lo conectemos) else if (payload.festive) { +10 / +8 }
      });
    }

    // Urgencia <2h en el día de inicio
    if(payload.startDate===todayISO() && payload.startTime){
      const now = new Date();
      const [h,m]=payload.startTime.split(':').map(Number);
      const st = new Date(); st.setHours(h||0,m||0,0,0);
      const diffM = Math.round((st-now)/60000);
      if(diffM>0 && diffM<120){ lines.push({label:`Suplemento urgencia (<2h)`, amount:URGENCIA_PLUS}); total+=URGENCIA_PLUS; }
    }

    if(payload.travelNeeded==='si'){ lines.push({label:`Desplazamiento`, note:'pendiente'}); }

    const payNow   = Math.max(0, total - aux);
    const payLater = Math.max(0, total - payNow);

    return { linesPublic:lines, totalPublic: round2(total), totalAux: round2(aux), payNow: round2(payNow), payLater: round2(payLater) };
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
    $("#payNowTxt").textContent   = fmt(calc.payNow);
    $("#payLaterTxt").textContent = fmt(calc.payLater);
  }

  /* ==== Recolección ==== */
  function selectedPets(all){
    const ids = $$(".pet-check:checked").map(x=>x.getAttribute("data-id"));
    return (all||[]).filter(p=>ids.includes(p.id));
  }
  function collect(profile){
    const max = parseInt($("#petsCount").value||"1",10);
    let sel = selectedPets(profile?.pets||[]);
    if(sel.length>max) sel = sel.slice(0,max); // seguridad
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
      vgDuration: $("#vgDuration")?.value || "60",
      vgPerDay: parseInt($("#vgPerDay")?.value||"1",10),
      pets: sel
    };
  }

  /* ==== EmailJS ==== */
  async function sendEmails(reservation){
    const EJ = window.EMAILJS||{}; if(!EJ.enabled) { console.log("[EMAILJS OFF]", reservation); return; }
    const varsCliente = {
      to_email: reservation.owner.email,
      to_name: reservation.owner.fullName,
      servicio: labelService(reservation.service.type),
      fecha: `${reservation.dates.startDate} → ${reservation.dates.endDate}` + (reservation.dates.startTime?` ${reservation.dates.startTime}`:""),
      mascotas: (reservation.pets||[]).map(p=>p.name).join(", ")||"—",
      total_txt: fmt(reservation.pricing.totalClient),
      pay_now_txt: fmt(reservation.pricing.payNow),
      pay_later_txt: fmt(reservation.pricing.payLater),
      summaryField: JSON.stringify(reservation.pricing.breakdownPublic)
    };
    const varsGestion = {
      to_email: EJ.admin_email || "gestion@thepetslovers.es",
      to_name: "Gestión TPL",
      servicio: labelService(reservation.service.type),
      fecha: `${reservation.dates.startDate} → ${reservation.dates.endDate}` + (reservation.dates.startTime?` ${reservation.dates.startTime}`:""),
      mascotas: (reservation.pets||[]).map(p=>p.name).join(", ")||"—",
      total_txt: fmt(reservation.pricing.totalClient),
      pay_now_txt: fmt(reservation.pricing.payNow),
      pay_later_txt: fmt(reservation.pricing.payLater),
      summaryField: JSON.stringify(reservation.pricing.breakdownPublic),
      json: JSON.stringify(reservation,null,2)
    };
    await emailjs.send(EJ.service_id, EJ.template_id, varsCliente);
    await emailjs.send(EJ.service_id, EJ.template_id, varsGestion);
  }

  /* ==== Guardado mock ==== */
  function saveReservationMock(r){
    const key="tpl.reservas";
    let arr=[]; try{ arr=JSON.parse(localStorage.getItem(key)||"[]"); }catch(_){}
    arr.unshift(r); localStorage.setItem(key, JSON.stringify(arr));
  }

  /* ==== Build reserva ==== */
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

  /* ==== Preselección servicio (svc/service/localStorage) ==== */
  function applyServicePreselect(){
    const q = new URLSearchParams(location.search);
    const s = q.get("service") || q.get("svc") || (function(){ try{ return localStorage.getItem("tpl.lastService")||""; }catch(_){ return ""; } })();
    if(s){ $("#serviceType").value = s; }
  }
  function applyDirectQuery(){
    const q = new URLSearchParams(location.search);
    const sd = q.get("date") || q.get("startDate"); if(sd) $("#startDate").value = sd;
    const ed = q.get("endDate"); if(ed) $("#endDate").value = ed; else if(sd) $("#endDate").value = sd;
    const st = q.get("start"); if(st) $("#startTime").value = st;
    const en = q.get("end"); if(en) $("#endTime").value = en;
    const region = q.get("region"); if(region) $("#region").value = region;
    const notes = q.get("notes"); if(notes) $("#notes").value = notes;
    const prePets = q.get("pets");
    return prePets ? prePets.split(",").filter(Boolean) : [];
  }

  /* ==== Recalc/binds ==== */
  function bindRecalc(profile){
    ["serviceType","startDate","endDate","startTime","endTime","region","address","postalCode","travelNeeded","vgDuration","vgPerDay","petsCount"]
      .forEach(id=>{ $("#"+id)?.addEventListener("input", ()=>{ const p=collect(profile); renderSummary(calc(p), p); }); });
    $("#petsGrid").addEventListener("change", ()=>{ const p=collect(profile); renderSummary(calc(p), p); });
  }

  /* ==== Inicio ==== */
  async function start(){
    bindServiceSpecific();

    if(!hasFB()){ setGate(true); renderPets([]); return; }

    if(!window.__TPL_AUTH_BRIDGE__ || !__TPL_AUTH_BRIDGE__.ensureLogged({loginUrl:"/login.html"})){
      setGate(true); renderPets([]); return;
    }

    firebase.auth().onAuthStateChanged(async(u)=>{
      if(!u){ setGate(true); renderPets([]); return; }
      setGate(false);

      const profile = await ensureProfileDocument(u.uid, u) || {pets:[]};

      // Preselección servicio y portado
      applyServicePreselect();
      const directPetIds = applyDirectQuery();
      const bridged = (window.__TPL_AUTH_BRIDGE__ && __TPL_AUTH_BRIDGE__.getPortState && __TPL_AUTH_BRIDGE__.getPortState()) || null;
      if(bridged){
        if(bridged.service || bridged.svc) $("#serviceType").value = bridged.service || bridged.svc;
        if(bridged.date){ $("#startDate").value = bridged.date; $("#endDate").value = bridged.date; }
        if(bridged.start) $("#startTime").value = bridged.start;
        if(bridged.end)   $("#endTime").value   = bridged.end;
        if(bridged.region)$("#region").value    = bridged.region;
        if(bridged.notes) $("#notes").value     = bridged.notes;
      }

      // Autorrellena titular + pinta mascotas
      fillOwner(profile);
      renderPets(profile.pets||[]);

      // Selección previa de mascotas (URL/bridge)
      const idsFromBridge = bridged && bridged.pets ? String(bridged.pets).split(",").filter(Boolean) : [];
      const wantIds = new Set([...(directPetIds||[]), ...(idsFromBridge||[])]);
      if(wantIds.size){
        $$("#petsGrid .pet-check").forEach(ch=>{
          if(wantIds.has(ch.getAttribute("data-id"))) ch.checked = true;
        });
      }

      // Recalc inicial + binds
      bindRecalc(profile);
      const p0 = collect(profile);
      renderSummary(calc(p0), p0);

      // Enviar
      $("#btnReserve")?.addEventListener("click", async ()=>{
        const p = collect(profile);
        if(!p.serviceType) return alert("Selecciona un servicio.");
        if(!p.startDate || !p.endDate) return alert("Introduce fecha de inicio y fin.");
        const d1=parseDate(p.startDate), d2=parseDate(p.endDate);
        if(d2<d1) return alert("La fecha fin debe ser igual o posterior a inicio.");
        if(p.startTime && p.endTime){
          const [h1,m1]=p.startTime.split(":").map(Number), [h2,m2]=p.endTime.split(":").map(Number);
          if(h2*60+m2 <= h1*60+m1) return alert("La hora fin debe ser posterior a la de inicio.");
        }
        if((p.pets||[]).length===0) return alert("Elige al menos una mascota.");

        const c = calc(p);
        const res = buildReservation(profile, c, p);

        try{ await sendEmails(res); }catch(e){ console.warn("EmailJS error", e); }
        saveReservationMock(res);

        $("#reservaForm").style.display="none";
        $("#thanks").style.display="block";
      });
    });
  }

  window.addEventListener("load", start);
})();
