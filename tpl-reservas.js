/*!
 * TPL · reservas (2025-10)
 * - Preselección por URL (?service=..., vgDuration, vgPerDay, dates, times)
 * - Autorrelleno robusto desde propietarios/{uid} (nombre+apellido, telefono, region, address, cp…)
 * - Tarjetas de mascotas del perfil (exóticos: selector de subtipo si falta)
 * - Bonos guardería (descomposición 30/20/10 + sueltos)
 * - Alojamiento desde día 11 = 28 €
 * - Visita gato: 2ª visita 15’ (12€/10€ desde día 11)
 * - Envío: Firestore (reservas) + EmailJS (un template para cliente y gestión)
 * - Gracias + redirección suave a /perfil.html
 */

/*** EMAILJS CONFIG (tus IDs) ***/
window.EMAILJS = window.EMAILJS || {
  enabled: true,
  service_id: "service_odjqrfl",
  template_id: "template_rao5n0c", // mismo template para cliente y gestión
  public_key: "L2xAATfVuHJwj4EIV",
  admin_email: "gestion@thepetslovers.es"
};
try{ if(EMAILJS.enabled && window.emailjs){ emailjs.init(EMAILJS.public_key); } }catch(e){}

/*** HELPERS ***/
const $ = (s,root=document)=>root.querySelector(s);
const $$ = (s,root=document)=>Array.from(root.querySelectorAll(s));
const fmt = n => (typeof n!=="number"||isNaN(n))?"—":n.toFixed(2).replace(".",",")+" €";
const todayISO = ()=>new Date().toISOString().slice(0,10);
const parseISO = s => { const d=new Date(s); return isNaN(d)?null:d; };
function daysInclusive(aISO, bISO){ const a=parseISO(aISO), b=parseISO(bISO||aISO); if(!a||!b) return 0; const ms=Date.UTC(b.getFullYear(),b.getMonth(),b.getDate())-Date.UTC(a.getFullYear(),a.getMonth(),a.getDate()); return Math.floor(ms/86400000)+1; }
function monthDayKey(dateISO){ const d=parseISO(dateISO); if(!d) return ""; const m=String(d.getMonth()+1).padStart(2,"0"), dd=String(d.getDate()).padStart(2,"0"); return `${m}-${dd}`; }
function diffMinutes(a,b){ return Math.round((a-b)/60000); }

/*** PRECIOS Y REGLAS ***/
const BIG_DAYS = ["12-24","12-25","12-31","01-01"];
const FESTIVO_NORMAL_PLUS = 10; const FESTIVO_NORMAL_AUX = 8;
const BIG_DAY_PLUS = 30; const BIG_DAY_AUX = 15;
const URGENCIA_PLUS = 10;

const PUBLIC_PRICES = {
  guarderia_dia: {
    adulto: 15, cachorro: 20,
    bonos: { adult: {10:135,20:250,30:315}, puppy: {10:185,20:350,30:465} }
  },
  alojamiento_nocturno: {
    std:   { normal: 30, desde11: 28 }, // <= confirmado
    puppy: { normal: 35, desde11: 32 },
    segundo:{ normal: 25, desde11: 22 }
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

const AUX_PAY = {
  guarderia_dia: { adulto: 12, cachorro: 17, bonosAdult:{10:11,20:10,30:9}, bonosPuppy:{10:16,20:14,30:12} },
  alojamiento_nocturno: {
    std:{ normal:25, desde11:22 }, puppy:{ normal:30, desde11:27 }, segundo:{ normal:20, desde11:17 }
  },
  paseo: { base:10, extra_mascota:5, bonos:{10:8,15:7.5,20:7,25:6.5,30:6} },
  visita_gato: { base60:17, base90:25, d11_60:12, d11_90:21, med15_publicEqualsAux:true,
    gatosExtra:{ one:10, twoEach:6, moreEach:4 } },
  exoticos_aves:{ base:15 }, exoticos_reptiles:{ base:15 }, exoticos_mamiferos:{ base:20 }, transporte:{ base:15 }
};

/*** AUTH ESPERADO ***/
async function awaitAuthUser(){
  return new Promise(resolve=>{
    try{
      const off = firebase.auth().onAuthStateChanged(u=>{ off && off(); resolve(u||null); });
    }catch(_){ resolve(null); }
  });
}

/*** LECTURA PERFIL ***/
async function getOwnerDoc(uid){
  try{
    const snap = await firebase.firestore().collection("propietarios").doc(uid).get();
    if(!snap.exists){
      console.warn("[reservas] propietarios/{uid} no existe");
      return { email: firebase.auth().currentUser?.email || "", pets: [] };
    }
    const d = snap.data() || {};
    console.debug("[perfil propietario]", d);

    const nombre   = d.nombre || d.name || "";
    const apellido = d.apellido || d.apellidos || d.surname || "";
    const fullName = d.fullName || [nombre, apellido].filter(Boolean).join(" ").trim() || (firebase.auth().currentUser?.displayName||"");
    const phone    = d.phone || d.telefono || d.tlf || "";
    const region   = d.region || d.comunidad || d.comunidadAutonoma || d.ccaa || "";
    const address  = d.address || d.direccion || "";
    const postal   = d.postalCode || d.cp || d.codigo_postal || d.codigoPostal || "";

    let pets = Array.isArray(d.pets) ? d.pets : (Array.isArray(d.mascotas) ? d.mascotas : []);
    pets = pets.map((p,i)=>({
      id: p.id || p.uid || String(i+1),
      name: p.name || p.nombre || "Mascota",
      species: (p.species || p.especie || p.tipo || "").toLowerCase(),
      birth: p.birth || p.nacimiento || p.fechaNacimiento || "",
      subtype: p.subtype || p.subtipo || "",
      img: p.img || p.foto || ""
    }));

    return { fullName, email: d.email || firebase.auth().currentUser?.email || "", phone, region, address, postalCode: postal, pets };
  }catch(e){
    console.warn("[reservas] Error getOwnerDoc:", e);
    return { email: firebase.auth().currentUser?.email || "", pets: [] };
  }
}

/*** MASCOTAS UI ***/
function parseISOdate(s){ const d=new Date(s); return isNaN(d)?null:d; }
function ageMonths(birthISO){ const d=parseISOdate(birthISO); if(!d) return null; const now=new Date(); return (now.getFullYear()-d.getFullYear())*12+(now.getMonth()-d.getMonth())-(now.getDate()<d.getDate()?1:0); }
function isPuppyPet(p){ if(!p || p.species!=="perro") return false; const m=ageMonths(p.birth); return (m!=null && m<=6); }

const ExoticSubtypeState = new Map(); // petId -> subtype

function renderPets(pets){
  const grid = $("#petsGrid");
  grid.innerHTML = "";

  (pets||[]).forEach(p=>{
    const puppy = isPuppyPet(p);
    const subtype = p.subtype || ExoticSubtypeState.get(p.id) || "";
    const needsSubtype = (p.species==="exotico" && !subtype);
    const lab = document.createElement("label");
    lab.className="pet-card";
    lab.innerHTML = `
      <input type="checkbox" class="pet-check" data-id="${p.id}">
      <img class="pet-img" src="${p.img||"/images/pet-placeholder.png"}" alt="${p.name||"Mascota"}">
      <div style="flex:1">
        <div><strong>${p.name||"Mascota"}</strong>
          ${p.species==="perro" ? '<i class="fa-solid fa-dog"></i>' : p.species==="gato" ? '<i class="fa-solid fa-cat"></i>' : '<i class="fa-solid fa-kiwi-bird"></i>'}
          ${puppy?'<span class="badge">Cachorro (≤6m)</span>':''}
        </div>
        <div class="pet-meta">${p.species==="exotico" ? `Exótico${subtype?(" · "+subtype):""}` : (p.species||"")} · Nac: ${p.birth||"—"}</div>
        ${ needsSubtype ? `
          <div class="pet-subtype">
            <label class="muted" style="display:block;margin-bottom:4px">Tipo de exótico</label>
            <select data-exotic="${p.id}" class="exotic-select" style="width:100%;padding:8px;border:1px solid #d1d5db;border-radius:8px">
              <option value="">Selecciona…</option>
              <option value="ave">Ave</option>
              <option value="reptil">Reptil</option>
              <option value="mamífero pequeño">Mamífero pequeño</option>
              <option value="otro">Otro</option>
            </select>
          </div>` : ``}
      </div>`;
    grid.appendChild(lab);
    if(subtype){ ExoticSubtypeState.set(p.id, subtype); }
  });

  grid.addEventListener("change", (ev)=>{
    if(ev.target && ev.target.matches(".exotic-select")){
      const pid = ev.target.getAttribute("data-exotic");
      ExoticSubtypeState.set(pid, ev.target.value);
      return;
    }
    doRecalc();
  }, {once:true});

  if(!(pets||[]).length){
    const p = document.createElement("p");
    p.className = "muted";
    p.textContent = "No hay mascotas en tu perfil. Añádelas en tu perfil para seleccionarlas aquí.";
    grid.appendChild(p);
  }
}

function selectedPets(allPets){
  const ids = new Set($$(".pet-check:checked").map(x=>x.getAttribute("data-id")));
  return (allPets||[]).filter(p=>{
    if(!ids.has(p.id)) return false;
    if(p.species==="exotico" && !p.subtype){
      const chosen = ExoticSubtypeState.get(p.id)||"";
      p = Object.assign(p, { subtype: chosen });
    }
    return true;
  });
}

/*** PORTADO POR URL (opción A) ***/
function readQuery(){
  const p = new URLSearchParams(location.search);
  return {
    service: p.get("service") || p.get("svc") || "",
    startDate: p.get("startDate") || p.get("date") || "",
    endDate: p.get("endDate") || "",
    start: p.get("start") || "",
    end: p.get("end") || "",
    vgDuration: p.get("vgDuration") || "",
    vgPerDay: p.get("vgPerDay") || ""
  };
}
function applyPort(q){
  if(q.service)   $("#serviceType").value = q.service;
  if(q.startDate) $("#startDate").value = q.startDate;
  if(q.endDate)   $("#endDate").value = q.endDate || q.startDate;
  if(q.start)     $("#startTime").value = q.start;
  if(q.end)       $("#endTime").value = q.end;
  if(q.vgDuration)$("#vgDuration").value = q.vgDuration;
  if(q.vgPerDay)  $("#vgPerDay").value = q.vgPerDay;
  $("#visitCatControls").style.display = ($("#serviceType").value==="visita_gato") ? "" : "none";
}

/*** CÁLCULO ***/
function labelService(s){ return ({
  guarderia_dia:"Guardería de día", alojamiento_nocturno:"Alojamiento nocturno",
  paseo:"Paseo", visita_gato:"Visita gato",
  exoticos_aves:"Visita exóticos (aves)", exoticos_reptiles:"Visita exóticos (reptiles)", exoticos_mamiferos:"Visita exóticos (mamíferos)",
  transporte:"Transporte"
})[s]||s; }

function splitGuarderia(days, puppy){
  const packC = puppy ? PUBLIC_PRICES.guarderia_dia.bonos.puppy : PUBLIC_PRICES.guarderia_dia.bonos.adult;
  const packA = puppy ? AUX_PAY.guarderia_dia.bonosPuppy       : AUX_PAY.guarderia_dia.bonosAdult;
  const priceDay = puppy ? PUBLIC_PRICES.guarderia_dia.cachorro : PUBLIC_PRICES.guarderia_dia.adulto;
  const auxDay   = puppy ? AUX_PAY.guarderia_dia.cachorro       : AUX_PAY.guarderia_dia.adulto;

  const packs = [30,20,10];
  let d = days, pub=0, aux=0, linesPub=[], linesAux=[];
  for(const p of packs){
    const cnt = Math.floor(d/p);
    if(cnt>0){
      const cTot = packC[p]*cnt;
      const aTot = (packA[p]*p)*cnt;
      linesPub.push({label:`Bono ${p} días × ${cnt}`, calc:`${(packC[p]/p).toFixed(2)} €/día`, amount:cTot});
      linesAux.push({label:`Aux bono ${p} × ${cnt}`, amount:aTot});
      pub+=cTot; aux+=aTot; d-=p*cnt;
    }
  }
  if(d>0){
    const cTot = d*priceDay, aTot = d*auxDay;
    linesPub.push({label:`Días sueltos (${d})`, calc:`${d} × ${priceDay.toFixed(2)}`, amount:cTot});
    linesAux.push({label:`Aux sueltos (${d})`, amount:aTot});
    pub+=cTot; aux+=aTot;
  }
  return {pub, aux, linesPub, linesAux};
}

function calcPricing(payload){
  const s = payload.serviceType;
  const start = payload.startDate;
  const end = payload.endDate || start;
  const days = Math.max(1, daysInclusive(start, end));
  const pets = payload.pets||[];
  const numPets = Math.max(1, pets.length||0);
  const anyPuppy = pets.some(p=>isPuppyPet(p));

  let linesPublic=[], linesAux=[], totalPublic=0, totalAux=0;

  if(s==="guarderia_dia"){
    const split = splitGuarderia(days, anyPuppy);
    linesPublic.push(...split.linesPub);
    linesAux.push(...split.linesAux);
    totalPublic += split.pub; totalAux += split.aux;
  }

  if(s==="alojamiento_nocturno"){
    for(let i=1;i<=numPets;i++){
      const isSecond = (i>=2);
      const pup = isPuppyPet(pets[i-1]);
      let pub=0, aux=0;
      for(let d=1; d<=days; d++){
        const tramo11 = (d>=11);
        let pPub=0, pAux=0;
        if(isSecond){
          pPub = tramo11?PUBLIC_PRICES.alojamiento_nocturno.segundo.desde11:PUBLIC_PRICES.alojamiento_nocturno.segundo.normal;
          pAux = tramo11?AUX_PAY.alojamiento_nocturno.segundo.desde11:AUX_PAY.alojamiento_nocturno.segundo.normal;
        }else if(pup){
          pPub = tramo11?PUBLIC_PRICES.alojamiento_nocturno.puppy.desde11:PUBLIC_PRICES.alojamiento_nocturno.puppy.normal;
          pAux = tramo11?AUX_PAY.alojamiento_nocturno.puppy.desde11:AUX_PAY.alojamiento_nocturno.puppy.normal;
        }else{
          pPub = tramo11?PUBLIC_PRICES.alojamiento_nocturno.std.desde11:PUBLIC_PRICES.alojamiento_nocturno.std.normal;
          pAux = tramo11?AUX_PAY.alojamiento_nocturno.std.desde11:AUX_PAY.alojamiento_nocturno.std.normal;
        }
        pub+=pPub; aux+=pAux;
      }
      linesPublic.push({label:`Base (Alojamiento · ${days} días · mascota ${i})`, amount:pub});
      linesAux.push({label:`Aux (Alojamiento · mascota ${i})`, amount:aux});
      totalPublic+=pub; totalAux+=aux;
    }
  }

  if(s==="paseo"){
    const walks = 1;
    linesPublic.push({label:`Base (Paseo · ${walks} uds)`, calc:`${walks} × ${PUBLIC_PRICES.paseo.base.toFixed(2)}`, amount:PUBLIC_PRICES.paseo.base*walks});
    linesAux.push({label:`Aux (Paseo)`, amount:AUX_PAY.paseo.base*walks});
    totalPublic+=PUBLIC_PRICES.paseo.base*walks; totalAux+=AUX_PAY.paseo.base*walks;
    const extra = Math.max(0, numPets-1);
    if(extra>0){
      const addC = extra*PUBLIC_PRICES.paseo.extra_mascota*walks;
      const addA = extra*AUX_PAY.paseo.extra_mascota*walks;
      linesPublic.push({label:`Mascotas adicionales (${extra})`, amount:addC});
      linesAux.push({label:`Aux extras (${extra})`, amount:addA});
      totalPublic+=addC; totalAux+=addA;
    }
  }

  if(s==="visita_gato"){
    const dur = parseInt($("#vgDuration").value||"60",10);
    const perDay = parseInt($("#vgPerDay").value||"1",10);
    for(let d=1; d<=days; d++){
      const from11 = (d>=11);
      if(dur===90){
        const p = from11?PUBLIC_PRICES.visita_gato.d11_90:PUBLIC_PRICES.visita_gato.base90;
        const a = from11?AUX_PAY.visita_gato.d11_90:AUX_PAY.visita_gato.base90;
        linesPublic.push({label:`Base (Visita gato 90’ · día ${d})`, amount:p});
        linesAux.push({label:`Aux (Visita 90’ · día ${d})`, amount:a});
        totalPublic+=p; totalAux+=a;
      }else{
        const p = from11?PUBLIC_PRICES.visita_gato.d11_60:PUBLIC_PRICES.visita_gato.base60;
        const a = from11?AUX_PAY.visita_gato.d11_60:AUX_PAY.visita_gato.base60;
        linesPublic.push({label:`Base (Visita gato 60’ · día ${d})`, amount:p});
        linesAux.push({label:`Aux (Visita 60’ · día ${d})`, amount:a});
        totalPublic+=p; totalAux+=a;
      }
      if(perDay===2){
        const p2 = from11?PUBLIC_PRICES.visita_gato.med15_d11:PUBLIC_PRICES.visita_gato.med15;
        const a2 = p2; // margen 0
        linesPublic.push({label:`2ª visita (15’) · día ${d}`, amount:p2});
        linesAux.push({label:`Aux 2ª (15’) · día ${d}`, amount:a2});
        totalPublic+=p2; totalAux+=a2;
      }
      const cats = pets.filter(p=>p.species==="gato").length || 1;
      const extraCats = Math.max(0,cats-1);
      if(extraCats>0){
        let perClient, perAux;
        if(extraCats===1){ perClient=PUBLIC_PRICES.visita_gato.gatosExtra.one; perAux=AUX_PAY.visita_gato.gatosExtra.one; }
        else if(extraCats===2){ perClient=PUBLIC_PRICES.visita_gato.gatosExtra.twoEach; perAux=AUX_PAY.visita_gato.gatosExtra.twoEach; }
        else { perClient=PUBLIC_PRICES.visita_gato.gatosExtra.moreEach; perAux=AUX_PAY.visita_gato.gatosExtra.moreEach; }
        const addC = perClient*extraCats;
        const addA = perAux*extraCats;
        linesPublic.push({label:`Gatos extra (${extraCats}) · día ${d}`, amount:addC});
        linesAux.push({label:`Aux gatos extra · día ${d}`, amount:addA});
        totalPublic+=addC; totalAux+=addA;
      }
    }
  }

  if(s==="exoticos_aves"||s==="exoticos_reptiles"||s==="exoticos_mamiferos"||s==="transporte"){
    const baseC = PUBLIC_PRICES[s].base, baseA = AUX_PAY[s].base;
    linesPublic.push({label:`Base (${labelService(s)})`, amount:baseC});
    linesAux.push({label:`Aux (${labelService(s)})`, amount:baseA});
    totalPublic+=baseC; totalAux+=baseA;
  }

  // Suplementos globales
  const key = monthDayKey(start);
  if(BIG_DAYS.includes(key)){
    linesPublic.push({label:`Día señalado (${key})`, amount:BIG_DAY_PLUS});
    linesAux.push({label:`Aux día señalado`, amount:BIG_DAY_AUX});
    totalPublic+=BIG_DAY_PLUS; totalAux+=BIG_DAY_AUX;
  }else if(payload.festive===true){
    linesPublic.push({label:`Festivo`, amount:FESTIVO_NORMAL_PLUS});
    linesAux.push({label:`Aux festivo`, amount:FESTIVO_NORMAL_AUX});
    totalPublic+=FESTIVO_NORMAL_PLUS; totalAux+=FESTIVO_NORMAL_AUX;
  }

  if(start===todayISO() && payload.startTime){
    const [hh,mm] = payload.startTime.split(":").map(Number);
    const startDate = new Date(); startDate.setHours(hh||0,mm||0,0,0);
    const mins = diffMinutes(startDate, new Date());
    if(mins>0 && mins<120){
      linesPublic.push({label:`Suplemento urgencia (<2h)`, amount:URGENCIA_PLUS});
      totalPublic+=URGENCIA_PLUS;
    }
  }

  if(payload.travelNeeded==="si"){
    linesPublic.push({label:`Desplazamiento`, note:"pendiente"});
  }

  const payNow = Math.max(0, totalPublic - totalAux);
  const payLater = Math.max(0, totalPublic - payNow);

  return {linesPublic,totalPublic,totalAux,payNow,payLater, days};
}

function renderSummary(calc, payload){
  const ctx = `${labelService(payload.serviceType)||"—"} · ${payload.startDate||"—"}${payload.endDate?("–"+payload.endDate):""} · ${payload.pets?.length||0} mascota(s)`;
  $("#summaryContext").textContent = ctx;
  const box = $("#summaryLines"); box.innerHTML="";
  (calc.linesPublic||[]).forEach(l=>{
    const row=document.createElement("div");
    row.className="line";
    const right = (l.note==="pendiente")?'<span class="muted">pendiente</span>':fmt(l.amount);
    row.innerHTML = `<span>${l.label}${l.calc?` <span class="muted">· ${l.calc}</span>`:""}</span><span>${right}</span>`;
    box.appendChild(row);
  });
  $("#subtotalTxt").textContent = fmt(calc.totalPublic);
  $("#payNowTxt").textContent = fmt(calc.payNow);
  $("#payLaterTxt").textContent = fmt(calc.payLater);
}

/*** EMAILS ***/
async function sendEmails(reservation){
  if(!window.emailjs || !EMAILJS || !EMAILJS.enabled) return;
  const v = {
    to_email: reservation.owner.email,
    firstName: reservation.owner.fullName,
    service: labelService(reservation.service.type),
    startDate: reservation.dates.startDate,
    endDate: reservation.dates.endDate || reservation.dates.startDate,
    Hora_inicio: reservation.dates.startTime||"",
    Hora_fin: reservation.dates.endTime||"",
    region: reservation.region||"",
    address: reservation.owner.address||"",
    postalCode: reservation.owner.postalCode||"",
    observations: reservation.notes||"",
    summaryField: (reservation.pricing.breakdownPublic||[]).map(l=>`${l.label}${l.amount?`: ${l.amount.toFixed(2)}€`:""}`).join(" · "),
    total_cliente: reservation.pricing.totalClient,
    pagar_ahora: reservation.pricing.payNow,
    pendiente: reservation.pricing.payLater,
    total_txt: fmt(reservation.pricing.totalClient),
    pay_now_txt: fmt(reservation.pricing.payNow),
    pay_later_txt: fmt(reservation.pricing.payLater),
    reserva_id: reservation.id,
    _estado: reservation._estado,
    _uid: reservation._uid,
    _email: reservation.owner.email,
    admin_email: EMAILJS.admin_email || "gestion@thepetslovers.es"
  };
  await emailjs.send(EMAILJS.service_id, EMAILJS.template_id, v);                         // cliente
  await emailjs.send(EMAILJS.service_id, EMAILJS.template_id, {...v, to_email: EMAILJS.admin_email}); // gestión
}

/*** FIRESTORE ***/
async function saveReservation(res){
  try{
    const db = firebase.firestore();
    const ref = await db.collection("reservas").add(res);
    return ref.id;
  }catch(e){
    console.error("Error guardando reserva:", e);
    return null;
  }
}

/*** FORM STATE ***/
function collectPayload(allPets){
  const petsSel = selectedPets(allPets);
  return {
    serviceType: $("#serviceType").value,
    startDate: $("#startDate").value,
    endDate: $("#endDate").value || $("#startDate").value,
    startTime: $("#startTime").value,
    endTime: $("#endTime").value,
    region: $("#region").value,
    address: $("#address").value,
    postalCode: $("#postalCode").value,
    notes: $("#notes").value,
    travelNeeded: $("#travelNeeded").value,
    pets: petsSel,
    festive: false
  };
}

function buildReservation(user, ownerDoc, calc, payload){
  return {
    _estado: "paid_review",
    _uid: user.uid,
    _email: user.email || (ownerDoc?.email)||"",
    _createdAt: new Date().toISOString(),
    id: "resv_"+Date.now(),

    service: { type: payload.serviceType },
    dates: { startDate: payload.startDate, endDate: payload.endDate, startTime: payload.startTime||null, endTime: payload.endTime||null },
    region: payload.region,

    owner: {
      fullName: $("#ownerFullName").value.trim(),
      email: $("#email").value.trim(),
      phone: $("#phone").value.trim(),
      address: $("#address").value.trim(),
      postalCode: $("#postalCode").value.trim(),
      emergencyName: $("#emergencyName")?.value.trim()||"",
      emergencyPhone: $("#emergencyPhone")?.value.trim()||"",
      contactPref: $("#contactPref")?.value||"",
      contactTime: $("#contactTime")?.value||""
    },

    pets: payload.pets,
    notes: payload.notes,

    flags: {
      urgency: (calc.linesPublic||[]).some(l=>/urgencia/i.test(l.label)),
      bigDay: BIG_DAYS.includes(monthDayKey(payload.startDate)),
      festive: payload.festive===true,
      travelNeeded: payload.travelNeeded==="si"
    },

    pricing: {
      breakdownPublic: calc.linesPublic,
      totalClient: +calc.totalPublic.toFixed(2),
      payNow: +calc.payNow.toFixed(2),
      payLater: +calc.payLater.toFixed(2),
      currency:"EUR"
    },

    internal: {
      totalAux: +calc.totalAux.toFixed(2),
      margin: +(calc.totalPublic - calc.totalAux).toFixed(2)
    }
  };
}

/*** BIND + RECALC ***/
function bindRecalc(allPets){
  ["serviceType","startDate","endDate","startTime","endTime","region","notes","address","postalCode","travelNeeded","vgDuration","vgPerDay"].forEach(id=>{
    const el = document.getElementById(id); if(el) el.addEventListener("input", doRecalc);
  });
  $("#petsGrid").addEventListener("change", doRecalc);
  $("#serviceType").addEventListener("change", ()=>{
    $("#visitCatControls").style.display = ($("#serviceType").value==="visita_gato") ? "" : "none";
    doRecalc();
  });
}

function doRecalc(){
  const state = window.__STATE__ || {};
  const payload = collectPayload(state.pets||[]);
  if(!payload.serviceType || !payload.startDate){
    renderSummary({linesPublic:[],totalPublic:0,totalAux:0,payNow:0,payLater:0}, payload);
    return;
  }
  const calc = calcPricing(payload);
  renderSummary(calc, payload);
  window.__LAST_CALC__ = {payload, calc};
}

/*** AUTORRELLENO INPUTS ***/
function fillOwner(o){
  if(!o) return;
  const set = (id,val)=>{ const el=$( "#"+id ); if(el && val) el.value = val; };
  set("ownerFullName", o.fullName);
  set("email", o.email);
  set("phone", o.phone);
  set("region", o.region);
  set("address", o.address);
  set("postalCode", o.postalCode);
}

/*** INIT ***/
window.addEventListener("load", initReserva);

async function initReserva(){
  // Defensa /reservas -> /reservas.html
  try{
    if(location.pathname.replace(/\/+$/,'')==="/reservas"){
      location.replace("/reservas.html"+location.search+location.hash);
      return;
    }
  }catch(_){}

  const user = await awaitAuthUser();
  console.debug("[auth] currentUser:", user);
  if(!user){
    $("#sessionGate").style.display="block";
    $("#reservaForm").classList.add("disabled");
    return;
  }

  $("#sessionGate").style.display="none";
  $("#reservaForm").classList.remove("disabled");

  const owner = await getOwnerDoc(user.uid);
  window.__STATE__ = { owner: owner||{}, pets: (owner?.pets)||[] };

  renderPets(window.__STATE__.pets);
  fillOwner(owner || { email: user?.email || "" });

  applyPort(readQuery());

  $("#visitCatControls").style.display = ($("#serviceType").value==="visita_gato") ? "" : "none";

  bindRecalc(window.__STATE__.pets);
  doRecalc();

  $("#btnReserve").addEventListener("click", async ()=>{
    const payload = collectPayload(window.__STATE__.pets);

    // Validaciones mínimas
    if(!payload.serviceType){ alert("Selecciona el servicio."); return; }
    if(!payload.startDate){ alert("Selecciona fecha de inicio."); return; }
    if(!payload.endDate){ alert("Selecciona fecha de fin."); return; }
    if(daysInclusive(payload.startDate, payload.endDate) <= 0){ alert("Rango de fechas no válido."); return; }
    if($("#ownerFullName").value.trim().length<3){ alert("Indica tu nombre y apellido."); return; }
    if(selectedPets(window.__STATE__.pets).length===0){ alert("Elige al menos una mascota."); return; }

    const calc = calcPricing(payload);
    const reservation = buildReservation(user, owner, calc, payload);

    const newId = await saveReservation(reservation);
    if(newId){ reservation._docId = newId; }

    await sendEmails(reservation);

    $("#reservaForm").style.display="none";
    $("#thanks").style.display="block";
    // redirección suave
    setTimeout(()=>location.href="/perfil.html", 2500);
  });
}
