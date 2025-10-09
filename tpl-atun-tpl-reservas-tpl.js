/* TPL · Reservas — Único JS (auth + portado + UI + precios + margen exacto + emails demo)
   HTML esperado: IDs serviceType, serviceDate, startTime, endTime, region, address, postalCode, notes,
   petsGrid, ownerFullName, email, phone, contactPref, contactTime, travelNeeded,
   summaryContext, summaryLines, subtotalTxt, payNowTxt, payLaterTxt, btnReserve, sessionGate, reservaForm, thanks.
*/
(function(){
  // Utils
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

  // Festivos/suplementos
  const BIG_DAYS = ["12-24","12-25","12-31","01-01"]; // MM-DD
  const FESTIVO_NORMAL_PLUS = 10, FESTIVO_NORMAL_AUX = 8;
  const BIG_DAY_PLUS = 30, BIG_DAY_AUX = 15;
  const URGENCIA_PLUS = 10;

  // Cliente (público)
  const PUBLIC_PRICES = {
    guarderia_dia: { adulto: 15, cachorro: 20,
      bonos: { adult: {10:135,20:250,30:315}, puppy: {10:185,20:350,30:465} }
    },
    alojamiento_nocturno: {
      std: { normal: 30, desde11: 27 },
      puppy: { normal: 35, desde11: 32 },
      segundo: { normal: 25, desde11: 22 }
    },
    paseo: { base: 12, extra_mascota: 8, bonos: {10:115,15:168,20:220,25:270,30:318} },
    visita_gato: {
      base60: 22, base90: 30, d11_60: 18, d11_90: 27,
      med15: 12, med15_d11: 10,
      gatosExtra: { one:12, twoEach:8, moreEach:6 }
    },
    exoticos_aves: { base: 20 },
    exoticos_reptiles: { base: 20 },
    exoticos_mamiferos: { base: 25 },
    transporte: { base: 20 }
  };

  // Auxiliar (exacto, según tu tabla)
  const AUX_PAY = {
    guarderia_dia: {
      adulto: 12, cachorro: 15,
      bonosAdult: {10:11,20:10,30:9},
      bonosPuppy: {10:16,20:14,30:12}
    },
    alojamiento_nocturno: {
      std:{ normal:25, desde11:22 },
      puppy:{ normal:30, desde11:27 },
      segundo:{ normal:20, desde11:17 }
    },
    paseo: { base:10, extra_mascota:5, bonos:{10:8,15:7.5,20:7,25:6.5,30:6} },
    visita_gato: {
      base60:17, base90:25, d11_60:12, d11_90:21,
      med15_publicEqualsAux:true,
      gatosExtra:{ one:10, twoEach:6, moreEach:4 }
    },
    exoticos_aves:{ base:15 },
    exoticos_reptiles:{ base:15 },
    exoticos_mamiferos:{ base:20 },
    transporte:{ base:15 }
  };

  // Firebase helpers
  const hasFirebase = ()=>!!(window.firebase && firebase.auth && firebase.firestore);
  const firebaseUser = ()=>{ try{ return firebase.auth().currentUser || null; }catch(_){ return null; } };
  async function getProfileFromFirestore(){
    try{
      const u = firebaseUser(); if(!u) return null;
      const snap = await firebase.firestore().collection('propietarios').doc(u.uid).get();
      if(!snap.exists) return { fullName: u.displayName||"", email: u.email||"", pets: [] };
      const data = snap.data()||{}; data.pets = Array.isArray(data.pets)?data.pets:[]; return data;
    }catch(e){ console.warn('[TPL] Firestore perfil error', e); return null; }
  }

  // Mock/LS
  function getMockProfile(){
    try{
      const p = JSON.parse(localStorage.getItem("tpl.profile")||"null");
      if (p) return p;
    }catch(_){}
    return { fullName:"", email:"", phone:"", address:"", postalCode:"", region:"",
      pets:[
        {id:"luna", name:"Luna", species:"perro", birth:"2025-07-10", img:""},
        {id:"michi", name:"Michi", species:"gato", birth:"2022-05-01", img:""},
        {id:"kiko", name:"Kiko", species:"exotico", subtype:"ave", birth:"2021-03-03", img:""}
      ] };
  }

  // Query/portado
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
    if(q.from==="services" && !firebaseUser()){
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
      location.href = `/login.html?returnTo=${encodeURIComponent(returnTo)}`;
      return true;
    }
    return false;
  }

  // Edad cachorro
  function ageMonths(birth){
    const d = parseDate(birth); if(!d) return null;
    const now = new Date();
    return (now.getFullYear()-d.getFullYear())*12 + (now.getMonth()-d.getMonth()) - (now.getDate()<d.getDate()?1:0);
  }
  function isPuppy(pet){ if(pet.species!=="perro") return false; const m=ageMonths(pet.birth); return (m!=null && m<=6); }
  const isPuppyPet = p => p && p.species==="perro" && isPuppy(p);

  // Render mascotas
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
  function applyPort(profile,q){
    if(q.service){ $("#serviceType").value = q.service; }
    if(q.date){ $("#serviceDate").value = q.date; }
    if(q.start){ $("#startTime").value = q.start; }
    if(q.end){ $("#endTime").value = q.end; }
    if(q.region){ $("#region").value = q.region; }
    if(q.notes){ $("#notes").value = q.notes; }
    if(q.pets && q.pets.length){
      const ids = Array.isArray(q.pets)?q.pets:q.pets.split(",");
      $$(".pet-check").forEach(ch=>{ if(ids.includes(ch.getAttribute("data-id"))) ch.checked = true; });
    }
  }

  // Cálculo
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
    if(s==="guarderia_dia"||s==="alojamiento_nocturno"){ units.days = 1; }
    else { units.units = 1; if(s==="visita_gato"){ units.hours = hoursBetween(payload.startTime,payload.endTime)||1; } }
    return units;
  }

  function calcPublicAndAux(payload){
    const s = payload.serviceType;
    const date = payload.date;
    const units = serviceUnits(payload);

    let linesPublic = [], linesAux = [];
    let totalPublic = 0, totalAux = 0;

    const pets = payload.pets||[];
    const numPets = pets.length||1;
    const anyPuppy = pets.some(p=>isPuppy(p));
    const key = monthDayKey(date);
    const isBigDay = BIG_DAYS.includes(key);
    const isFestive = payload.festive === true;

    // — Guardería
    if(s==="guarderia_dia"){
      const days = Math.max(1, units.days||0);
      const puppy = anyPuppy;
      const bonoPack = puppy ? PUBLIC_PRICES.guarderia_dia.bonos.puppy : PUBLIC_PRICES.guarderia_dia.bonos.adult;
      const bonoAuxPerDay = puppy ? AUX_PAY.guarderia_dia.bonosPuppy : AUX_PAY.guarderia_dia.bonosAdult;
      const priceDay = puppy ? PUBLIC_PRICES.guarderia_dia.cachorro : PUBLIC_PRICES.guarderia_dia.adulto;
      const auxDay   = puppy ? AUX_PAY.guarderia_dia.cachorro : AUX_PAY.guarderia_dia.adulto;

      if([10,20,30].includes(days)){
        const bonoPrecio = bonoPack[days];
        linesPublic.push({label:`Base (Guardería · Bono ${days} días)`, calc:`${(bonoPrecio/days).toFixed(2)} €/día`, amount:bonoPrecio});
        totalPublic += bonoPrecio;
        const auxTotal = bonoAuxPerDay[days]*days * Math.max(1,numPets);
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

    // — Alojamiento nocturno
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

    // — Paseo (60’)
    if(s==="paseo"){
      const walks = Math.max(1, units.units||1);
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
    }

    // — Visita gato
    if(s==="visita_gato"){
      const mins = Math.max(60, Math.round((hoursBetween(payload.startTime,payload.endTime)||1)*60));
      const use90 = mins>=90;
      const from11 = false;
      // Base
      const p = use90 ? (from11?PUBLIC_PRICES.visita_gato.d11_90:PUBLIC_PRICES.visita_gato.base90)
                      : (from11?PUBLIC_PRICES.visita_gato.d11_60:PUBLIC_PRICES.visita_gato.base60);
      const a = use90 ? (from11?AUX_PAY.visita_gato.d11_90:AUX_PAY.visita_gato.base90)
                      : (from11?AUX_PAY.visita_gato.d11_60:AUX_PAY.visita_gato.base60);
      linesPublic.push({label:`Base (Visita gato · ${use90?90:60}’)`, amount:p});
      totalPublic+=p;
      linesAux.push({label:`Aux visita gato`, amount:a});
      totalAux+=a;

      // Gatos extra
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

      // Medicación (si quisieras activarlo por UI: payload.medication===true)
      if (payload.medication===true){
        const pMed = PUBLIC_PRICES.visita_gato.med15;
        linesPublic.push({label:`Visita medicación (15’)`, amount:pMed});
        totalPublic += pMed;
        // aux = publico (sin margen)
        linesAux.push({label:`Aux medicación`, amount:pMed});
        totalAux += pMed;
      }
    }

    // — Exóticos
    if(s==="exoticos_aves"||s==="exoticos_reptiles"||s==="exoticos_mamiferos"){
      const base = PUBLIC_PRICES[s].base;
      const aux  = AUX_PAY[s].base;
      linesPublic.push({label:`Base (${labelService(s)})`, amount:base});
      totalPublic+=base;
      linesAux.push({label:`Aux ${labelService(s)}`, amount:aux});
     
