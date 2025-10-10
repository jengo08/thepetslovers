/***** Helpers *****/
const $ = (s,root=document)=>root.querySelector(s);
const $$ = (s,root=document)=>Array.from(root.querySelectorAll(s));
const fmt = n => (typeof n!=="number"||isNaN(n))?"—":n.toFixed(2).replace(".",",")+" €";
const parseDate = v => { const d=new Date(v); return isNaN(d)?null:d; };
function nowISO(){ return new Date().toISOString(); }
function daysInclusive(a,b){ const A=parseDate(a), B=parseDate(b||a); if(!A||!B) return 0; const d=Math.round((B-A)/86400000); return d>=0?d+1:0; }

/***** Auth *****/
function onAuth(cb){
  try{ return firebase.auth().onAuthStateChanged(cb); }catch(_){ cb(null); return ()=>{}; }
}

/***** Firestore owner+pets (lee primero users/{uid}) *****/
async function readOwnerAndPets(uid){
  const db=firebase.firestore();
  async function read(coll){
    try{ const s=await db.collection(coll).doc(uid).get(); return s.exists?{ref:s.ref,data:s.data()}:null; }catch(_){ return null; }
  }
  const hit = await read("users") || await read("propietarios") || await read("owners") || await read("usuarios") || await read("perfiles");
  const d = hit?.data || {};
  const nombre   = d.nombre || d.name || d.Nombre || "";
  const apellido = d.apellido || d.apellidos || d.surname || d.Apellidos || "";
  const fullName = d.fullName || [nombre,apellido].filter(Boolean).join(" ").trim() || (firebase.auth().currentUser?.displayName||"");
  const phone    = d.phone || d.telefono || d.tlf || d.Telefono || "";
  const region   = d.region || d.comunidad || d.comunidadAutonoma || d.ccaa || d.CCAA || "";
  const address  = d.address || d.direccion || d.Direccion || "";
  const postal   = d.postalCode || d.cp || d.codigo_postal || d.codigoPostal || d.CP || "";
  const email    = d.email || firebase.auth().currentUser?.email || "";

  let pets = Array.isArray(d.pets)?d.pets:(Array.isArray(d.mascotas)?d.mascotas:[]);
  if(!pets.length && hit?.ref){
    try{
      const sub=await hit.ref.collection("mascotas").get();
      pets=sub.docs.map((doc,i)=>({ id: doc.id, nombre: (doc.data().nombre||"Mascota"), especie: (doc.data().especie||doc.data().tipo||"").toLowerCase(), foto: doc.data().foto||"", nacimiento: doc.data().birthdate||doc.data().nacimiento||"" }));
    }catch(e){ console.warn("[mascotas] subcolección inaccesible:", e); }
  }
  return { owner:{fullName,email,phone,region,address,postalCode:postal}, pets };
}

/***** Fallback perfil local (udb) *****/
function getUID(){ try{ return firebase.auth().currentUser?.uid || localStorage.getItem('tpl_auth_uid') || 'default'; }catch(_){ return 'default'; } }
function udbKey(k){ return `tpl.udb.${getUID()}.${k}`; }
function udbGet(k,fb){ try{ const v=localStorage.getItem(udbKey(k)); return v?JSON.parse(v):fb; }catch(_){ return fb; } }

/***** UI: rellenar titular *****/
function setSelectValue(selectId, value){
  const el = document.getElementById(selectId);
  if (!el || !value) return;
  const hit = Array.from(el.options).some(o => (o.value||o.text).trim().toLowerCase() === String(value).trim().toLowerCase());
  if(hit){ el.value = Array.from(el.options).find(o=> (o.value||o.text).trim().toLowerCase()===String(value).trim().toLowerCase()).value; return; }
  const opt=document.createElement("option"); opt.value=String(value); opt.text=String(value); opt.dataset.injected="1"; el.appendChild(opt); el.value=opt.value;
}
function fillOwner(owner){
  $("#ownerFullName").value = owner.fullName || "";
  $("#email").value = owner.email || "";
  $("#phone").value = owner.phone || "";
  setSelectValue("region", owner.region || "");
  $("#address").value = owner.address || "";
  $("#postalCode").value = owner.postalCode || "";
}

/***** Mascotas – vista tipo “tarjetas” + picker *****/
let STATE = { owner:null, pets:[], selectedPetIds:[] };

function renderPetsGrid(pets){
  const grid=$("#petsGrid"); grid.innerHTML="";
  (pets||[]).forEach(p=>{
    const icon = p.foto ? `<img class="tpl-pet-thumb" src="${p.foto}" alt="${p.nombre||'Mascota'}">`
                        : `<div class="tpl-pet-icon"><i class="fa-solid fa-paw"></i></div>`;
    const el=document.createElement("label"); el.className="tpl-pet-item";
    el.innerHTML = `
      <input type="checkbox" class="pet-check" data-id="${p.id}" style="margin-right:6px;width:18px;height:18px">
      ${icon}
      <div style="display:flex;flex-direction:column">
        <strong>${p.nombre||"Mascota"}</strong>
        <span style="color:#666">${(p.especie||'').toLowerCase()}</span>
      </div>`;
    grid.appendChild(el);
  });
  grid.addEventListener("change", ()=>{ STATE.selectedPetIds = $$(".pet-check:checked").map(x=>x.dataset.id); doRecalc(); });
  if(!(pets||[]).length){
    grid.innerHTML = `<div class="tpl-pet-item"><div><strong style="color:#666">No hay mascotas en tu perfil</strong><div class="muted">Añádelas en tu perfil para seleccionarlas aquí.</div></div></div>`;
  }
}

/***** Cálculo (usamos tu resumen) *****/
const BIG_DAYS = ["12-24","12-25","12-31","01-01"];
const PRICES_PUBLIC = { paseo:{base:12, extra:8}, transporte:{base:20}, guarderia:{adult:15, puppy:20}, alojamiento:{std:30, puppy:35, segundo:25}, visita:{base60:22, base90:30, d11_60:18, d11_90:27, med15:12, med15_d11:10} };
function fmtMD(dateStr){ const d=parseDate(dateStr); if(!d)return""; const m=String(d.getMonth()+1).padStart(2,"0"), dd=String(d.getDate()).padStart(2,"0"); return `${m}-${dd}`; }
function labelService(s){ return ({guarderia_dia:"Guardería de día", alojamiento_nocturno:"Alojamiento nocturno", paseo:"Paseo", visita_gato:"Visita gato", exoticos_aves:"Visita exóticos (aves)", exoticos_reptiles:"Visita exóticos (reptiles)", exoticos_mamiferos:"Visita exóticos (mamíferos)", transporte:"Transporte"})[s]||s; }

function collectPayload(){
  const pets = STATE.pets.filter(p=>STATE.selectedPetIds.includes(p.id));
  return {
    serviceType: $("#serviceType").value,
    startDate: $("#startDate").value,
    endDate: $("#endDate").value || $("#startDate").value,
    startTime: $("#startTime").value,
    endTime: $("#endTime").value,
    region: $("#region").value,
    address: $("#address").value,
    postalCode: $("#postalCode").value,
    travelNeeded: $("#travelNeeded").value,
    visitDuration: $("#visitDuration")?.value || "60",
    secondMedVisit: $("#secondMedVisit")?.value || "no",
    pets
  };
}

function calc(payload){
  const s = payload.serviceType;
  const nDays = Math.max(1, daysInclusive(payload.startDate, payload.endDate));
  let lines=[], total=0;

  if(s==="paseo"){
    lines.push({label:"Paseo (60’)", amount:PRICES_PUBLIC.paseo.base});
    const extra = Math.max(0,(payload.pets.length||1)-1)*PRICES_PUBLIC.paseo.extra;
    if(extra) lines.push({label:"Mascotas adicionales", amount:extra});
    total += PRICES_PUBLIC.paseo.base + extra;
  }
  if(s==="guarderia_dia"){
    const puppy = payload.pets.some(p=>p.especie==="perro" && p.nacimiento && ((Date.now()-new Date(p.nacimiento))/2629800000)<=6);
    const perDay = puppy?PRICES_PUBLIC.guarderia.puppy:PRICES_PUBLIC.guarderia.adult;
    lines.push({label:`Guardería · ${nDays} día(s)`, amount:perDay*nDays});
    total += perDay*nDays;
  }
  if(s==="alojamiento_nocturno"){
    const first = payload.pets[0]; const secondCount=Math.max(0,(payload.pets.length-1));
    const firstPuppy = first && first.especie==="perro" && first.nacimiento && ((Date.now()-new Date(first.nacimiento))/2629800000)<=6;
    const firstPrice = firstPuppy?PRICES_PUBLIC.alojamiento.puppy:PRICES_PUBLIC.alojamiento.std;
    lines.push({label:`Alojamiento · 1ª mascota · ${nDays} día(s)`, amount:firstPrice*nDays}); total+=firstPrice*nDays;
    if(secondCount>0){ lines.push({label:`Alojamiento · ${secondCount} mascota(s) extra`, amount:PRICES_PUBLIC.alojamiento.segundo*nDays*secondCount}); total+=PRICES_PUBLIC.alojamiento.segundo*nDays*secondCount; }
  }
  if(s==="visita_gato"){
    const use90 = payload.visitDuration==="90";
    const long = nDays>=11;
    const base = use90 ? (long?PRICES_PUBLIC.visita.d11_90:PRICES_PUBLIC.visita.base90)
                       : (long?PRICES_PUBLIC.visita.d11_60:PRICES_PUBLIC.visita.base60);
    lines.push({label:`Visita gato · ${use90?90:60}’`, amount:base});
    total+=base;
    if(payload.secondMedVisit==="si"){
      lines.push({label:`2ª visita medicación 15’`, amount: long?PRICES_PUBLIC.visita.med15_d11:PRICES_PUBLIC.visita.med15});
      total += long?PRICES_PUBLIC.visita.med15_d11:PRICES_PUBLIC.visita.med15;
    }
    const extraCats = Math.max(0,(payload.pets.filter(p=>p.especie==="gato").length||1)-1);
    if(extraCats>0){ const add = extraCats===1?12: (extraCats===2?16:6*extraCats); lines.push({label:`Gatos extra (${extraCats})`, amount:add}); total+=add; }
  }
  if(s==="transporte"){ lines.push({label:"Transporte", amount:PRICES_PUBLIC.transporte.base}); total+=PRICES_PUBLIC.transporte.base; }

  const big = BIG_DAYS.includes(fmtMD(payload.startDate))||BIG_DAYS.includes(fmtMD(payload.endDate));
  if(big){ lines.push({label:"Día señalado", amount:30}); total+=30; }
  if(payload.travelNeeded==="si"){ lines.push({label:"Desplazamiento", note:"pendiente"}); }

  const payNow = Math.max(0, total*0.2); // margen/deposito simple para el resumen
  const payLater = Math.max(0, total - payNow);
  return { linesPublic:lines, totalPublic:total, payNow, payLater };
}

function renderSummary(calc, payload){
  $("#summaryContext").textContent = `${labelService(payload.serviceType)} · ${payload.startDate||"—"}${payload.endDate?(" — "+payload.endDate):""}`;
  const box=$("#summaryLines"); box.innerHTML="";
  calc.linesPublic.forEach(l=>{
    const row=document.createElement("div"); row.className="line";
    row.innerHTML=`<span>${l.label}</span><span>${l.note?'<span class="muted">pendiente</span>':fmt(l.amount)}</span>`;
    box.appendChild(row);
  });
  $("#subtotalTxt").textContent=fmt(calc.totalPublic);
  $("#payNowTxt").textContent=fmt(calc.payNow);
  $("#payLaterTxt").textContent=fmt(calc.payLater);
}

function doRecalc(){
  const payload=collectPayload();
  if(!payload.serviceType || !payload.startDate || !payload.endDate){ renderSummary({linesPublic:[],totalPublic:0,payNow:0,payLater:0}, payload); return; }
  const c=calc(payload); renderSummary(c,payload);
}

/***** Login inline (no redirige) *****/
function mountInlineLogin(){
  const host=$("#tpl-inline-login"); if(!host) return;
  host.innerHTML = `
    <div class="tpl-login-card">
      <h3 class="tpl-login-title">Accede aquí mismo</h3>
      <form id="tpl-inline-form" class="tpl-login-form" style="display:grid;gap:8px">
        <label>Email</label>
        <input type="email" name="email" required autocomplete="email"/>
        <label>Contraseña</label>
        <input type="password" name="password" required autocomplete="current-password"/>
        <button type="submit" class="tpl-btn">Iniciar sesión</button>
        <button type="button" class="tpl-btn-outline" id="tpl-google-btn"><i class="fa-brands fa-google"></i> Google</button>
        <p class="tpl-login-msg" aria-live="polite"></p>
      </form>
    </div>`;
  const form=$("#tpl-inline-form"), msg=host.querySelector(".tpl-login-msg"), gbtn=$("#tpl-google-btn");
  form.addEventListener("submit", async (e)=>{
    e.preventDefault(); msg.textContent="Accediendo…";
    try{ await firebase.auth().signInWithEmailAndPassword(form.email.value.trim(), form.password.value); msg.textContent="¡Listo!"; location.reload(); }
    catch(err){ msg.textContent = err?.message || "No se pudo iniciar sesión."; }
  });
  gbtn.addEventListener("click", async ()=>{
    msg.textContent="Conectando con Google…"; const provider=new firebase.auth.GoogleAuthProvider();
    try{ await firebase.auth().signInWithPopup(provider); location.reload(); }catch(err){ msg.textContent=err?.message||"No se pudo iniciar con Google."; }
  });
}

/***** INIT *****/
window.addEventListener("load", ()=>{
  // Mostrar/ocultar muro auth y preparar formulario
  onAuth(async (u)=>{
    const gate=$("#sessionGate"); const wall=$("#authWall"); const form=$("#reservaForm");
    if(!u){ gate.style.display="none"; wall.style.display="block"; form.classList.add("disabled"); mountInlineLogin(); return; }
    wall.style.display="none"; form.classList.remove("disabled");

    // Owner + mascotas (Firestore + fallback local)
    try{
      let {owner,pets} = await readOwnerAndPets(u.uid);
      if(!owner?.fullName && udbGet("owner",null)){ const fb=udbGet("owner",{}); owner={ fullName: (fb.nombre||"") + (fb.apellidos?(" "+fb.apellidos):""), email:fb.email||"", phone:fb.telefono||"", region:fb.ccaa||"", address:fb.direccion||"", postalCode:fb.cp||"" }; }
      fillOwner(owner||{});
      // mascotas: mezcla firestore + local sin duplicar
      const localPets = udbGet("pets", []) || udbGet("mascotas", []) || [];
      const all = [...pets, ...localPets.map((p,i)=>({id:p.id||`loc_${i}`, nombre:p.nombre, especie:(p.especie||p.tipo||"").toLowerCase(), foto:p.foto||""}))];
      // quitar duplicados por nombre+especie
      const seen=new Set(); STATE.pets = all.filter(p=>{ const k=(p.nombre||"").toLowerCase()+"|"+(p.especie||""); if(seen.has(k)) return false; seen.add(k); return true; });
      renderPetsGrid(STATE.pets);
    }catch(e){ console.warn("[init] owner/pets", e); }

    // binds
    ["serviceType","startDate","endDate","startTime","endTime","region","address","postalCode","travelNeeded","visitDuration","secondMedVisit"].forEach(id=>{
      const el=$("#"+id); if(el) el.addEventListener("input", doRecalc);
    });

    // Fechas sincronizadas
    $("#startDate").addEventListener("change", ()=>{ if(!$("#endDate").value) $("#endDate").value=$("#startDate").value; if(parseDate($("#endDate").value)<parseDate($("#startDate").value)) $("#endDate").value=$("#startDate").value; doRecalc(); });
    $("#endDate").addEventListener("change",   ()=>{ if($("#startDate").value && parseDate($("#endDate").value)<parseDate($("#startDate").value)) $("#endDate").value=$("#startDate").value; doRecalc(); });

    doRecalc();

    // CTA reservar → guardado local (si quieres, aquí puedes añadir Firestore .add)
    $("#btnReserve").addEventListener("click", ()=>{
      const payload=collectPayload();
      if(!payload.serviceType || !payload.startDate || !payload.endDate){ alert("Selecciona servicio y fechas de inicio/fin."); return; }
      if(!STATE.selectedPetIds.length){ alert("Elige al menos una mascota."); return; }
      const calcRes=calc(payload);
      const reservation = {
        id:"resv_"+Date.now(), createdAt:nowISO(), service:{type:payload.serviceType},
        dates:{startDate:payload.startDate,endDate:payload.endDate,startTime:payload.startTime||null,endTime:payload.endTime||null},
        owner:{
          fullName:$("#ownerFullName").value.trim(), email:$("#email").value.trim(), phone:$("#phone").value.trim(),
          address:$("#address").value.trim(), postalCode:$("#postalCode").value.trim(),
          contactPref:$("#contactPref")?.value||"Cualquiera", contactTime:$("#contactTime")?.value||""
        },
        pets:payload.pets, pricing:{breakdownPublic:calcRes.linesPublic,totalClient:+(calcRes.totalPublic.toFixed(2)),payNow:+(calcRes.payNow.toFixed(2)),payLater:+(calcRes.payLater.toFixed(2)),currency:"EUR"}
      };
      try{ const key="tpl.reservas"; const list=JSON.parse(localStorage.getItem(key)||"[]"); list.unshift(reservation); localStorage.setItem(key, JSON.stringify(list)); }catch(_){}
      $("#reservaForm").style.display="none"; $("#thanks").style.display="block";
    });
  });
});
