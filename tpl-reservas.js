/****************************************************
 * TPL · RESERVAS (COMPLETO · actualizado)
 * - Mantiene IDs y comportamiento
 * - Autorelleno titular + mascotas (Firestore)
 * - Tarjetas mascota horizontales (mini avatar redondo)
 * - Servicio Exóticos con selector de tipo
 * - Cálculo por días + bonos + tramos día 11 + extra mascotas
 * - "A pagar ahora" = margen real (cliente − auxiliar) por día
 * - Modal de confirmación + redirección a perfil
 * - EmailJS opcional (respetando tu config)
 ****************************************************/

/************** Helpers **************/
const $  = (s,root=document)=>root.querySelector(s);
const $$ = (s,root=document)=>Array.from(root.querySelectorAll(s));
const fmtMoney = n => (typeof n!=="number"||isNaN(n))?"—":n.toFixed(2).replace(".",",")+" €";
const parseDate = v => { const d=new Date(v); return isNaN(d)?null:d; };
const nowISO    = ()=> new Date().toISOString();

function daysInclusive(a,b){
  const A=parseDate(a), B=parseDate(b||a);
  if(!A||!B) return 0;
  const diff = Math.round((B-A)/86400000);
  return diff>=0 ? diff+1 : 0;
}
function eachDayISO(a,b){
  const A=parseDate(a), B=parseDate(b||a);
  if(!A||!B) return [];
  const out=[]; const d=new Date(A);
  while(d<=B){ out.push(d.toISOString().slice(0,10)); d.setDate(d.getDate()+1); }
  return out;
}
function fmtMD(dateStr){
  const d=parseDate(dateStr); if(!d) return "";
  const m=String(d.getMonth()+1).padStart(2,"0"), dd=String(d.getDate()).padStart(2,"0");
  return `${m}-${dd}`;
}
function cap(s){ s=String(s||''); return s? s.charAt(0).toUpperCase()+s.slice(1) : s; }
function monthsBetween(birth){
  if(!birth) return null;
  const d=new Date(birth); if(isNaN(d)) return null;
  const t=new Date();
  return (t.getFullYear()-d.getFullYear())*12+(t.getMonth()-d.getMonth())-(t.getDate()<d.getDate()?1:0);
}
function isPuppy(p){ // cachorro ≤ 6 meses
  const m=monthsBetween(p.nacimiento); return (p.especie==="perro" && m!=null && m<=6);
}

/************** Etiquetas **************/
function labelService(s){
  return ({
    guarderia_dia:"Guardería de día",
    alojamiento_nocturno:"Alojamiento nocturno",
    paseo:"Paseo",
    visita_gato:"Visita gato",
    exoticos:"Servicio de exóticos",
    transporte:"Transporte"
  })[s]||s;
}
function labelExotic(t){
  return ({ aves:"Aves", reptiles:"Reptiles", mamiferos:"Pequeños mamíferos" })[t]||"";
}

/************** Festivos **************/
const BIG_DAYS = ["12-24","12-25","12-31","01-01"]; // MM-DD
function isBigDay(iso){ const md = fmtMD(iso); return BIG_DAYS.includes(md); }
// Pendiente: festivos autonómicos (si quieres, aquí se puede cargar un map por CCAA)

/************** Tarifas públicas y auxiliar **************/
const PRICES_PUBLIC = {
  guarderia: { adult:15, puppy:20, second:12, thirdPlus:8,
    bonos:{ adult:{10:135,20:250,30:315}, puppy:{10:185,20:350,30:465} }
  },
  alojamiento: { std:{d1_10:30, d11:28}, puppy:{d1_10:35, d11:32}, second:{d1_10:25, d11:22}, second_puppy:{d1_10:30, d11:28} },
  paseo: { base:12, extra:8, bonos:{10:115,15:168,20:220,25:270,30:318} }, // bonos aplican cuando hay 1 mascota
  visita: { base60:{d1_10:22,d11:18}, base90:{d1_10:30,d11:27}, med15:{d1_10:12,d11:10},
            extraCats:{ one:12, twoEach:8, threePlusEach:6 } },
  exoticos:{ aves:{d1_10:20,d11:18}, reptiles:{d1_10:20,d11:18}, mamiferos:{d1_10:25,d11:22},
             secondMam:{d1_10:20,d11:18} },
  transporte:{ base:20 },
  supplements:{ urgencia:10, festivo:10, señalado:30 }
};

const PRICES_AUX = {
  guarderia: { adult:12, puppy:17, second:10, thirdPlus:6,
    bonosPerDay:{ adult:{10:11,20:10,30:9}, puppy:{10:16,20:14,30:12} }
  },
  alojamiento: { std:{d1_10:25,d11:22}, puppy:{d1_10:30,d11:27}, second:{d1_10:20,d11:17}, second_puppy:{d1_10:30,d11:28} },
  paseo: { base:10, extra:5, bonosPerWalk:{10:8,15:7.5,20:7,25:6.5,30:6} },
  visita: { base60:{d1_10:17,d11:12}, base90:{d1_10:25,d11:21}, med15:{d1_10:12,d11:10}, // med15 margen 0
            extraCats:{ one:10, twoEach:6, threePlusEach:4 } },
  exoticos:{ aves:{d1_10:15,d11:12}, reptiles:{d1_10:15,d11:12}, mamiferos:{d1_10:18,d11:18}, secondMam:{d1_10:14,d11:14} },
  transporte:{ base:15 },
  supplements:{ festivo:8, señalado:15 } // urgencia: íntegro margen
};

/************** Preselección de servicio **************/
function canonicalizeService(raw){
  if(!raw) return "";
  const s = String(raw).toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'');
  const map = {
    'paseo':'paseo','paseos':'paseo',
    'guarderia':'guarderia_dia','guarderia-de-dia':'guarderia_dia','guarderia_dia':'guarderia_dia',
    'alojamiento':'alojamiento_nocturno','estancias':'alojamiento_nocturno','nocturnas':'alojamiento_nocturno','estancias-nocturnas':'alojamiento_nocturno',
    'visitas':'visita_gato','visita-gato':'visita_gato','visita gato':'visita_gato',
    'exoticos':'exoticos','exotico':'exoticos',
    'transporte':'transporte'
  };
  const allowed = new Set(['paseo','guarderia_dia','alojamiento_nocturno','visita_gato','exoticos','transporte']);
  if(allowed.has(s)) return s;
  return map[s] || "";
}
function inferServiceFromReferrer(){
  try{
    const r = document.referrer ? new URL(document.referrer) : null;
    if(!r) return "";
    const p = (r.pathname || "").toLowerCase();
    if(/paseo|paseos/.test(p)) return 'paseo';
    if(/guarderia/.test(p)) return 'guarderia_dia';
    if(/estancia|estancias|alojamiento|noche|nocturn/.test(p)) return 'alojamiento_nocturno';
    if(/visita/.test(p) && /gato/.test(p)) return 'visita_gato';
    if(/exotico|exoticos/.test(p)) return 'exoticos';
    if(/transporte/.test(p)) return 'transporte';
  }catch(_){}
  return "";
}
function preselectService(){
  const el = $("#serviceType"); if(!el) return;
  const qs = new URLSearchParams(location.search);
  let raw = qs.get('service') || qs.get('svc');
  if(!raw) raw = inferServiceFromReferrer();
  if(!raw){ try{ raw = localStorage.getItem('tpl.lastService') || ""; }catch(_){ raw=""; } }
  const canon = canonicalizeService(raw);
  if(canon){
    el.value = canon;
    toggleServiceExtras();
    try{ localStorage.setItem('tpl.lastService', canon); }catch(_){}
  }
}

/************** Auth **************/
function onAuth(cb){
  try{ return firebase.auth().onAuthStateChanged(cb); }
  catch(_){ cb(null); return ()=>{}; }
}

/************** Firestore: owner + pets **************/
async function readOwnerAndPets(uid){
  const db=firebase.firestore();

  async function readDoc(coll){
    try{
      const snap = await db.collection(coll).doc(uid).get();
      return snap.exists ? {ref:snap.ref, data:snap.data()||{}, coll} : null;
    }catch(e){
      console.warn(`[perfil] error leyendo ${coll}`, e);
      return null;
    }
  }

  const hit = await readDoc("users")
          || await readDoc("propietarios")
          || await readDoc("owners")
          || await readDoc("usuarios")
          || await readDoc("perfiles");

  const d = hit?.data || {};
  const nombre   = d.nombre || d.name || d.Nombre || "";
  const apellido = d.apellido || d.apellidos || d.surname || d.Apellidos || "";
  const fullName = d.fullName || [nombre,apellido].filter(Boolean).join(" ").trim() || (firebase.auth().currentUser?.displayName||"");
  const phone    = d.phone || d.telefono || d.tlf || d.Telefono || "";
  const region   = d.region || d.comunidad || d.comunidadAutonoma || d.ccaa || d.CCAA || "";
  const address  = d.address || d.direccion || d.Direccion || "";
  const postal   = d.postalCode || d.cp || d.codigo_postal || d.codigoPostal || d.CP || "";
  const email    = d.email || firebase.auth().currentUser?.email || "";

  let pets = Array.isArray(d.pets) ? d.pets : (Array.isArray(d.mascotas)? d.mascotas : []);

  if(!pets.length && hit?.ref){
    try{
      const sub = await hit.ref.collection("mascotas").get();
      pets = sub.docs.map((doc,i)=>{
        const x=doc.data()||{};
        return {
          id: doc.id || String(i+1),
          nombre: x.nombre || x.name || "Mascota",
          especie: (x.especie || x.tipo || "").toLowerCase(),
          nacimiento: x.birthdate || x.nacimiento || "",
          raza: x.raza || x.tipoExotico || "",
          sexo: x.sexo || x.genero || "",
          castrado: !!(x.castrado||x.esterilizado),
          foto: x.foto || x.img || ""
        };
      });
    }catch(e){
      console.warn("[perfil] subcolección 'mascotas' inaccesible por reglas:", e);
    }
  }

  pets = pets.map((p,i)=>({
    id: p.id || p.uid || String(i+1),
    nombre: p.nombre || p.name || "Mascota",
    especie: (p.especie || p.tipo || "").toLowerCase(),
    nacimiento: p.nacimiento || p.birthdate || "",
    raza: p.raza || p.tipoExotico || "",
    sexo: p.sexo || p.genero || "",
    castrado: !!(p.castrado||p.esterilizado),
    foto: p.foto || p.img || ""
  }));

  return { owner:{ fullName, email, phone, region, address, postalCode:postal }, pets };
}

/************** Fallback localStorage **************/
function getUID(){
  try{ return firebase.auth().currentUser?.uid || localStorage.getItem('tpl_auth_uid') || 'default'; }
  catch(_){ return 'default'; }
}
function udbKey(k){ return `tpl.udb.${getUID()}.${k}`; }
function udbGet(k,fb){ try{ const v=localStorage.getItem(udbKey(k)); return v?JSON.parse(v):fb; }catch(_){ return fb; } }

/************** UI titular **************/
function setSelectValue(selectId, value){
  const el = document.getElementById(selectId);
  if(!el || !value) return;
  const target = String(value).trim().toLowerCase();
  const hit = Array.from(el.options).find(o => (o.value||o.text).trim().toLowerCase()===target);
  if(hit){ el.value = hit.value; return; }
  const opt=document.createElement("option"); opt.value=String(value); opt.text=String(value);
  opt.dataset.injected="1"; el.appendChild(opt); el.value=opt.value;
}
function fillOwner(owner){
  $("#ownerFullName").value = owner.fullName || "";
  $("#email").value = owner.email || "";
  $("#phone").value = owner.phone || "";
  setSelectValue("region", owner.region || "");
  $("#address").value = owner.address || "";
  $("#postalCode").value = owner.postalCode || "";
}

/************** Estado + render mascotas **************/
const STATE = { owner:null, pets:[], selectedPetIds:[] };

function renderPetsGrid(pets){
  const grid=$("#petsGrid");
  grid.innerHTML="";

  (pets||[]).forEach(p=>{
    const iconHtml = p.foto
      ? `<img class="tpl-pet-thumb" src="${p.foto}" alt="${p.nombre||'Mascota'}">`
      : `<div class="tpl-pet-icon"><i class="fa-solid fa-paw"></i></div>`;

    // sexo icon
    const sx = String(p.sexo||"").toLowerCase();
    const sexIcon = sx==="hembra" ? "&#9792;" : (sx==="macho" ? "&#9794;" : "");

    // edad aprox en años
    let ageTxt="";
    const m=monthsBetween(p.nacimiento);
    if(m!=null){
      const years = Math.max(0, Math.floor(m/12));
      ageTxt = years>0 ? `${years} año${years>1?'s':''}` : `${m} meses`;
    }

    const bits = [
      (p.especie||"").toLowerCase(),
      (p.raza||""),
      (ageTxt?`Edad: ${ageTxt}`:""),
      (sexIcon?sexIcon:""),
      (p.castrado?"Castrado":"")
    ].filter(Boolean).join(" · ");

    const el=document.createElement("label");
    el.className="tpl-pet-item";
    el.setAttribute("data-birth", p.nacimiento||"");
    el.setAttribute("data-species", (p.especie||"").toLowerCase());
    el.innerHTML = `
      <input type="checkbox" class="pet-check" data-id="${p.id}">
      ${iconHtml}
      <div class="tpl-pet-meta">
        <div class="tpl-pet-name">${p.nombre||"Mascota"}</div>
        <div class="tpl-pet-sub">${bits}</div>
      </div>
    `;
    grid.appendChild(el);
  });

  if(!(pets||[]).length){
    grid.innerHTML = `
      <div class="tpl-pet-item">
        <div class="tpl-pet-meta">
          <div class="tpl-pet-name" style="color:#666">No hay mascotas en tu perfil</div>
          <div class="tpl-pet-sub">Añádelas en tu perfil para seleccionarlas aquí.</div>
        </div>
      </div>`;
  }

  grid.addEventListener("change", ()=>{
    STATE.selectedPetIds = $$(".pet-check:checked").map(x=>x.dataset.id);
    doRecalc();
  }, { once:true });
}

/************** Recogida de payload **************/
function collectPayload(){
  const pets = STATE.pets.filter(p=>STATE.selectedPetIds.includes(p.id));
  // num de mascotas: si el usuario lo elige manual (numPets), prevalece;
  // si no, usamos seleccionadas.
  const manualCount = parseInt($("#numPets")?.value||"0",10)||0;
  const petsCount = Math.max(manualCount, pets.length||0) || 1;

  const sType = $("#serviceType").value;
  const exType = $("#exoticType")?.value || "aves";
  const exCount = parseInt($("#exoticCount")?.value||"1",10) || 1;

  return {
    serviceType: sType,
    exoticType: sType==="exoticos" ? exType : null,
    exoticCount: sType==="exoticos" ? exCount : 0,
    startDate: $("#startDate").value,
    endDate: $("#endDate").value || $("#startDate").value,
    startTime: $("#startTime").value,
    endTime: $("#endTime").value,
    region: $("#region").value,
    address: $("#address").value,
    postalCode: $("#postalCode").value,
    visitDuration: $("#visitDuration")?.value || "60",
    secondMedVisit: $("#secondMedVisit")?.value || "no",
    pets,
    petsCount
  };
}

/************** Cálculo + resumen **************/
function bestBonosBreakdown(days, bonosMap, pricePerDay){
  // Descompone días en 30→20→10 y resto suelto (si hay bonos para esos tamaños)
  const packs=[30,20,10]; const lines=[]; let remain=days; let total=0;
  for(const p of packs){
    const k=String(p);
    if(remain>=p && bonosMap[k]!=null){
      const times = Math.floor(remain/p);
      remain -= times*p;
      if(times>0){
        lines.push({ label:`Bono x${p} · ${times} ud`, amount:bonosMap[k]*times });
        total += bonosMap[k]*times;
      }
    }
  }
  if(remain>0){
    lines.push({ label:`Días sueltos (${remain})`, amount: remain*pricePerDay });
    total += remain*pricePerDay;
  }
  return {lines,total};
}

function calc(payload){
  const s = payload.serviceType;
  const days = eachDayISO(payload.startDate, payload.endDate);
  const nDays = days.length || 1;

  let lines=[], auxLines=[], total=0, auxTotal=0;

  // helpers para añadir línea pública + aux
  function add(label, pubAmt, auxAmt){
    if(pubAmt && pubAmt!==0) lines.push({label, amount:pubAmt});
    if(auxAmt!=null) auxLines.push({label, amount:auxAmt});
    total += (pubAmt||0);
    auxTotal += (auxAmt||0);
  }

  // Conteo de mascotas
  const selectedPets = payload.pets || [];
  const N = payload.petsCount || (selectedPets.length||1);

  // Cachorros detectados
  const puppies = selectedPets.filter(isPuppy);
  const anyPuppy = puppies.length>0;

  // Servicio
  if(s==="guarderia_dia"){
    // Por mascota:
    // 1ª mascota: bonos por tipo (adult/puppy según su edad si existe una 1ª), si no hay ficha, usa adulto salvo haya algún cachorro -> puppy
    const firstPet = selectedPets[0] || null;
    const firstIsPuppy = firstPet ? isPuppy(firstPet) : anyPuppy;
    const priceFirst = firstIsPuppy ? PRICES_PUBLIC.guarderia.puppy : PRICES_PUBLIC.guarderia.adult;
    const bonosFirst = firstIsPuppy ? PRICES_PUBLIC.guarderia.bonos.puppy : PRICES_PUBLIC.guarderia.bonos.adult;
    const auxFirstPerDay = firstIsPuppy ? PRICES_AUX.guarderia.puppy : PRICES_AUX.guarderia.adult;
    const auxBonosFirst = firstIsPuppy ? PRICES_AUX.guarderia.bonosPerDay.puppy : PRICES_AUX.guarderia.bonosPerDay.adult;

    // Público 1ª
    const bd1 = bestBonosBreakdown(nDays, bonosFirst, priceFirst);
    bd1.lines.forEach(l=> add(`Guardería · 1ª mascota · ${l.label}`, l.amount, null));
    // Aux 1ª
    const aux1 = bestBonosBreakdown(nDays, Object.fromEntries(Object.entries(auxBonosFirst).map(([k,v])=>[k, v*parseInt(k,10)])), auxFirstPerDay);
    aux1.lines.forEach(l=> add(`(aux) Guardería · 1ª mascota · ${l.label}`, null, l.amount));

    // 2ª mascota: 12€/día (sin bono)
    if(N>=2){
      add(`Guardería · 2ª mascota · ${nDays} día(s) · 12€`, nDays*PRICES_PUBLIC.guarderia.second, nDays*PRICES_AUX.guarderia.second);
    }
    // 3ª+ mascota: 8€/día c/u (sin bono)
    if(N>=3){
      const k = (N-2);
      add(`Guardería · ${k} mascota(s) extra · ${nDays} día(s) · 8€`, nDays*PRICES_PUBLIC.guarderia.thirdPlus*k, nDays*PRICES_AUX.guarderia.thirdPlus*k);
    }
  }

  if(s==="alojamiento_nocturno"){
    // Tramo por día (1–10 vs 11+)
    const first = selectedPets[0] || null;
    const firstIsPuppy = first ? isPuppy(first) : anyPuppy;
    const rateFirst = firstIsPuppy ? PRICES_PUBLIC.alojamiento.puppy : PRICES_PUBLIC.alojamiento.std;
    const rateFirstAux = firstIsPuppy ? PRICES_AUX.alojamiento.puppy : PRICES_AUX.alojamiento.std;

    let d1_10=0, d11=0; days.forEach((d,i)=>{ if(i<10) d1_10++; else d11++; });

    if(d1_10>0){
      add(`Alojamiento · 1ª mascota · ${d1_10} noche(s) · ${rateFirst.d1_10}€`, d1_10*rateFirst.d1_10, d1_10*rateFirstAux.d1_10);
    }
    if(d11>0){
      add(`Alojamiento · 1ª mascota · ${d11} noche(s) · ${rateFirst.d11}€`, d11*rateFirst.d11, d11*rateFirstAux.d11);
    }

    // Extras por mascota (2ª+): si es cachorro -> 30→28, si no -> 25→22
    if(N>=2){
      const extras = N-1;
      // Estimar si alguna extra es cachorro (buscamos en las restantes)
      const extraPups = selectedPets.slice(1).filter(isPuppy).length;
      const normalCount = extras - extraPups;

      if(normalCount>0){
        if(d1_10>0) add(`Alojamiento · ${normalCount} mascota(s) extra · ${d1_10} noche(s) · 25€`, d1_10*PRICES_PUBLIC.alojamiento.second.d1_10*normalCount, d1_10*PRICES_AUX.alojamiento.second.d1_10*normalCount);
        if(d11>0)   add(`Alojamiento · ${normalCount} mascota(s) extra · ${d11} noche(s) · 22€`, d11*PRICES_PUBLIC.alojamiento.second.d11*normalCount, d11*PRICES_AUX.alojamiento.second.d11*normalCount);
      }
      if(extraPups>0){
        if(d1_10>0) add(`Alojamiento (cachorro) · ${extraPups} mascota(s) extra · ${d1_10} noche(s) · 30€`, d1_10*PRICES_PUBLIC.alojamiento.second_puppy.d1_10*extraPups, d1_10*PRICES_AUX.alojamiento.second_puppy.d1_10*extraPups);
        if(d11>0)   add(`Alojamiento (cachorro) · ${extraPups} mascota(s) extra · ${d11} noche(s) · 28€`, d11*PRICES_PUBLIC.alojamiento.second_puppy.d11*extraPups, d11*PRICES_AUX.alojamiento.second_puppy.d11*extraPups);
      }
    }
  }

  if(s==="paseo"){
    // Paseo por día. Si solo 1 mascota => opción bonos; extra mascotas +8 por día c/u (sin bono)
    if(nDays>0){
      if(N===1){
        // bonos informativos: aplicamos packs si hay suficientes días
        const bd = bestBonosBreakdown(nDays, PRICES_PUBLIC.paseo.bonos, PRICES_PUBLIC.paseo.base);
        bd.lines.forEach(l => add(`Paseo 60’ · ${l.label}`, l.amount, null));
        // aux bonos por paseo
        const auxBonos = PRICES_AUX.paseo.bonosPerWalk;
        const auxComputed = bestBonosBreakdown(nDays, Object.fromEntries(Object.entries(auxBonos).map(([k,v])=>[k, v*parseInt(k,10)])), PRICES_AUX.paseo.base);
        auxComputed.lines.forEach(l => add(`(aux) Paseo 60’ · ${l.label}`, null, l.amount));
      }else{
        // sin bono base
        add(`Paseo 60’ · ${nDays} día(s) · 12€`, nDays*PRICES_PUBLIC.paseo.base, nDays*PRICES_AUX.paseo.base);
      }
      if(N>=2){
        const extras = N-1;
        add(`Paseo · mascotas extra (${extras}) · ${nDays} día(s) · +8€`, nDays*PRICES_PUBLIC.paseo.extra*extras, nDays*PRICES_AUX.paseo.extra*extras);
      }
    }
  }

  if(s==="visita_gato"){
    // Base por día según 60/90 y tramo
    const use90 = payload.visitDuration==="90";
    const basePub   = use90 ? PRICES_PUBLIC.visita.base90 : PRICES_PUBLIC.visita.base60;
    const baseAux   = use90 ? PRICES_AUX.visita.base90   : PRICES_AUX.visita.base60;
    let d1_10=0, d11=0; days.forEach((d,i)=>{ if(i<10) d1_10++; else d11++; });

    if(d1_10>0) add(`Visita gato · ${use90?90:60}’ · ${d1_10} día(s)`, d1_10*basePub.d1_10, d1_10*baseAux.d1_10);
    if(d11>0)   add(`Visita gato · ${use90?90:60}’ · ${d11} día(s) (≥ día 11)`, d11*basePub.d11, d11*baseAux.d11);

    // 2ª visita medicación 15’: 12 (1–10) → 10 (11+), por día (margen 0)
    if(payload.secondMedVisit==="si"){
      if(d1_10>0) add(`2ª visita medicación 15’ · ${d1_10} día(s)`, d1_10*PRICES_PUBLIC.visita.med15.d1_10, d1_10*PRICES_AUX.visita.med15.d1_10);
      if(d11>0)   add(`2ª visita medicación 15’ · ${d11} día(s)`, d11*PRICES_PUBLIC.visita.med15.d11, d11*PRICES_AUX.visita.med15.d11);
    }

    // Suplemento por nº de gatos (por día)
    const cats = Math.max(payload.petsCount || 0, selectedPets.filter(p=>p.especie==="gato").length) || 1;
    const extraCats = Math.max(0, cats-1);
    if(extraCats>0){
      // público
      let perCatPub = 0;
      if(extraCats===1) perCatPub = PRICES_PUBLIC.visita.extraCats.one;
      else if(extraCats===2) perCatPub = PRICES_PUBLIC.visita.extraCats.twoEach;
      else perCatPub = PRICES_PUBLIC.visita.extraCats.threePlusEach;
      add(`Gatos extra (${extraCats}) · ${nDays} día(s)`, nDays*perCatPub*extraCats, null);

      // auxiliar
      let perCatAux = 0;
      if(extraCats===1) perCatAux = PRICES_AUX.visita.extraCats.one;
      else if(extraCats===2) perCatAux = PRICES_AUX.visita.extraCats.twoEach;
      else perCatAux = PRICES_AUX.visita.extraCats.threePlusEach;
      add(`(aux) Gatos extra (${extraCats}) · ${nDays} día(s)`, null, nDays*perCatAux*extraCats);
    }
  }

  if(s==="exoticos"){
    const t = payload.exoticType || "aves";
    const count = payload.exoticCount || 1;
    let d1_10=0, d11=0; days.forEach((d,i)=>{ if(i<10) d1_10++; else d11++; });

    // primer exótico
    const basePub = PRICES_PUBLIC.exoticos[t];
    const baseAux = PRICES_AUX.exoticos[t];
    if(d1_10>0) add(`Exóticos · ${labelExotic(t)} · ${d1_10} día(s)`, d1_10*basePub.d1_10, d1_10*baseAux.d1_10);
    if(d11>0)   add(`Exóticos · ${labelExotic(t)} · ${d11} día(s) (≥ día 11)`, d11*basePub.d11, d11*baseAux.d11);

    // extras
    const extras = Math.max(0, count-1);
    if(extras>0){
      if(t==="mamiferos"){
        // público
        if(d1_10>0) add(`Exóticos · ${extras} mamífero(s) extra · ${d1_10} día(s) · 20€`, d1_10*PRICES_PUBLIC.exoticos.secondMam.d1_10*extras, d1_10*PRICES_AUX.exoticos.secondMam.d1_10*extras);
        if(d11>0)   add(`Exóticos · ${extras} mamífero(s) extra · ${d11} día(s) · 18€`, d11*PRICES_PUBLIC.exoticos.secondMam.d11*extras, d11*PRICES_AUX.exoticos.secondMam.d11*extras);
      }else{
        // aves/reptiles: sin suplemento por segunda mascota
        // (si en el futuro se cambia, se añade aquí)
      }
    }
  }

  if(s==="transporte"){
    add(`Transporte`, PRICES_PUBLIC.transporte.base, PRICES_AUX.transporte.base);
  }

  // Suplementos por días (urgen/festivos/señalados si tu UI lo activa; aquí solo señalados automáticos)
  days.forEach(iso=>{
    if(isBigDay(iso)){
      add(`Día señalado (${iso})`, PRICES_PUBLIC.supplements.señalado, PRICES_AUX.supplements.señalado);
    }
    // Si activas festivo normal por selección manual, añade aquí la línea +10 (aux +8).
  });

  // Totales
  const payNow   = Math.max(0, total - auxTotal); // margen real
  const payLater = Math.max(0, total - payNow);
  return { linesPublic:lines, totalPublic:total, payNow, payLater };
}

function renderSummary(calc, payload){
  const ctxParts = [
    labelService(payload.serviceType) || "—",
    payload.exoticType ? `· ${labelExotic(payload.exoticType)}` : "",
    payload.startDate||"—",
    payload.endDate ? ("—"+payload.endDate) : "",
    payload.startTime ? ("· "+payload.startTime) : "",
    payload.endTime ? ("–"+payload.endTime) : "",
    `· ${(payload.petsCount || (payload.pets||[]).length || 1)} mascota(s)`
  ];
  $("#summaryContext").textContent = ctxParts.filter(Boolean).join(" ");

  const box=$("#summaryLines"); box.innerHTML="";
  calc.linesPublic.forEach(l=>{
    const row=document.createElement("div");
    row.className="line";
    row.innerHTML = `<span>${l.label}</span><span>${l.amount!=null?fmtMoney(l.amount):'<span class="muted">—</span>'}</span>`;
    box.appendChild(row);
  });

  $("#subtotalTxt").textContent = fmtMoney(calc.totalPublic);
  $("#payNowTxt").textContent   = fmtMoney(calc.payNow);
  $("#payLaterTxt").textContent = fmtMoney(calc.payLater);
}

function doRecalc(){
  const payload = collectPayload();
  $("#visitCatControls").style.display = (payload.serviceType==="visita_gato") ? "" : "none";
  $("#exoticsRow").style.display = (payload.serviceType==="exoticos") ? "" : "none";

  if(!payload.serviceType || !payload.startDate || !payload.endDate){
    renderSummary({linesPublic:[],totalPublic:0,payNow:0,payLater:0}, payload);
    return;
  }
  const c = calc(payload);
  renderSummary(c, payload);
}

/************** EmailJS (opcional) **************/
async function sendEmails(reservation){
  if(!window.TPL_EMAILJS || !TPL_EMAILJS.enabled || !window.emailjs) return;
  const svc = labelService(reservation.service.type);
  const mascotas = (reservation.pets||[]).map(p=>p.nombre).join(", ")||"—";

  const vars = {
    reserva_id: reservation.id,
    service: reservation.service.exoticType ? `${svc} · ${labelExotic(reservation.service.exoticType)}` : svc,
    startDate: reservation.dates.startDate,
    endDate: reservation.dates.endDate || reservation.dates.startDate,
    Hora_inicio: reservation.dates.startTime || "",
    Hora_fin: reservation.dates.endTime || "",
    species: mascotas,
    summaryField: JSON.stringify(reservation.pricing.breakdownPublic.map(l=>`${l.label}${l.amount?`: ${l.amount}€`:""}`), null, 2),

    firstName: reservation.owner.fullName,
    email: reservation.owner.email,
    phone: reservation.owner.phone,
    region: reservation.region || $("#region").value || "",
    address: reservation.owner.address,
    postalCode: reservation.owner.postalCode,
    observations: $("#notes").value || "",

    total_cliente: reservation.pricing.totalClient,
    pagar_ahora: reservation.pricing.payNow,
    pendiente: reservation.pricing.payLater,

    total_txt: fmtMoney(reservation.pricing.totalClient).replace(" €","€"),
    pay_now_txt: fmtMoney(reservation.pricing.payNow).replace(" €","€"),
    pay_later_txt: fmtMoney(reservation.pricing.payLater).replace(" €","€"),

    _estado: reservation.status || "paid_review",
    _uid: firebase.auth().currentUser?.uid || "",
    _email: firebase.auth().currentUser?.email || "",

    admin_email: (TPL_EMAILJS && TPL_EMAILJS.adminEmail) ? TPL_EMAILJS.adminEmail : "gestion@thepetslovers.es"
  };

  try{
    await emailjs.send(TPL_EMAILJS.serviceId, TPL_EMAILJS.templateIdCliente, vars);
    await emailjs.send(TPL_EMAILJS.serviceId, TPL_EMAILJS.templateIdGestion, vars);
    console.log("[EmailJS] enviados");
  }catch(e){
    console.warn("[EmailJS] error", e);
  }
}

/************** Login inline (no redirige) **************/
function mountInlineLogin(){
  const host=$("#tpl-inline-login"); if(!host) return;
  host.innerHTML = `
    <div class="tpl-login-card" role="region" aria-label="Acceso rápido">
      <h3 class="tpl-login-title">Accede aquí mismo</h3>
      <form id="tpl-inline-form" class="tpl-login-form" novalidate style="display:grid;gap:8px">
        <label>Email</label>
        <input type="email" name="email" required autocomplete="email" />
        <label>Contraseña</label>
        <input type="password" name="password" required autocomplete="current-password" />
        <button type="submit" class="tpl-btn">Iniciar sesión</button>
        <button type="button" class="tpl-btn-outline" id="tpl-google-btn"><i class="fa-brands fa-google"></i> Google</button>
        <p class="tpl-login-msg" aria-live="polite"></p>
      </form>
    </div>
  `;
  const form=$("#tpl-inline-form");
  const msg = host.querySelector(".tpl-login-msg");
  const gbtn=$("#tpl-google-btn");

  form.addEventListener("submit", async (e)=>{
    e.preventDefault();
    msg.textContent = "Accediendo…";
    try{
      await firebase.auth().signInWithEmailAndPassword(form.email.value.trim(), form.password.value);
      msg.textContent = "¡Listo!";
      location.reload();
    }catch(err){
      msg.textContent = (err && err.message) || "No se pudo iniciar sesión.";
    }
  });

  gbtn.addEventListener("click", async ()=>{
    msg.textContent="Conectando con Google…";
    try{
      const provider = new firebase.auth.GoogleAuthProvider();
      await firebase.auth().signInWithPopup(provider);
      location.reload();
    }catch(err){
      msg.textContent = (err && err.message) || "No se pudo iniciar con Google.";
    }
  });
}

/************** UI toggles **************/
function toggleServiceExtras(){
  const s=$("#serviceType").value;
  $("#visitCatControls").style.display = (s==="visita_gato") ? "" : "none";
  $("#exoticsRow").style.display = (s==="exoticos") ? "" : "none";
}

/************** INIT **************/
window.addEventListener("load", ()=>{
  // Fechas coherentes
  $("#startDate").addEventListener("change", ()=>{
    if(!$("#endDate").value) $("#endDate").value = $("#startDate").value;
    if($("#endDate").value && parseDate($("#endDate").value) < parseDate($("#startDate").value)){
      $("#endDate").value = $("#startDate").value;
    }
    doRecalc();
  });
  $("#endDate").addEventListener("change", ()=>{
    if($("#startDate").value && parseDate($("#endDate").value) < parseDate($("#startDate").value)){
      $("#endDate").value = $("#startDate").value;
    }
    doRecalc();
  });

  // Toggle extras
  $("#serviceType").addEventListener("change", ()=>{ toggleServiceExtras(); doRecalc(); });
  $("#exoticType")?.addEventListener("change", doRecalc);
  $("#exoticCount")?.addEventListener("change", doRecalc);

  // Preselección de servicio
  preselectService();

  // Binds de recálculo
  ["serviceType","startDate","endDate","startTime","endTime","region","address","postalCode","visitDuration","secondMedVisit","numPets"]
    .forEach(id=>{ const el=$("#"+id); if(el) el.addEventListener("input", doRecalc); });

  // Auth gate
  onAuth(async (u)=>{
    const wall=$("#authWall");
    const form=$("#reservaForm");

    if(!u){
      wall.style.display="block";
      form.classList.add("disabled");
      mountInlineLogin();
      return;
    }

    wall.style.display="none";
    form.classList.remove("disabled");

    // Cargar owner + mascotas
    try{
      let {owner, pets} = await readOwnerAndPets(u.uid);

      // Fallback local si falta algo
      if((!owner?.fullName || !owner?.phone) && udbGet("owner",null)){
        const fb=udbGet("owner",{});
        owner = {
          fullName: (fb.nombre||"") + (fb.apellidos?(" "+fb.apellidos):""),
          email: fb.email || owner.email,
          phone: fb.telefono || owner.phone,
          region: fb.ccaa || owner.region,
          address: fb.direccion || owner.address,
          postalCode: fb.cp || owner.postalCode
        };
      }
      fillOwner(owner||{});

      // Mezcla mascotas firestore + locales (evitar duplicados)
      const localPets = udbGet("pets", []) || udbGet("mascotas", []) || [];
      const merged = [
        ...(pets||[]),
        ...localPets.map((p,i)=>({ id:p.id||`loc_${i}`, nombre:p.nombre, especie:(p.especie||p.tipo||"").toLowerCase(), nacimiento:p.nacimiento||p.birthdate||"", raza:p.raza||p.tipoExotico||"", sexo:p.sexo||p.genero||"", castrado:!!(p.castrado||p.esterilizado), foto:p.foto||"" }))
      ];
      const seen=new Set();
      STATE.pets = merged.filter(p=>{
        const key = `${(p.nombre||"").toLowerCase()}|${p.especie||""}`;
        if(seen.has(key)) return false; seen.add(key); return true;
      });

      renderPetsGrid(STATE.pets);
    }catch(e){
      console.warn("[init] owner/pets", e);
    }

    // Mostrar controles según selección (por si venía preseleccionado)
    toggleServiceExtras();
    doRecalc();

    // CTA reservar
    $("#btnReserve").addEventListener("click", async ()=>{
      const payload=collectPayload();
      if(!payload.serviceType || !payload.startDate || !payload.endDate){
        alert("Selecciona servicio y fechas de inicio/fin."); return;
      }
      if(payload.serviceType!=="exoticos" && STATE.selectedPetIds.length===0){
        alert("Elige al menos una mascota."); return;
      }

      const c=calc(payload);
      const reservation = {
        id: "resv_"+Date.now(),
        status: "paid_review",
        createdAt: nowISO(),
        region: payload.region,
        service: { type: payload.serviceType, exoticType: payload.exoticType||null },
        dates: {
          startDate: payload.startDate,
          endDate: payload.endDate,
          startTime: payload.startTime || null,
          endTime: payload.endTime || null
        },
        owner: {
          fullName: $("#ownerFullName").value.trim(),
          email: $("#email").value.trim(),
          phone: $("#phone").value.trim(),
          address: $("#address").value.trim(),
          postalCode: $("#postalCode").value.trim(),
          contactPref: "Cualquiera",
          contactTime: ""
        },
        pets: payload.pets,
        pricing: {
          breakdownPublic: c.linesPublic,
          totalClient: Number(c.totalPublic.toFixed(2)),
          payNow: Number(c.payNow.toFixed(2)),
          payLater: Number(c.payLater.toFixed(2)),
          currency:"EUR"
        }
      };

      // Guarda una copia local para mostrar en perfil
      try{
        const key="tpl.reservas";
        const list = JSON.parse(localStorage.getItem(key)||"[]");
        list.unshift(reservation);
        localStorage.setItem(key, JSON.stringify(list));
      }catch(_){}

      // Envío emails (opcional)
      try{ await sendEmails(reservation); }catch(_){}

      // Modal gracias
      const modal=$("#reserveModal");
      modal.style.display="flex";
    });
  });
});
