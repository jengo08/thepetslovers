/* TPL · Reservas — Único JS (auth + portado + UI + precios + margen exacto + emails demo)
   Requisitos:
   - Firebase compat (app/auth/firestore) inicializado (para sesión y perfil real).
   - EmailJS opcional (para correos demo): define window.EMAILJS = {enabled, service_id, template_cliente, template_gestion, public_key}.
   - HTML con los IDs del último ejemplo del usuario.
*/

(function(){
  /************ UTILIDADES BÁSICAS ************/
  const $  = (s,root=document)=>root.querySelector(s);
  const $$ = (s,root=document)=>Array.from(root.querySelectorAll(s));
  const fmt = n => (typeof n!=="number"||isNaN(n))?"—":n.toFixed(2).replace(".",",")+" €";
  const todayStr = ()=>{const d=new Date();const m=String(d.getMonth()+1).padStart(2,"0");const dd=String(d.getDate()).padStart(2,"0");return `${d.getFullYear()}-${m}-${dd}`};
  const parseDate = v=>{const d=new Date(v); return isNaN(d)?null:d;};
  const diffMinutes = (a,b)=>Math.round((a-b)/60000);
  const monthDayKey = dstr=>{ const d=parseDate(dstr); if(!d) return ""; const m=String(d.getMonth()+1).padStart(2,"0"); const dd=String(d.getDate()).padStart(2,"0"); return `${m}-${dd}`; };
  const hoursBetween = (start,end)=>{
    if(!start || !end) return 0;
    const [h1,m1]=start.split(":").map(Number); const [h2,m2]=end.split(":").map(Number);
    let t=(h2*60+m2)-(h1*60+m1); if(t<0) t=0; return t/60;
  };
  const round2 = n => Math.round((n||0)*100)/100;

  /************ CONFIG DE SUPLEMENTOS / FESTIVOS ************/
  const BIG_DAYS = ["12-24","12-25","12-31","01-01"]; // MM-DD
  const FESTIVO_NORMAL_PLUS = 10; // cliente
  const FESTIVO_NORMAL_AUX = 8;
  const BIG_DAY_PLUS = 30; // cliente
  const BIG_DAY_AUX = 15;
  const URGENCIA_PLUS = 10; // cliente (tu margen)

  /************ PRECIOS (CLIENTE) ************/
  const PUBLIC_PRICES = {
    guarderia_dia: { adulto: 15, cachorro: 20,
      bonos: { adult: {10:135,20:250,30:315}, puppy: {10:185,20:350,30:465} }
    },
    alojamiento_nocturno: {
      std: { normal: 30, desde11: 27 },
      puppy: { normal: 35, desde11: 32 },
      segundo: { normal: 25, desde11: 22 }
    },
    paseo: {
      base: 12, extra_mascota: 8,
      bonos: {10:115,15:168,20:220,25:270,30:318}
    },
    visita_gato: {
      base60: 22, base90: 30, d11_60: 18, d11_90: 27,
      med15: 12, med15_d11: 10,
      gatosExtra: { one:12, twoEach:8, moreEach:6 }
    },
    exoticos_aves: { base: 20 },
    exoticos_reptiles: { base: 20 },
    exoticos_mamiferos: { base: 25 },
    transporte: { base: 20 } // cliente
  };

  /************ PAGOS AL AUXILIAR (EXACTOS, según tu punto 7) ************/
  const AUX_PAY = {
    guarderia_dia: {
      adulto: 12, cachorro: 15,
      // Bonos: coste auxiliar por DÍA (tu lista: 11/10/9 y 16/14/12)
      bonosAdult: {10:11,20:10,30:9},
      bonosPuppy: {10:16,20:14,30:12}
    },
    alojamiento_nocturno: {
      // normal/cachorro y desde día 11
      std:{ normal:25, desde11:22 },
      puppy:{ normal:30, desde11:27 },
      segundo:{ normal:20, desde11:17 }
    },
    paseo: { base:10, extra_mascota:5, bonos:{10:8,15:7.5,20:7,25:6.5,30:6} },
    visita_gato: {
      base60:17, base90:25, d11_60:12, d11_90:21,
      med15_publicEqualsAux:true, // medicación sin margen (aux = precio público)
      gatosExtra:{ one:10, twoEach:6, moreEach:4 }
    },
    exoticos_aves:{ base:15 },
    exoticos_reptiles:{ base:15 },
    exoticos_mamiferos:{ base:20 },
    transporte:{ base:15 }
  };

  /************ SESIÓN (Firebase si está, si no, mock) ************/
  function hasFirebase(){ return !!(window.firebase && firebase.auth && firebase.firestore); }
  function firebaseUser(){ try{ return firebase.auth().currentUser || null; }catch(_){ return null; } }
  async function getProfileFromFirestore(){
    try{
      const u = firebaseUser(); if(!u) return null;
      const snap = await firebase.firestore().collection('propietarios').doc(u.uid).get();
      if(!snap.exists) return { fullName: u.displayName||"", email: u.email||"", pets: [] };
      const data = snap.data()||{};
      // normaliza mascotas
      data.pets = Array.isArray(data.pets)?data.pets:[]; 
      return data;
    }catch(e){ console.warn('[TPL] Firestore perfil error', e); return null; }
  }
  function getMockProfile(){
    // Usa localStorage si existe
    try{
      const p = JSON.parse(localStorage.getItem("tpl.profile")||"null");
      if (p) return p;
    }catch(_){}
    // Mock mínimo para poder ver UI si no hay sesión
    return {
      fullName:"", email:"", phone:"", address:"", postalCode:"", region:"",
      pets:[
        {id:"luna", name:"Luna", species:"perro", birth:"2025-07-10", img:""},
        {id:"michi", name:"Michi", species:"gato", birth:"2022-05-01", img:""},
        {id:"kiko", name:"Kiko", species:"exotico", subtype:"ave", birth:"2021-03-03", img:""}
      ]
    };
  }
  function isLoggedSync(){ return !!firebaseUser(); }

  /************ PORTADO DE DATOS (Servicios → Reservas) ************/
  function readQuery(){
    const p = new URLSearchParams(location.search);
    return {
      service: p.get("service")||"",
      date: p.get("date")||"",
      start: p.get("start")||"",
      end: p.get("end")||"",
      pets: (p.get("pets")||"").split(",").filter(Boolean),
      region: p.get("region")||"",
      notes: p.get("notes")||"",
      from: p.get("from")||""
    };
  }
  function buildReturnURL(base, state){
    const usp = new URLSearchParams(state);
    return `${base}?${usp.toString()}`;
  }
  function redirectToLoginIfNeeded(q){
    // Si venimos de Servicios y no hay sesión → redirige a login con returnTo a reservas y porta estado
    if(q.from==="services" && !isLoggedSync()){
      const state = {
        service: q.service||$("#serviceType")?.value||"",
        date: q.date||$("#serviceDate")?.value||todayStr(),
        start: q.start||$("#startTime")?.value||"",
        end: q.end||$("#endTime")?.value||"",
        pets: (q.pets||[]).join(","),
        region: q.region||$("#region")?.value||"",
        notes: q.notes||$("#notes")?.value||"",
        from:"services"
      };
      const returnTo = buildReturnURL("/reservas.html", state);
      const loginUrl = `/login.html?returnTo=${encodeURIComponent(returnTo)}`;
      location.href = loginUrl;
      return true;
    }
    return false;
  }

  /************ UI: Relleno / Mascotas / Edad cachorro ************/
  function ageMonths(birth){
    const d = parseDate(birth); if(!d) return null;
    const now = new Date();
    return (now.getFullYear()-d.getFullYear())*12 + (now.getMonth()-d.getMonth()) - (now.getDate()<d.getDate()?1:0);
  }
  function isPuppy(pet){
    if(pet.species!=="perro") return false;
    const m = ageMonths(pet.birth);
    return (m!=null && m<=6);
  }

  function renderPets(profile){
    const grid = $("#petsGrid"); if(!grid) return;
    grid.innerHTML = "";
    const pets = (profile?.pets)||[];
    pets.slice(0,50).forEach(p=>{
      const puppy = isPuppy(p);
      const card = document.createElement("label");
      card.className = "pet-card";
      card.innerHTML = `
        <input type="checkbox" class="pet-check" data-id="${p.id}">
        <img class="pet-img" src="${p.img||""}" alt="${p.name||'Mascota'}" onerror="this.style.display='none'">
        <div style="flex:1">
          <div><strong>${p.name||"Mascota"}</strong>
            ${p.species==="perro" ? '<i class="fa-solid fa-dog"></i>' :
              p.species==="gato" ? '<i class="fa-solid fa-cat"></i>' :
              '<i class="fa-solid fa-kiwi-bird"></i>'}
            ${puppy ? '<span class="badge">Cachorro (≤6m)</span>' : ''}
          </div>
          <div class="pet-meta">${(p.species==="exotico"?(p.subtype?("Exótico · "+p.subtype):"Exótico"):p.species)} · Nac: ${p.birth||"—"}</div>
        </div>
      `;
      grid.appendChild(card);
    });
  }
  function selectedPets(profile){
    const ids = $$(".pet-check:checked").map(x=>x.getAttribute("data-id"));
    const all = (profile?.pets)||[];
    return all.filter(p=>ids.includes(p.id)).slice(0,3);
  }
  function fillOwner(profile){
    const full = profile?.fullName || ((profile?.name||"")+" "+(profile?.surname||"")).trim();
    if(full) $("#ownerFullName").value = full;
    if(profile?.email) $("#email").value = profile.email;
    if(profile?.phone) $("#phone").value = profile.phone;
    if(profile?.address) $("#address").value = profile.address;
    if(profile?.postalCode) $("#postalCode").value = profile.postalCode;
    if(profile?.region) $("#region").value = profile.region;
  }

  /************ APLICAR PORTADO (service,date,start,end,pets,region,notes) ************/
  function applyPort(profile,q){
    if(q.service){ $("#serviceType").value = q.service; }
    if(q.date){ $("#serviceDate").value = q.date; }
    if(q.start){ $("#startTime").value = q.start; }
    if(q.end){ $("#endTime").value = q.end; }
    if(q.region){ $("#region").value = q.region; }
    if(q.notes){ $("#notes").value = q.notes; }
    // mascotas preseleccionadas por id
    if(q.pets && q.pets.length){
      const ids = Array.isArray(q.pets)?q.pets:q.pets.split(",");
      $$(".pet-check").forEach(ch=>{ if(ids.includes(ch.getAttribute("data-id"))) ch.checked = true; });
    }
  }

  /************ CÁLCULO DE PRECIO (cliente) + AUX (exacto) ************/
  function labelService(s){
    return ({
      guarderia_dia:"Guardería de día",
      alojamiento_nocturno:"Alojamiento nocturno",
      paseo:"Paseo",
      visita_gato:"Visita gato",
      exoticos_aves:"Visita exóticos (aves)",
      exoticos_reptiles:"Visita exóticos (reptiles)",
      exoticos_mamiferos:"Visita exóticos (mamíferos)",
      transporte:"Transporte"
    })[s]||s;
  }
  function serviceUnits(payload){
    const s = payload.serviceType;
    const units = { days:0, hours:0, units:0 };
    if(s==="guarderia_dia"||s==="alojamiento_nocturno"){
      // en este HTML actual se usa 1 fecha -> 1 día
      units.days = 1;
    }else if(s==="paseo"||s==="transporte"||s?.startsWith("exoticos")||s==="visita_gato"){
      units.units = 1;
      if(s==="visita_gato"){ units.hours = hoursBetween(payload.startTime,payload.endTime)||1; }
    }
    return units;
  }
  function isPuppyPet(p){ return p && p.species==="perro" && isPuppy(p); }

  function calcPublicAndAux(payload){
    const s = payload.serviceType;
    const date = payload.date;
    const units = serviceUnits(payload);

    let linesPublic = [];
    let linesAux = [];
    let totalPublic = 0;
    let totalAux = 0;

    const pets = payload.pets||[];
    const numPets = pets.length||1;
    const anyPuppy = pets.some(p=>isPuppy(p));

    const key = monthDayKey(date);
    const isBigDay = BIG_DAYS.includes(key);
    const isFestive = payload.festive === true;

    // BASE por servicio
    if(s==="guarderia_dia"){
      const days = Math.max(1, units.days||0);
      const puppy = anyPuppy;

      const bonoPack = puppy ? PUBLIC_PRICES.guarderia_dia.bonos.puppy : PUBLIC_PRICES.guarderia_dia.bonos.adult;
      const bonoAuxPerDay = puppy ? AUX_PAY.guarderia_dia.bonosPuppy : AUX_PAY.guarderia_dia.bonosAdult;
      const priceDay = puppy ? PUBLIC_PRICES.guarderia_dia.cachorro : PUBLIC_PRICES.guarderia_dia.adulto;
      const auxDay   = puppy ? AUX_PAY.guarderia_dia.cachorro : AUX_PAY.guarderia_dia.adulto;

      if([10,20,30].includes(days)){
        const bonoPrecio = bonoPack[days];
        const ppx = bonoPrecio/days;
        linesPublic.push({label:`Base (Guardería · ${days} días)`, calc:`Bono ${days} días (${ppx.toFixed(2)} €/día)`, amount:bonoPrecio});
        totalPublic += bonoPrecio;

        const auxPerDay = bonoAuxPerDay[days];
        const auxTotal = auxPerDay*days * Math.max(1,numPets); // si decides pagar por mascota en guardería, lo multiplicas
        linesAux.push({label:`Auxiliar (bono ${days})`, amount:auxTotal});
        totalAux += auxTotal;
      }else{
        const base = priceDay*days * Math.max(1,numPets);
        linesPublic.push({label:`Base (Guardería · ${days} días · ${numPets} mascota/s)`, amount:base});
        totalPublic += base;

        const aux = auxDay*days * Math.max(1,numPets);
        linesAux.push({label:`Auxiliar (día)`, amount:aux});
        totalAux += aux;
      }
    }

    if(s==="alojamiento_nocturno"){
      const days = Math.max(1, units.days||0);
      const petsCount = Math.max(1,numPets);
      const forEachPet = (petIndex)=>{
        const secondOrMore = (petIndex>=2);
        const puppy = isPuppyPet(pets[petIndex-1]);
        let pub=0, aux=0;
        for(let d=1; d<=days; d++){
          const desde11 = (d>=11);
          let pPub=0, pAux=0;
          if(secondOrMore){
            pPub = desde11 ? PUBLIC_PRICES.alojamiento_nocturno.segundo.desde11 : PUBLIC_PRICES.alojamiento_nocturno.segundo.normal;
            pAux = desde11 ? AUX_PAY.alojamiento_nocturno.segundo.desde11 : AUX_PAY.alojamiento_nocturno.segundo.normal;
          }else if(puppy){
            pPub = desde11 ? PUBLIC_PRICES.alojamiento_nocturno.puppy.desde11 : PUBLIC_PRICES.alojamiento_nocturno.puppy.normal;
            pAux = desde11 ? AUX_PAY.alojamiento_nocturno.puppy.desde11 : AUX_PAY.alojamiento_nocturno.puppy.normal;
          }else{
            pPub = desde11 ? PUBLIC_PRICES.alojamiento_nocturno.std.desde11 : PUBLIC_PRICES.alojamiento_nocturno.std.normal;
            pAux = desde11 ? AUX_PAY.alojamiento_nocturno.std.desde11 : AUX_PAY.alojamiento_nocturno.std.normal;
          }
          pub += pPub; aux += pAux;
        }
        linesPublic.push({label:`Base (Alojamiento · ${days} días · mascota ${petIndex})`, amount:pub});
        totalPublic += pub;
        linesAux.push({label:`Auxiliar (Alojamiento · mascota ${petIndex})`, amount:aux});
        totalAux += aux;
      };
      for(let i=1;i<=petsCount;i++) forEachPet(i);
    }

    if(s==="paseo"){
      const walks = Math.max(1, units.units||1);
      // 1 mascota incluida en base
      linesPublic.push({label:`Base (Paseo · ${walks} uds)`, calc:`${walks} × ${PUBLIC_PRICES.paseo.base.toFixed(2)}`, amount:PUBLIC_PRICES.paseo.base*walks});
      totalPublic += PUBLIC_PRICES.paseo.base*walks;

      linesAux.push({label:`Auxiliar (Paseo · ${walks})`, amount:AUX_PAY.paseo.base*walks});
      totalAux += AUX_PAY.paseo.base*walks;

      const extraPets = Math.max(0, numPets-1);
      if(extraPets>0){
        linesPublic.push({label:`Mascotas adicionales (${extraPets})`, calc:`${extraPets} × ${PUBLIC_PRICES.paseo.extra_mascota.toFixed(2)} × ${walks}`, amount:PUBLIC_PRICES.paseo.extra_mascota*extraPets*walks});
        totalPublic += PUBLIC_PRICES.paseo.extra_mascota*extraPets*walks;

        linesAux.push({label:`Aux extras (${extraPets})`, amount:AUX_PAY.paseo.extra_mascota*extraPets*walks});
        totalAux += AUX_PAY.paseo.extra_mascota*extraPets*walks;
      }
      // Bonos: cuando vendamos bono, sustituimos líneas por pack público y aux (AUX_PAY.paseo.bonos[*]).
    }

    if(s==="visita_gato"){
      const mins = Math.max(60, Math.round((hoursBetween(payload.startTime,payload.endTime)||1)*60));
      const use90 = mins>=90;
      const from11 = false; // en esta versión 1 fecha => 1ª franja; si añades rangos, marca true a partir del día 11
      if(payload.medication===true){
        const p = from11 ? PUBLIC_PRICES.visita_gato.med15_d11 : PUBLIC_PRICES.visita_gato.med15;
        const a = p; // margen 0
        linesPublic.push({label:`Visita medicación (15’)`, amount:p});
        totalPublic+=p;
        linesAux.push({label:`Aux medicación`, amount:a});
        totalAux+=a;
      }else{
        const p = use90 ? (from11?PUBLIC_PRICES.visita_gato.d11_90:PUBLIC_PRICES.visita_gato.base90)
                        : (from11?PUBLIC_PRICES.visita_gato.d11_60:PUBLIC_PRICES.visita_gato.base60);
        const a = use90 ? (from11?AUX_PAY.visita_gato.d11_90:AUX_PAY.visita_gato.base90)
                        : (from11?AUX_PAY.visita_gato.d11_60:AUX_PAY.visita_gato.base60);
        linesPublic.push({label:`Base (Visita gato · ${use90?90:60}’)`, amount:p});
        totalPublic+=p;
        linesAux.push({label:`Aux visita gato`, amount:a});
        totalAux+=a;

        // gatos extra (por visita)
        const cats = pets.filter(p=>p.species==="gato").length || 1;
        const extraCats = Math.max(0,cats-1);
        if(extraCats>0){
          let perClient, perAux;
          if(extraCats===1){ perClient=PUBLIC_PRICES.visita_gato.gatosExtra.one; perAux=AUX_PAY.visita_gato.gatosExtra.one; }
          else if(extraCats===2){ perClient=PUBLIC_PRICES.visita_gato.gatosExtra.twoEach; perAux=AUX_PAY.visita_gato.gatosExtra.twoEach; }
          else { perClient=PUBLIC_PRICES.visita_gato.gatosExtra.moreEach; perAux=AUX_PAY.visita_gato.gatosExtra.moreEach; }
          const addC = perClient * extraCats;
          const addA = perAux * extraCats;
          linesPublic.push({label:`Gatos extra (${extraCats})`, amount:addC});
          totalPublic+=addC;
          linesAux.push({label:`Aux gatos extra`, amount:addA});
          totalAux+=addA;
        }
      }
    }

    if(s==="exoticos_aves"||s==="exoticos_reptiles"||s==="exoticos_mamiferos"){
      const base = PUBLIC_PRICES[s].base;
      const aux  = AUX_PAY[s].base;
      linesPublic.push({label:`Base (${labelService(s)})`, amount:base});
      totalPublic+=base;
      linesAux.push({label:`Aux ${labelService(s)}`, amount:aux});
      totalAux+=aux;
    }

    if(s==="transporte"){
      const base = PUBLIC_PRICES.transporte.base;
      const aux  = AUX_PAY.transporte.base;
      linesPublic.push({label:`Transporte`, amount:base});
      totalPublic+=base;
      linesAux.push({label:`Aux transporte`, amount:aux});
      totalAux+=aux;
    }

    // SUPLEMENTOS AUTOMÁTICOS
    // Urgencia (<2h hoy)
    const now = new Date();
    const today = todayStr();
    if(date===today && payload.startTime){
      const [hh,mm]=payload.startTime.split(":").map(Number);
      const start = new Date(); start.setHours(hh||0,mm||0,0,0);
      const minsDiff = diffMinutes(start, now);
      if(minsDiff>0 && minsDiff<120){
        linesPublic.push({label:"Suplemento urgencia (<2h)", amount:URGENCIA_PLUS});
        totalPublic += URGENCIA_PLUS;
        // Auxiliar no sube por urgencia (tu margen)
      }
    }
    if(isBigDay){
      linesPublic.push({label:`Día señalado (${key})`, amount:BIG_DAY_PLUS});
      totalPublic += BIG_DAY_PLUS;
      linesAux.push({label:`Aux día señalado`, amount:BIG_DAY_AUX});
      totalAux += BIG_DAY_AUX;
    }else if(isFestive){
      linesPublic.push({label:`Festivo`, amount:FESTIVO_NORMAL_PLUS});
      totalPublic += FESTIVO_NORMAL_PLUS;
      linesAux.push({label:`Aux festivo`, amount:FESTIVO_NORMAL_AUX});
      totalAux += FESTIVO_NORMAL_AUX;
    }

    // Desplazamiento: pendiente (nota, no suma)
    if(payload.travelNeeded==="si"){ linesPublic.push({label:`Desplazamiento`, note:"pendiente"}); }

    // PAY NOW = margen exacto (total cliente - total auxiliar)
    const payNow = Math.max(0, totalPublic - totalAux);
    const payLater = Math.max(0, totalPublic - payNow);

    return {
      linesPublic,
      totalPublic: round2(totalPublic),
      totalAux: round2(totalAux),
      payNow: round2(payNow),
      payLater: round2(payLater)
    };
  }

  /************ RENDER DESGLOSE ************/
  function renderSummary(calc, payload){
    const ctx = `${labelService(payload.serviceType)||"—"} · ${payload.date||"—"}${payload.startTime?(" · "+payload.startTime):""}${payload.endTime?("–"+payload.endTime):""} · ${(payload.pets||[]).length||0} mascota(s)`;
    $("#summaryContext").textContent = ctx;

    const box = $("#summaryLines"); box.innerHTML = "";
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

  /************ RECOLECCIÓN ************/
  function collectPayload(profile){
    const petsSel = selectedPets(profile);
    return {
      serviceType: $("#serviceType").value,
      date: $("#serviceDate").value,
      startTime: $("#startTime").value,
      endTime: $("#endTime").value,
      region: $("#region").value,
      notes: $("#notes").value,
      address: $("#address").value,
      postalCode: $("#postalCode").value,
      festive: false, // si conectas un calendario por CA, marca true según corresponda
      travelNeeded: $("#travelNeeded")?.value || "no",
      pets: petsSel
    };
  }

  /************ SIMULAR PAGO + EMAILS DEMO + PERFIL MOCK ************/
  function saveReservationMock(r){
    const key="tpl.reservas";
    let arr=[]; try{ arr=JSON.parse(localStorage.getItem(key)||"[]"); }catch(_){}
    arr.unshift(r);
    localStorage.setItem(key, JSON.stringify(arr));
  }

  async function simulatePayment(reservation){
    reservation.status = "paid_review";
    saveReservationMock(reservation);

    try{
      if(window.EMAILJS && EMAILJS.enabled){
        try{ emailjs.init(EMAILJS.public_key); }catch(_){}
        const varsCliente = {
          to_name: reservation.owner.fullName,
          total: fmt(reservation.pricing.totalClient),
          pay_now: fmt(reservation.pricing.payNow),
          pay_later: fmt(reservation.pricing.payLater),
          servicio: labelService(reservation.service.type),
          fecha: reservation.dates.date + (reservation.dates.startTime?` ${reservation.dates.startTime}`:""),
          mascotas: (reservation.pets||[]).map(p=>p.name).join(", ")||"—"
        };
        const varsGestion = {
          cliente: reservation.owner.fullName + " · " + reservation.owner.email + " · " + reservation.owner.phone,
          servicio: labelService(reservation.service.type),
          total: fmt(reservation.pricing.totalClient),
          pay_now: fmt(reservation.pricing.payNow),
          pay_later: fmt(reservation.pricing.payLater),
          json: JSON.stringify(reservation,null,2)
        };
        await emailjs.send(EMAILJS.service_id, EMAILJS.template_cliente, varsCliente);
        await emailjs.send(EMAILJS.service_id, EMAILJS.template_gestion, varsGestion);
      }else{
        console.log("[EMAIL DEMO] Cliente/Resumen:", reservation);
      }
    }catch(e){ console.warn("Email demo error", e); }

    $("#reservaForm").style.display="none";
    $("#thanks").style.display="block";
  }

  function buildReservation(profile, calc, payload){
    return {
      id: "resv_"+Date.now(),
      status: "pending_payment",
      createdAt: new Date().toISOString(),
      service: { type: payload.serviceType },
      dates: { date: payload.date, startTime: payload.startTime||null, endTime: payload.endTime||null },
      region: payload.region,
      owner: {
        fullName: $("#ownerFullName").value.trim(),
        email: $("#email").value.trim(),
        phone: $("#phone").value.trim(),
        address: $("#address").value.trim(),
        postalCode: $("#postalCode").value.trim(),
        contactPref: $("#contactPref")?.value||"",
        contactTime: $("#contactTime")?.value||""
      },
      pets: payload.pets,
      flags: {
        urgency: calc.linesPublic.some(l=>l.label.toLowerCase().includes("urgencia")),
        bigDay: BIG_DAYS.includes(monthDayKey(payload.date)),
        festive: payload.festive===true,
        travelNeeded: payload.travelNeeded==="si"
      },
      pricing: {
        breakdownPublic: calc.linesPublic,
        totalClient: calc.totalPublic,
        payNow: calc.payNow,
        payLater: calc.payLater,
        currency:"EUR"
      },
      internal: {
        totalAux: calc.totalAux,
        margin: round2(calc.totalPublic - calc.totalAux)
      }
    };
  }

  /************ BIND / RECÁLCULO ************/
  function bindRecalc(profile){
    ["serviceType","serviceDate","startTime","endTime","region","notes","address","postalCode","travelNeeded"].forEach(id=>{
      $("#"+id)?.addEventListener("input", ()=>doRecalc(profile));
    });
    $("#petsGrid")?.addEventListener("change", ()=>doRecalc(profile));
  }
  function doRecalc(profile){
    const payload = collectPayload(profile);
    if(!payload.serviceType || !payload.date){
      renderSummary({linesPublic:[],totalPublic:0,payNow:0,payLater:0}, payload);
      return;
    }
    const calc = calcPublicAndAux(payload);
    renderSummary(calc, payload);
    sessionStorage.setItem("tpl.lastCalc", JSON.stringify({payload,calc}));
  }

  /************ INIT ************/
  window.addEventListener("load", async ()=>{
    const q = readQuery();
    if (redirectToLoginIfNeeded(q)) return;

    let profile = null;
    if (hasFirebase()){
      // Puerta de sesión Firebase
      firebase.auth().onAuthStateChanged(async(u)=>{
        if(!u){
          $("#sessionGate").style.display="block";
          $("#reservaForm").classList.add("disabled");
          profile = getMockProfile();
          renderPets(profile);
          // Portado + recálculo visible aunque no puedas reservar
          applyPort(profile, q);
          fillOwner(profile); // si mock tuviera datos
          bindRecalc(profile);
          doRecalc(profile);
        }else{
          $("#sessionGate").style.display="none";
          $("#reservaForm").classList.remove("disabled");
          profile = await getProfileFromFirestore() || getMockProfile();
          renderPets(profile);
          fillOwner(profile);
          applyPort(profile, q);
          bindRecalc(profile);
          doRecalc(profile);
        }
      });
    }else{
      // Sin Firebase: modo demo con mock
      if(q.from==="services"){
        // sin sesión real, “redirigir” a login si quieres:
        $("#sessionGate").style.display="block";
        $("#reservaForm").classList.add("disabled");
      }
      profile = getMockProfile();
      renderPets(profile);
      fillOwner(profile);
      applyPort(profile, q);
      bindRecalc(profile);
      doRecalc(profile);
    }

    // CTA reservar
    $("#btnReserve")?.addEventListener("click", ()=>{
      if(hasFirebase() && !firebaseUser()){
        alert("Inicia sesión o crea tu cuenta para completar la reserva.");
        return;
      }
      const payload = collectPayload(profile);
      if(!payload.serviceType || !payload.date){ alert("Selecciona servicio y fecha."); return; }
      const selPets = selectedPets(profile);
      if(selPets.length===0){ alert("Elige al menos una mascota."); return; }

      const calc = calcPublicAndAux(payload);
      const reservation = buildReservation(profile, calc, payload);

      // Aquí luego sustituiremos simulatePayment por Stripe Checkout real + webhooks
      simulatePayment(reservation);
    });
  });

})();
