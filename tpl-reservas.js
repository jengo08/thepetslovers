/*!
 * TPL · reservas (completo)
 * - Login gate + autorrelleno dueño desde propietarios/{uid}
 * - Mascotas desde perfil (pets|mascotas), tarjetas con badges y subtipo exóticos inline
 * - Precarga desde servicios (?service=&startDate=&endDate=&start=&end=&pets=&region=&notes=)
 * - Cálculo: bonos, desde día 11, urgencia <2h, festivos y señalados, 2ª visita 15' en gatos
 * - A pagar ahora = Subtotal – (coste auxiliar + festivo_aux)
 * - Guarda en Firestore (reservas) y envía EmailJS (un template para cliente y gestión)
 */

/*** CONFIG EMAILJS ***/
window.EMAILJS = window.EMAILJS || {
  enabled: true,
  service_id: "service_odjqrfl",
  template_id: "template_rao5n0c",
  public_key: "L2xAATfVuHJwj4EIV",
  admin_email: "gestion@thepetslovers.es"
};
try { if(window.EMAILJS.enabled && window.emailjs){ emailjs.init(window.EMAILJS.public_key); } } catch(e){}

/*** HELPERS UI ***/
const $ = (s,root=document)=>root.querySelector(s);
const $$ = (s,root=document)=>Array.from(root.querySelectorAll(s));
const fmt = n => (typeof n!=="number"||isNaN(n))?"—":n.toFixed(2).replace(".",",")+" €";

const todayISO = ()=>new Date().toISOString().slice(0,10);
const parseISO = s => { const d=new Date(s); return isNaN(d)?null:d; };

function daysInclusive(startISO, endISO){
  const a = parseISO(startISO), b = parseISO(endISO || startISO);
  if(!a || !b) return 0;
  const ms = (Date.UTC(b.getFullYear(),b.getMonth(),b.getDate()) - Date.UTC(a.getFullYear(),a.getMonth(),a.getDate()));
  return Math.floor(ms/86400000)+1; // inclusivo
}
function monthDayKey(dateISO){
  const d = parseISO(dateISO); if(!d) return "";
  const m=String(d.getMonth()+1).padStart(2,"0"), dd=String(d.getDate()).padStart(2,"0");
  return `${m}-${dd}`;
}
function diffMinutes(a,b){ return Math.round((a-b)/60000); }

/*** TABLAS DE PRECIOS ***/
const BIG_DAYS = ["12-24","12-25","12-31","01-01"];
const FESTIVO_NORMAL_PLUS = 10; // cliente
const FESTIVO_NORMAL_AUX = 8;
const BIG_DAY_PLUS = 30;        // cliente
const BIG_DAY_AUX = 15;
const URGENCIA_PLUS = 10;       // cliente (tu margen)

// Cliente
const PUBLIC_PRICES = {
  guarderia_dia: {
    adulto: 15, cachorro: 20,
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
  transporte: { base: 20 }
};

// Auxiliar (interno)
const AUX_PAY = {
  guarderia_dia: { adulto: 12, cachorro: 17, bonosAdult:{10:11,20:10,30:9}, bonosPuppy:{10:16,20:14,30:12} },
  alojamiento_nocturno: {
    std:{ normal:25, desde11:22 }, puppy:{ normal:30, desde11:27 }, segundo:{ normal:20, desde11:17 }
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

/*** PERFIL / LOGIN ***/
function isLogged(){ try{ return !!firebase.auth().currentUser; }catch(_){ return false; } }

/* Intenta leer propietarios/{uid} y normaliza nombres de campos frecuentes */
async function getOwnerDoc(){
  const u = firebase.auth().currentUser;
  if(!u) return null;
  try{
    const snap = await firebase.firestore().collection("propietarios").doc(u.uid).get();
    if(!snap.exists){
      console.warn("[reservas] No existe propietarios/{uid}. ¿Creaste el perfil?");
      return { email: u.email || "", pets: [] };
    }
    const data = snap.data() || {};

    // Nombre completo: fullName o nombre+apellidos o displayName
    const fullName = data.fullName
      || [data.nombre, data.apellidos].filter(Boolean).join(" ").trim()
      || (u.displayName || "")
      || [data.name, data.surname].filter(Boolean).join(" ").trim();

    const owner = {
      fullName: fullName || "",
      email: data.email || u.email || "",
      phone: data.phone || data.telefono || "",
      address: data.address || data.direccion || "",
      postalCode: data.postalCode || data.cp || data.codigoPostal || "",
      region: data.region || data.comunidad || ""
    };

    // Mascotas: 'pets' o 'mascotas'
    let pets = Array.isArray(data.pets) ? data.pets : (Array.isArray(data.mascotas) ? data.mascotas : []);
    pets = pets.map((p,i)=>({
      id: p.id || p.uid || String(i+1),
      name: p.name || p.nombre || "Mascota",
      species: (p.species || p.especie || p.tipo || "").toLowerCase(), // perro|gato|exotico
      birth: p.birth || p.nacimiento || p.fechaNacimiento || "",
      subtype: p.subtype || p.subtipo || "", // ave|reptil|mamifero|otro
      img: p.img || p.foto || ""
    }));

    console.log("[reservas] ownerDoc:", owner);
    console.log("[reservas] pets:", pets);

    return { ...owner, pets };
  }catch(e){
    console.warn("[reservas] Error leyendo propietario:", e);
    return { email: u.email || "", pets: [] };
  }
}

/*** MASCOTAS ***/
function parseISOdate(s){ const d=new Date(s); return isNaN(d)?null:d; }
function ageMonths(birthISO){
  const d = parseISOdate(birthISO); if(!d) return null;
  const now = new Date();
  return (now.getFullYear()-d.getFullYear())*12 + (now.getMonth()-d.getMonth()) - (now.getDate()<d.getDate()?1:0);
}
function isPuppyPet(p){
  if(!p || p.species!=="perro") return false;
  const m = ageMonths(p.birth);
  return m!=null && m<=6;
}

/* Subtipos temporales de exóticos elegidos en UI (si faltan en perfil) */
const ExoticSubtypeState = new Map(); // petId -> subtype

function renderPets(pets){
  const grid = $("#petsGrid");
  grid.innerHTML = "";
  const filter = ($("#petsFilter")?.value || "").toLowerCase();
  const maxSel = parseInt($("#petsCount").value || "1", 10);

  (pets||[])
    .filter(p=>!filter || p.species===filter)
    .forEach(p=>{
      const puppy = isPuppyPet(p);
      const currentSubtype = p.subtype || ExoticSubtypeState.get(p.id) || "";
      const needsSubtype = (p.species==="exotico" && !currentSubtype);

      const lab = document.createElement("label");
      lab.className = "pet-card";
      lab.innerHTML = `
        <input type="checkbox" class="pet-check" data-id="${p.id}">
        <img class="pet-img" src="${p.img||"/images/pet-placeholder.png"}" alt="${p.name||"Mascota"}">
        <div style="flex:1">
          <div><strong>${p.name||"Mascota"}</strong>
            ${p.species==="perro" ? '<i class="fa-solid fa-dog"></i>' :
              p.species==="gato" ? '<i class="fa-solid fa-cat"></i>' :
              '<i class="fa-solid fa-kiwi-bird"></i>'}
            ${puppy ? '<span class="badge">Cachorro (≤6m)</span>' : ''}
          </div>
          <div class="pet-meta">${
            p.species==="exotico"
              ? `Exótico ${currentSubtype?("· "+currentSubtype):""}`
              : (p.species||"")
          } · Nac: ${p.birth||"—"}</div>

          ${
            needsSubtype
              ? `
              <div class="pet-subtype">
                <label class="muted" style="display:block;margin-bottom:4px">Tipo de exótico</label>
                <select data-exotic="${p.id}" class="exotic-select" style="width:100%;padding:8px;border:1px solid #d1d5db;border-radius:8px">
                  <option value="">Selecciona…</option>
                  <option value="ave">Ave</option>
                  <option value="reptil">Reptil</option>
                  <option value="mamífero pequeño">Mamífero pequeño</option>
                  <option value="otro">Otro</option>
                </select>
              </div>`
              : ""
          }
        </div>`;

      grid.appendChild(lab);
      if(currentSubtype){
        ExoticSubtypeState.set(p.id, currentSubtype);
      }
    });

  // Limita selección al máximo indicado
  grid.addEventListener("change", (ev)=>{
    if(ev.target && ev.target.matches(".exotic-select")){
      const pid = ev.target.getAttribute("data-exotic");
      ExoticSubtypeState.set(pid, ev.target.value);
      return;
    }
    const checks = $$(".pet-check", grid);
    const sel = checks.filter(x=>x.checked);
    if(sel.length>maxSel){
      sel.pop().checked = false;
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
    // Si es exotico y no trae subtipo, toma el elegido en UI
    if(p.species==="exotico" && !p.subtype){
      const chosen = ExoticSubtypeState.get(p.id) || "";
      p = Object.assign(p, { subtype: chosen });
    }
    return true;
  });
}

/*** PORTADO DESDE SERVICIOS ***/
function readQuery(){
  const p = new URLSearchParams(location.search);
  return {
    service: p.get("service") || p.get("svc") || "",
    date: p.get("date") || "",
    start: p.get("start") || "",
    end: p.get("end") || "",
    startDate: p.get("startDate") || "",
    endDate: p.get("endDate") || "",
    pets: (p.get("pets")||"").split(",").filter(Boolean),
    region: p.get("region") || "",
    notes: p.get("notes") || ""
  };
}

function applyPort(q, pets){
  if(q.service) $("#serviceType").value = q.service;
  if(q.startDate) $("#startDate").value = q.startDate;
  if(q.endDate) $("#endDate").value = q.endDate;
  if(q.date && !q.startDate){ $("#startDate").value=q.date; }
  if(q.date && !q.endDate){ $("#endDate").value=q.date; }
  if(q.start) $("#startTime").value = q.start;
  if(q.end) $("#endTime").value = q.end;
  if(q.region) $("#region").value = q.region;
  if(q.notes) $("#notes").value = q.notes;

  if(q.pets.length && pets?.length){
    const ids = new Set(q.pets);
    $$(".pet-check").forEach(ch=>{
      if(ids.has(ch.getAttribute("data-id"))) ch.checked = true;
    });
  }
}

/*** CÁLCULO DE PRECIOS ***/
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

function calcPricing(payload){
  const s = payload.serviceType;
  const start = payload.startDate;
  const end = payload.endDate || start;
  const days = Math.max(1, daysInclusive(start, end));
  const pets = payload.pets||[];
  const numPets = Math.max(1, pets.length||0);
  const anyPuppy = pets.some(p=>isPuppyPet(p));

  let linesPublic=[], linesAux=[];
  let totalPublic=0, totalAux=0;

  // Guardería (bonos exactos 10/20/30)
  if(s==="guarderia_dia"){
    const puppy = anyPuppy;
    const bonoClient = puppy ? PUBLIC_PRICES.guarderia_dia.bonos.puppy : PUBLIC_PRICES.guarderia_dia.bonos.adult;
    const bonoAux    = puppy ? AUX_PAY.guarderia_dia.bonosPuppy     : AUX_PAY.guarderia_dia.bonosAdult;
    const priceDay   = puppy ? PUBLIC_PRICES.guarderia_dia.cachorro : PUBLIC_PRICES.guarderia_dia.adulto;
    const auxDay     = puppy ? AUX_PAY.guarderia_dia.cachorro       : AUX_PAY.guarderia_dia.adulto;

    if([10,20,30].includes(days)){
      const pTotal = bonoClient[days];
      linesPublic.push({label:`Base (Guardería · bono ${days} días)`, calc:`${(pTotal/days).toFixed(2)} €/día`, amount:pTotal});
      totalPublic += pTotal;

      const aPer = bonoAux[days], aTotal=aPer*days;
      linesAux.push({label:`Aux (bono ${days})`, amount:aTotal});
      totalAux += aTotal;
    }else{
      const pTotal = priceDay*days;
      linesPublic.push({label:`Base (Guardería · ${days} días)`, calc:`${days} × ${priceDay.toFixed(2)}`, amount:pTotal});
      totalPublic += pTotal;

      const aTotal = auxDay*days;
      linesAux.push({label:`Aux (día)`, amount:aTotal});
      totalAux += aTotal;
    }
  }

  // Alojamiento (desde día 11 y 2º perro)
  if(s==="alojamiento_nocturno"){
    const petsCount = numPets;
    for(let i=1;i<=petsCount;i++){
      const isSecondOrMore = (i>=2);
      const isPup = isPuppyPet(pets[i-1]);
      let pub=0, aux=0;
      for(let d=1; d<=days; d++){
        const tramo11 = (d>=11);
        let pPub=0, pAux=0;
        if(isSecondOrMore){
          pPub = tramo11?PUBLIC_PRICES.alojamiento_nocturno.segundo.desde11:PUBLIC_PRICES.alojamiento_nocturno.segundo.normal;
          pAux = tramo11?AUX_PAY.alojamiento_nocturno.segundo.desde11:AUX_PAY.alojamiento_nocturno.segundo.normal;
        }else if(isPup){
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

  // Paseo (60’). 1 perro base; extras +8€/paseo
  if(s==="paseo"){
    const walks = 1;
    linesPublic.push({label:`Base (Paseo · ${walks} uds)`, calc:`${walks} × ${PUBLIC_PRICES.paseo.base.toFixed(2)}`, amount:PUBLIC_PRICES.paseo.base*walks});
    linesAux.push({label:`Aux (Paseo)`, amount:AUX_PAY.paseo.base*walks});
    totalPublic+=PUBLIC_PRICES.paseo.base*walks; totalAux+=AUX_PAY.paseo.base*walks;

    const extraPets = Math.max(0, numPets-1);
    if(extraPets>0){
      const addC = extraPets*PUBLIC_PRICES.paseo.extra_mascota*walks;
      const addA = extraPets*AUX_PAY.paseo.extra_mascota*walks;
      linesPublic.push({label:`Mascotas adicionales (${extraPets})`, amount:addC});
      linesAux.push({label:`Aux extras (${extraPets})`, amount:addA});
      totalPublic+=addC; totalAux+=addA;
    }
  }

  // Visita gato (60/90) + 2ª visita 15' al día: 12€ (10€ desde día 11)
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
        const a2 = p2; // margen 0 en medicación
        linesPublic.push({label:`2ª visita (15’) · día ${d}`, amount:p2});
        linesAux.push({label:`Aux 2ª (15’) · día ${d}`, amount:a2});
        totalPublic+=p2; totalAux+=a2;
      }

      // gatos extra por día
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

  // Exóticos / Transporte
  if(s==="exoticos_aves"||s==="exoticos_reptiles"||s==="exoticos_mamiferos"||s==="transporte"){
    const baseC = PUBLIC_PRICES[s].base;
    const baseA = AUX_PAY[s].base;
    linesPublic.push({label:`Base (${labelService(s)})`, amount:baseC});
    linesAux.push({label:`Aux (${labelService(s)})`, amount:baseA});
    totalPublic+=baseC; totalAux+=baseA;
  }

  // SUPLEMENTOS (festivo/señalado)
  const key = monthDayKey(start);
  if(BIG_DAYS.includes(key)){
    linesPublic.push({label:`Día señalado (${key})`, amount:BIG_DAY_PLUS});
    totalPublic+=BIG_DAY_PLUS;
    linesAux.push({label:`Aux día señalado`, amount:BIG_DAY_AUX});
    totalAux+=BIG_DAY_AUX;
  }else if(payload.festive===true){
    linesPublic.push({label:`Festivo`, amount:FESTIVO_NORMAL_PLUS});
    totalPublic+=FESTIVO_NORMAL_PLUS;
    linesAux.push({label:`Aux festivo`, amount:FESTIVO_NORMAL_AUX});
    totalAux+=FESTIVO_NORMAL_AUX;
  }

  // Urgencia <2h si es hoy y hay hora inicio
  if(start===todayISO() && payload.startTime){
    const [hh,mm] = payload.startTime.split(":").map(Number);
    const startDate = new Date(); startDate.setHours(hh||0,mm||0,0,0);
    const mins = diffMinutes(startDate, new Date());
    if(mins>0 && mins<120){
      linesPublic.push({label:`Suplemento urgencia (<2h)`, amount:URGENCIA_PLUS});
      totalPublic+=URGENCIA_PLUS; // auxiliar no sube: margen puro
    }
  }

  // Desplazamiento: solo nota
  if(payload.travelNeeded==="si"){
    linesPublic.push({label:`Desplazamiento`, note:"pendiente"});
  }

  // A pagar ahora = Subtotal – (Coste auxiliar + festivo_aux)
  const payNow = Math.max(0, totalPublic - totalAux);
  const payLater = Math.max(0, totalPublic - payNow);

  return {linesPublic,totalPublic,totalAux,payNow,payLater, days};
}

function renderSummary(calc, payload){
  const ctx = `${labelService(payload.serviceType)||"—"} · ${payload.startDate||"—"}${payload.endDate?("–"+payload.endDate):""} · ${payload.pets?.length||0} mascota(s)`;
  $("#summaryContext").textContent = ctx;

  const box = $("#summaryLines"); box.innerHTML="";
  (calc.linesPublic||[]).forEach(l=>{
    const row = document.createElement("div");
    row.className="line";
    const right = (l.note==="pendiente") ? '<span class="muted">pendiente</span>' : fmt(l.amount);
    row.innerHTML = `<span>${l.label}${l.calc?` <span class="muted">· ${l.calc}</span>`:""}</span><span>${right}</span>`;
    box.appendChild(row);
  });

  $("#subtotalTxt").textContent = fmt(calc.totalPublic);
  $("#payNowTxt").textContent = fmt(calc.payNow);
  $("#payLaterTxt").textContent = fmt(calc.payLater);
}

/*** EMAILS (un template para cliente y gestión) ***/
async function sendEmails(reservation){
  if(!window.emailjs || !EMAILJS || !EMAILJS.enabled) return;

  const vars = {
    to_email: reservation.owner.email,

    firstName: reservation.owner.fullName,
    service: labelService(reservation.service.type),
    startDate: reservation.dates.startDate,
    endDate: reservation.dates.endDate || reservation.dates.startDate,
    Hora_inicio: reservation.dates.startTime || "",
    Hora_fin: reservation.dates.endTime || "",
    region: reservation.region || "",
    address: reservation.owner.address || "",
    postalCode: reservation.owner.postalCode || "",
    observations: reservation.notes || "",
    summaryField: (reservation.pricing.breakdownPublic||[])
      .map(l=>`${l.label}${l.amount?`: ${l.amount.toFixed(2)}€`:""}`).join(" · "),

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

  await emailjs.send(EMAILJS.service_id, EMAILJS.template_id, vars);                         // Cliente
  await emailjs.send(EMAILJS.service_id, EMAILJS.template_id, {...vars, to_email: EMAILJS.admin_email}); // Gestión
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

/*** FORM PAYLOAD ***/
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
    festive: false // hook futuro por CA
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
  ["serviceType","startDate","endDate","startTime","endTime","region","notes","address","postalCode","travelNeeded","vgDuration","vgPerDay","petsCount","petsFilter"].forEach(id=>{
    const el = document.getElementById(id);
    if(el) el.addEventListener("input", doRecalc);
  });
  $("#petsGrid").addEventListener("change", doRecalc);
  $("#serviceType").addEventListener("change", ()=>{
    const v = $("#serviceType").value;
    $("#visitCatControls").style.display = (v==="visita_gato") ? "" : "none";
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

/*** INIT ***/
window.addEventListener("load", async ()=>{

  // 1) Defensa por si entran en /reservas sin .html
  try{
    var p = location.pathname.replace(/\/+$/,'');
    if(p==="/reservas"){ location.replace("/reservas.html"+location.search+location.hash); return; }
  }catch(_){}

  // 2) Espera Auth
  let user = null;
  await new Promise(res=>{
    try{ firebase.auth().onAuthStateChanged(u=>{ user=u||null; res(); }); }
    catch(_){ res(); }
  });

  if(!user){
    $("#sessionGate").style.display="block";
    $("#reservaForm").classList.add("disabled");
    return;
  }

  $("#sessionGate").style.display="none";
  $("#reservaForm").classList.remove("disabled");

  // 3) Recolocar “¿Necesitas desplazamiento?” debajo de emergencia
  try{
    const travelDiv = $("#travelNeeded")?.closest("div");
    const emPhoneDiv = $("#emergencyPhone")?.closest("div");
    if(travelDiv && emPhoneDiv){ emPhoneDiv.after(travelDiv); }
  }catch(_){}

  // 4) Perfil + mascotas
  const ownerDoc = await getOwnerDoc();
  window.__STATE__ = { owner: ownerDoc||{}, pets: (ownerDoc?.pets)||[] };

  // 5) Render mascotas + filtros
  renderPets(window.__STATE__.pets);
  $("#petsFilter")?.addEventListener("input", ()=>renderPets(window.__STATE__.pets));
  $("#petsCount")?.addEventListener("input", ()=>renderPets(window.__STATE__.pets));

  // 6) Autorrelleno (nombre, tel, dirección, CA, CP)
  fillOwner(ownerDoc || { email: user?.email || "" });

  // 7) Precarga si vienes de servicios
  applyPort(readQuery(), window.__STATE__.pets);

  // 8) Mostrar controles visita gato si procede
  $("#visitCatControls").style.display = ($("#serviceType").value==="visita_gato") ? "" : "none";

  // 9) Bind + recálculo
  bindRecalc(window.__STATE__.pets);
  doRecalc();

  // 10) CTA Reservar
  $("#btnReserve").addEventListener("click", async ()=>{
    const payload = collectPayload(window.__STATE__.pets);

    // Validaciones mínimas
    if(!payload.serviceType){ alert("Selecciona el servicio."); return; }
    if(!payload.startDate){ alert("Selecciona fecha de inicio."); return; }
    if(!payload.endDate){ alert("Selecciona fecha de fin."); return; }
    if(daysInclusive(payload.startDate, payload.endDate) <= 0){ alert("Rango de fechas no válido."); return; }
    if($("#ownerFullName").value.trim().length<3){ alert("Indica tu nombre y apellidos."); return; }
    if(selectedPets(window.__STATE__.pets).length===0){ alert("Elige al menos una mascota."); return; }

    const calc = calcPricing(payload);
    const reservation = buildReservation(user, ownerDoc, calc, payload);

    const newId = await saveReservation(reservation);
    if(newId){ reservation._docId = newId; }

    await sendEmails(reservation);

    $("#reservaForm").style.display="none";
    $("#thanks").style.display="block";
  });
});

/*** AUTORRELLENO TITULAR ***/
function fillOwner(owner){
  if(!owner) return;
  if(owner.fullName) $("#ownerFullName").value = owner.fullName;
  if(owner.email) $("#email").value = owner.email;
  if(owner.phone) $("#phone").value = owner.phone;
  if(owner.address) $("#address").value = owner.address;
  if(owner.postalCode) $("#postalCode").value = owner.postalCode;
  if(owner.region) $("#region").value = owner.region;
}
