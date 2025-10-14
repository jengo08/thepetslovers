/****************************************************
 * TPL · RESERVAS (COMPLETO)
 * Mantiene tus IDs y flujo + mejoras pactadas
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
function fmtMD(dateStr){
  const d=parseDate(dateStr); if(!d) return "";
  const m=String(d.getMonth()+1).padStart(2,"0"), dd=String(d.getDate()).padStart(2,"0");
  return `${m}-${dd}`;
}
function cap(s){ s=String(s||''); return s? s.charAt(0).toUpperCase()+s.slice(1) : s; }

/************** Etiquetas **************/
function labelService(s){
  return ({
    guarderia_dia:"Guardería de día",
    alojamiento_nocturno:"Alojamiento nocturno",
    paseo:"Paseos (60’)",
    visita_gato:"Visita a domicilio (gato)",
    exoticos:"Servicio de Exóticos",
    transporte:"Transporte"
  })[s]||s;
}

/************** Precios (públicos + auxiliar) **************/
const BIG_DAYS = ["12-24","12-25","12-31","01-01"]; // MM-DD

const PRICES = {
  publico: {
    paseo: { base:12, extra:8 },
    guarderia: {
      adult_day: 15, puppy_day: 20,
      bonos_adult: {10:135, 20:250, 30:315},
      bonos_puppy: {10:185, 20:350, 30:465}
    },
    alojamiento: {
      first_std_1_10:30, first_std_11:28,
      first_puppy_1_10:35, first_puppy_11:32,
      second_std_1_10:25, second_std_11:22,
      // override especial si hay puppy y hay segunda mascota
      second_puppy_1_10:30, second_puppy_11:28
    },
    visita_gato: {
      base60_1_10:22, base60_11:18,
      base90_1_10:30, base90_11:27,
      med15_1_10:12,  med15_11:10,
      extraCats: { one:12, twoEach:8, threePlusEach:6 }
    },
    exoticos: {
      aves_1_10:20, aves_11:18,
      reptiles_1_10:20, reptiles_11:18,
      mamif_1_10_first:25, mamif_1_10_second:20,
      mamif_11_first:22,   mamif_11_second:18
    },
    transporte: { base:20 },
    suplementos: {
      urgencia:10, festivo:10, señalado:30
    }
  },
  auxiliar: {
    guarderia: {
      adult_day:12, puppy_day:17,
      bonos_adult_perday: {10:11,20:10,30:9},
      bonos_puppy_perday: {10:16,20:14,30:12}
    },
    alojamiento: {
      first_std_1_10:25, first_std_11:22,
      first_puppy_1_10:30, first_puppy_11:27,
      second_std_1_10:20, second_std_11:17,
      second_puppy_1_10:30, second_puppy_11:28 // asumes mismo que cliente puppy 2ª? si prefieres otro, dime
    },
    paseo: { base:10, extra:5, bonos_per_walk:{10:8,15:7.5,20:7,25:6.5,30:6} },
    visita_gato: {
      base60_1_10:17, base60_11:12,
      base90_1_10:25, base90_11:21,
      med15_equal_public:true, // margen 0
      extraCatsEach: { one:10, twoEach:6, threePlusEach:4 }
    },
    exoticos: {
      aves_11:12, reptiles_11:12,
      mamif_11_first:18, mamif_11_second:14
    },
    transporte: { base:15 },
    suplementos: { festivo:8, señalado:15, urgencia_to_margen:true }
  }
};

/************** Preselección de servicio **************/
function canonicalizeService(raw){
  if(!raw) return "";
  const s = String(raw).toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'');
  const map = {
    'paseo':'paseo','paseos':'paseo',
    'guarderia':'guarderia_dia','guarderia-de-dia':'guarderia_dia','guarderia_dia':'guarderia_dia',
    'alojamiento':'alojamiento_nocturno','estancias':'alojamiento_nocturno','nocturnas':'alojamiento_nocturno','estancias-nocturnas':'alojamiento_nocturno',
    'visitas':'visita_gato','visita-gato':'visita_gato','visita_gato':'visita_gato',
    'exoticos':'exoticos','servicio-exoticos':'exoticos',
    'transporte':'transporte'
  };
  const allowed = new Set(Object.values(map));
  if(allowed.has(s)) return s;
  return map[s] || "";
}
function inferServiceFromReferrer(){
  try{
    const r = document.referrer ? new URL(document.referrer) : null;
    if(!r) return "";
    const p = (r.pathname || "").toLowerCase();
    if(/paseo/.test(p)) return 'paseo';
    if(/guarderia/.test(p)) return 'guarderia_dia';
    if(/estancia|estancias|alojamiento|noche|nocturn/.test(p)) return 'alojamiento_nocturno';
    if(/visita/.test(p) && /gato/.test(p)) return 'visita_gato';
    if(/exotico/.test(p)) return 'exoticos';
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
    try{ localStorage.setItem('tpl.lastService', canon); }catch(_){}
  }
  // toggle específicos
  const v = $("#visitCatControls"); if(v) v.style.display = (el.value==='visita_gato')?"":"none";
  const ex = $("#exoticosControls"); if(ex) ex.style.display = (el.value==='exoticos')?"":"none";
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
          castrado: (x.castrado ?? x.esterilizado ?? x.neutered ?? false) ? true:false,
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
    castrado: (p.castrado ?? p.esterilizado ?? p.neutered ?? false) ? true:false,
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

function calcAgeYears(birth){
  if(!birth) return "";
  const d=new Date(birth); if(isNaN(d)) return "";
  const t=new Date();
  let y=t.getFullYear()-d.getFullYear();
  if(t.getMonth()<d.getMonth() || (t.getMonth()===d.getMonth() && t.getDate()<d.getDate())) y--;
  return y>=0?y:"";
}
function sexSymbol(sex){
  const s=(sex||"").toLowerCase();
  if(/hembra|female|f/.test(s)) return "♀";
  if(/macho|male|m/.test(s)) return "♂";
  return "";
}

function renderPetsGrid(pets){
  const grid=$("#petsGrid");
  grid.innerHTML="";

  (pets||[]).forEach(p=>{
    const iconHtml = p.foto
      ? `<img class="tpl-pet-thumb" src="${p.foto}" alt="${p.nombre||'Mascota'}">`
      : `<div class="tpl-pet-thumb" style="display:flex;align-items:center;justify-content:center;background:#f3f4f6"><i class="fa-solid fa-paw" style="color:#9aa0a6"></i></div>`;

    const el=document.createElement("label");
    el.className="tpl-pet-item";
    el.setAttribute("data-birth", p.nacimiento||"");
    el.setAttribute("data-species", (p.especie||"").toLowerCase());
    el.innerHTML = `
      <input type="checkbox" class="pet-check" data-id="${p.id}">
      ${iconHtml}
      <div class="tpl-pet-meta">
        <div class="tpl-pet-name">${p.nombre||"Mascota"}</div>
        <div class="tpl-pet-sub"></div>
      </div>
    `;
    const sub = el.querySelector(".tpl-pet-sub");
    const bits=[];
    if(p.especie) bits.push(cap(p.especie)+(p.raza?` ${p.raza}`:""));
    const ageY = calcAgeYears(p.nacimiento);
    if(ageY!=="") bits.push(`Edad: ${ageY}`);
    const sx = sexSymbol(p.sexo);
    if(sx) bits.push(sx);
    if(p.castrado) bits.push("Castrado");
    sub.textContent = bits.join(" · ");
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

  // sync nº mascotas al seleccionar
  grid.addEventListener("change", ()=>{
    STATE.selectedPetIds = $$(".pet-check:checked").map(x=>x.dataset.id);
    // sincroniza selector numPets si el servicio no es exóticos (exóticos usa su propio contador)
    if($("#serviceType").value!=="exoticos"){
      const n = STATE.selectedPetIds.length || 1;
      $("#numPets").value = String(Math.min(Math.max(n,1),6));
    }
    // Cachorro display
    __updatePuppyDisplay();
    doRecalc();
  });
}

/************** Puppy display auto **************/
function __updatePuppyDisplay(){
  const disp = $("#isPuppyDisplay");
  const grid = $("#petsGrid");
  if(!disp || !grid){ return; }
  let any=false;
  grid.querySelectorAll('.tpl-pet-item').forEach(card=>{
    const chk = card.querySelector('.pet-check');
    if(chk && chk.checked){
      const birth = (card.getAttribute('data-birth')||'').trim();
      const species = (card.getAttribute('data-species')||'').trim().toLowerCase();
      if(species==='perro' && birth){
        const d = new Date(birth);
        if(!isNaN(d)){
          const t=new Date();
          const months=(t.getFullYear()-d.getFullYear())*12+(t.getMonth()-d.getMonth())-(t.getDate()<d.getDate()?1:0);
          if(months<=6) any = true;
        }
      }
    }
  });
  disp.value = any ? 'si' : 'no';
}

/************** Recogida de payload **************/
function collectPayload(){
  const selService = $("#serviceType").value;
  const selectedPets = STATE.pets.filter(p=>STATE.selectedPetIds.includes(p.id));
  const selectedCount = selectedPets.length;

  // base nº mascotas
  let numPets = Number($("#numPets").value || 1);
  if(selService!=="exoticos"){
    // si hay tarjetas seleccionadas, manda ese número
    numPets = selectedCount || numPets;
  }

  // exóticos: su propio contador
  let exoticoType = $("#exoticoType")?.value || "aves";
  let exoticoNum  = Number($("#exoticoNum")?.value || 1);
  if(selService==="exoticos") numPets = exoticoNum;

  return {
    serviceType: selService,
    startDate: $("#startDate").value,
    endDate: $("#endDate").value || $("#startDate").value,
    startTime: $("#startTime").value,
    endTime: $("#endTime").value,
    region: $("#region").value,
    address: $("#address").value,
    postalCode: $("#postalCode").value,
    travelNeeded: "no",
    visitDuration: $("#visitDuration")?.value || "60",
    secondMedVisit: $("#secondMedVisit")?.value || "no",
    exoticoType,
    numPets,
    pets: selectedPets
  };
}

/************** Util bono guardería **************/
function splitBonos(totalDays, table){
  // table p.ej {30:315,20:250,10:135}
  const packs=[30,20,10].filter(k=>table[k]).sort((a,b)=>b-a);
  let rest=totalDays, lines=[];
  for(const size of packs){
    const n = Math.floor(rest/size);
    if(n>0){
      for(let i=0;i<n;i++) lines.push({type:`bono${size}`, days:size, amount:table[size]});
      rest -= n*size;
    }
  }
  return {lines,rest};
}

/************** Cálculo + resumen **************/
function calc(payload){
  const s = payload.serviceType;
  const nDays = Math.max(1, daysInclusive(payload.startDate, payload.endDate));
  const big = BIG_DAYS.includes(fmtMD(payload.startDate)) || BIG_DAYS.includes(fmtMD(payload.endDate));
  let lines=[], totalPublic=0, costAux=0;

  const numPets = Math.max(1, Number(payload.numPets||1));
  const petsSel = payload.pets || [];

  const anyPuppy = petsSel.some(p=>{
    if(p.especie!=="perro" || !p.nacimiento) return false;
    const t=new Date(); const d=new Date(p.nacimiento);
    if(isNaN(d)) return false;
    const months=(t.getFullYear()-d.getFullYear())*12+(t.getMonth()-d.getMonth())-(t.getDate()<d.getDate()?1:0);
    return months<=6;
  });

  // helper push line
  function pushLine(lbl, qty, unit, amountPerUnit, auxPerUnit, note){
    const amount = qty * amountPerUnit;
    const aux    = qty * (auxPerUnit||0);
    lines.push({
      label: lbl + (unit?` · ${qty} ${unit}(s) · ${fmtMoney(amountPerUnit)}`:""),
      amount,
      aux,
      note
    });
    totalPublic += amount;
    costAux     += aux;
  }

  if(s==="paseo"){
    // 1ª mascota
    pushLine("Paseo (60’) · 1ª mascota", nDays, "día", PRICES.publico.paseo.base, PRICES.auxiliar.paseo.base);
    // mascotas extra
    const extraCount = Math.max(0, numPets-1);
    if(extraCount>0){
      pushLine(`Paseo (60’) · ${extraCount} mascota(s) extra`, nDays, "día", PRICES.publico.paseo.extra*extraCount, PRICES.auxiliar.paseo.extra*extraCount);
    }
  }

  if(s==="guarderia_dia"){
    const pub = PRICES.publico.guarderia;
    const aux = PRICES.auxiliar.guarderia;
    const perDayPub  = anyPuppy ? pub.puppy_day : pub.adult_day;
    const perDayAux  = anyPuppy ? aux.puppy_day : aux.adult_day;
    // Bonos auto-combinados
    const bonosTbl = anyPuppy ? pub.bonos_puppy : pub.bonos_adult;
    const bonosAuxPerDay = anyPuppy ? aux.bonos_puppy_perday : aux.bonos_adult_perday;

    const split = splitBonos(nDays, bonosTbl); // líneas de bonos + resto
    split.lines.forEach(b=>{
      const perDayAuxB = bonosAuxPerDay[b.days]; // coste auxiliar por día en ese bono
      pushLine(`Guardería · bono ${b.days}`, 1, null, b.amount, perDayAuxB*b.days);
    });
    if(split.rest>0){
      pushLine(`Guardería · días sueltos`, split.rest, "día", perDayPub, perDayAux);
    }

    if(numPets>1){
      // guardería no tiene tarificación específica por 2ª mascota → se multiplica por nº mascotas
      // Desglosamos la 1ª y el resto como líneas separadas:
      // ya metimos líneas para 1 mascota; añadimos (numPets-1) iguales
      const extra = numPets-1;
      // Para claridad de desglose, repetimos los importes calculados arriba para extra mascotas:
      // Bono(s) extra
      split.lines.forEach(b=>{
        const perDayAuxB = bonosAuxPerDay[b.days];
        pushLine(`Guardería · bono ${b.days} · ${extra} mascota(s) extra`, 1, null, b.amount*extra, perDayAuxB*b.days*extra);
      });
      if(split.rest>0){
        pushLine(`Guardería · días sueltos · ${extra} mascota(s) extra`, split.rest, "día", perDayPub*extra, perDayAux*extra);
      }
    }
  }

  if(s==="alojamiento_nocturno"){
    // 1ª mascota
    const firstIsPuppy = anyPuppy; // si hay algún puppy, primera a puppy
    const firstPub_1_10 = firstIsPuppy?PRICES.publico.alojamiento.first_puppy_1_10:PRICES.publico.alojamiento.first_std_1_10;
    const firstPub_11   = firstIsPuppy?PRICES.publico.alojamiento.first_puppy_11:PRICES.publico.alojamiento.first_std_11;
    const firstAux_1_10 = firstIsPuppy?PRICES.auxiliar.alojamiento.first_puppy_1_10:PRICES.auxiliar.alojamiento.first_std_1_10;
    const firstAux_11   = firstIsPuppy?PRICES.auxiliar.alojamiento.first_puppy_11:PRICES.auxiliar.alojamiento.first_std_11;

    const d1_10 = Math.min(10, nDays);
    const d11   = Math.max(0, nDays-10);
    if(d1_10>0) pushLine("Alojamiento · 1ª mascota · días 1–10", d1_10, "día", firstPub_1_10, firstAux_1_10);
    if(d11>0)   pushLine("Alojamiento · 1ª mascota · desde día 11", d11, "día", firstPub_11, firstAux_11);

    // 2ª+ mascotas
    const extraCount = Math.max(0, numPets-1);
    if(extraCount>0){
      // regla especial si hay cachorro: 2ª+ puppy 30/28
      const secondPub_1_10 = anyPuppy ? PRICES.publico.alojamiento.second_puppy_1_10 : PRICES.publico.alojamiento.second_std_1_10;
      const secondPub_11   = anyPuppy ? PRICES.publico.alojamiento.second_puppy_11   : PRICES.publico.alojamiento.second_std_11;
      const secondAux_1_10 = anyPuppy ? PRICES.auxiliar.alojamiento.second_puppy_1_10 : PRICES.auxiliar.alojamiento.second_std_1_10;
      const secondAux_11   = anyPuppy ? PRICES.auxiliar.alojamiento.second_puppy_11   : PRICES.auxiliar.alojamiento.second_std_11;

      if(d1_10>0) pushLine(`Alojamiento · ${extraCount} mascota(s) extra · días 1–10`, d1_10, "día", secondPub_1_10*extraCount, secondAux_1_10*extraCount);
      if(d11>0)   pushLine(`Alojamiento · ${extraCount} mascota(s) extra · desde día 11`, d11, "día", secondPub_11*extraCount,   secondAux_11*extraCount);
    }
  }

  if(s==="visita_gato"){
    const long = nDays>=11;
    const is90 = payload.visitDuration==="90";
    const basePub = is90 ? (long?PRICES.publico.visita_gato.base90_11:PRICES.publico.visita_gato.base90_1_10)
                         : (long?PRICES.publico.visita_gato.base60_11:PRICES.publico.visita_gato.base60_1_10);
    const baseAux = is90 ? (long?PRICES.auxiliar.visita_gato.base90_11:PRICES.auxiliar.visita_gato.base90_1_10)
                         : (long?PRICES.auxiliar.visita_gato.base90_1_10:PRICES.auxiliar.visita_gato.base90_1_10);
    // Base (por día)
    pushLine(`Visita gato · ${is90?90:60}’`, nDays, "día", basePub, baseAux);

    // 2ª visita medicación (por día)
    if(payload.secondMedVisit==="si"){
      const medPub = long?PRICES.publico.visita_gato.med15_11:PRICES.publico.visita_gato.med15_1_10;
      const medAux = medPub; // margen 0
      pushLine("2ª visita medicación 15’", nDays, "día", medPub, medAux);
    }

    // Gatos extra por visita (por día)
    // Cuenta gatos seleccionados; si no hay, usa numPets
    let cats = petsSel.filter(p=>(p.especie||"").toLowerCase()==="gato").length;
    if(cats===0) cats = Math.max(1, payload.numPets||1);
    const extraCats = Math.max(0, cats-1);
    if(extraCats>0){
      let addPubPerVisit=0, addAuxPerVisit=0;
      if(extraCats===1){
        addPubPerVisit = PRICES.publico.visita_gato.extraCats.one;
        addAuxPerVisit = PRICES.auxiliar.visita_gato.extraCatsEach.one;
      }else if(extraCats===2){
        addPubPerVisit = PRICES.publico.visita_gato.extraCats.twoEach*2;
        addAuxPerVisit = PRICES.auxiliar.visita_gato.extraCatsEach.twoEach*2;
      }else{
        addPubPerVisit = PRICES.publico.visita_gato.extraCats.threePlusEach*extraCats;
        addAuxPerVisit = PRICES.auxiliar.visita_gato.extraCatsEach.threePlusEach*extraCats;
      }
      pushLine(`Gatos extra (${extraCats})`, nDays, "día", addPubPerVisit, addAuxPerVisit);
    }
  }

  if(s==="exoticos"){
    const long = nDays>=11;
    const kind = payload.exoticoType || "aves";
    const n = Math.max(1, payload.numPets||1);

    if(kind==="aves" || kind==="reptiles"){
      const pub = long ? PRICES.publico.exoticos[`${kind}_11`] : PRICES.publico.exoticos[`${kind}_1_10`];
      const aux = long ? PRICES.auxiliar.exoticos[`${kind}_11`] ?? 0 : 0; // solo definido d11
      pushLine(`Exóticos · ${cap(kind)}`, nDays, "día", pub, aux);
      // NO recargo por segunda mascota (información)
      if(n>1){
        lines.push({label:`Nota: ${n} ${kind} (sin recargo por 2ª+)`, amount:0, aux:0, note:true});
      }
    }else{ // pequeños mamíferos
      const firstPub = long?PRICES.publico.exoticos.mamif_11_first:PRICES.publico.exoticos.mamif_1_10_first;
      const firstAux = long?PRICES.auxiliar.exoticos.mamif_11_first:0;
      pushLine(`Exóticos · Pequeños mamíferos · 1ª mascota`, nDays, "día", firstPub, firstAux);

      const extra = Math.max(0, n-1);
      if(extra>0){
        const secondPub = long?PRICES.publico.exoticos.mamif_11_second:PRICES.publico.exoticos.mamif_1_10_second;
        const secondAux = long?PRICES.auxiliar.exoticos.mamif_11_second:0;
        pushLine(`Exóticos · Pequeños mamíferos · ${extra} mascota(s) extra`, nDays, "día", secondPub*extra, secondAux*extra);
      }
    }
  }

  if(s==="transporte"){
    pushLine("Transporte", 1, null, PRICES.publico.transporte.base, PRICES.auxiliar.transporte.base);
  }

  // Suplementos globales (cliente) y coste auxiliar
  if(big){
    lines.push({label:"Día señalado", amount:PRICES.publico.suplementos.señalado, aux:PRICES.auxiliar.suplementos.señalado});
    totalPublic += PRICES.publico.suplementos.señalado;
    costAux     += PRICES.auxiliar.suplementos.señalado;
  }
  // Festivo normal / urgencia se controlarían con flags si los activas en UI

  // Cachorro info (visual)
  if(anyPuppy && (s==="guarderia_dia" || s==="alojamiento_nocturno")){
    lines.push({label:"Cachorro (≤6 m) aplicado", amount:0, aux:0, note:true});
  }

  const payNow   = Math.max(0, totalPublic - costAux); // margen
  const payLater = Math.max(0, costAux);

  return { linesPublic:lines, totalPublic, payNow, payLater };
}

function renderSummary(calc, payload){
  $("#summaryContext").textContent =
    `${labelService(payload.serviceType)} · ${payload.startDate||"—"}${payload.endDate?(" — "+payload.endDate):""}${payload.startTime?(" · "+payload.startTime):""}${payload.endTime?("–"+payload.endTime):""} · ${Math.max(1,payload.numPets||1)} mascota(s)`;

  const box=$("#summaryLines"); box.innerHTML="";
  calc.linesPublic.forEach(l=>{
    const row=document.createElement("div");
    row.className="line";
    row.innerHTML = `<span class="label">${l.label}${l.note?` <span class="note">(informativo)</span>`:""}</span><span>${l.note?'<span class="note">—</span>':fmtMoney(l.amount)}</span>`;
    box.appendChild(row);
  });

  $("#subtotalTxt").textContent = fmtMoney(calc.totalPublic);
  $("#payNowTxt").textContent   = fmtMoney(calc.payNow);
  $("#payLaterTxt").textContent = fmtMoney(calc.payLater);
}

function doRecalc(){
  const payload = collectPayload();
  $("#visitCatControls").style.display = (payload.serviceType==="visita_gato") ? "" : "none";
  $("#exoticosControls").style.display = (payload.serviceType==="exoticos") ? "" : "none";

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
    service: svc,
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

  // Preselección de servicio
  preselectService();

  // Binds de recálculo
  ["serviceType","startDate","endDate","startTime","endTime","region","address","postalCode",
   "visitDuration","secondMedVisit","numPets","exoticoType","exoticoNum"]
    .forEach(id=>{ const el=$("#"+id); if(el) el.addEventListener("input", doRecalc); });

  // Si cambias numPets manualmente y difiere de selección, aviso suave
  $("#numPets")?.addEventListener("change", ()=>{
    const n = Number($("#numPets").value||1);
    const sel = STATE.selectedPetIds.length;
    if($("#serviceType").value!=="exoticos" && sel>0 && n!==sel){
      console.log("Aviso: nº de mascotas distinto de las seleccionadas en tarjetas.");
    }
    doRecalc();
  });

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
      STATE.owner = owner||{};
      fillOwner(owner||{});

      // Mezcla mascotas firestore + locales (evitar duplicados)
      const localPets = udbGet("pets", []) || udbGet("mascotas", []) || [];
      const merged = [
        ...(pets||[]),
        ...localPets.map((p,i)=>({ id:p.id||`loc_${i}`, nombre:p.nombre, especie:(p.especie||p.tipo||"").toLowerCase(), nacimiento:p.nacimiento||p.birthdate||"", raza:p.raza||p.tipoExotico||"", sexo:p.sexo||p.genero||"", castrado:(p.castrado??p.esterilizado??false)?true:false, foto:p.foto||"" }))
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

    // Mostrar controles según preselección
    $("#visitCatControls").style.display = ($("#serviceType").value==="visita_gato") ? "" : "none";
    $("#exoticosControls").style.display = ($("#serviceType").value==="exoticos") ? "" : "none";

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
        service: { type: payload.serviceType, exoticoType: payload.exoticoType || null },
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
          contactPref: $("#contactPref")?.value || "Cualquiera",
          contactTime: $("#contactTime")?.value || ""
        },
        pets: payload.pets,
        pricing: {
          breakdownPublic: c.linesPublic,
          totalClient: Number(c.totalPublic.toFixed(2)),
          payNow: Number(c.payNow.toFixed(2)),     // margen
          payLater: Number(c.payLater.toFixed(2)), // coste auxiliar
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

      // UI gracias
      $("#reservaForm").style.display="none";
      $("#thanks").style.display="block";
    });
  });
});
