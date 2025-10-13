/****************************************************
 * TPL · RESERVAS (COMPLETO · para reservas.html remaquetado)
 * - Mantiene IDs y comportamiento del flujo actual
 * - Autorelleno titular + mascotas (Firestore users/… o propietarios/… + subcolección mascotas)
 * - Picker de mascotas (tarjetas con checkbox)
 * - Preselección de servicio desde ?service= / ?svc= o referrer
 * - Cálculo y resumen (Subtotal / Pagar ahora / Pendiente)
 * - Login inline sin salir de la página
 * - Guarda localmente la reserva para mostrar en perfil
 * - EmailJS opcional (solo si window.TPL_EMAILJS.enabled === true)
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

/************** Etiquetas y precios públicos **************/
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

const BIG_DAYS = ["12-24","12-25","12-31","01-01"]; // MM-DD
const PRICES_PUBLIC = {
  paseo: { base:12, extra:8 },
  transporte: { base:20 },
  guarderia: { adult:15, puppy:20 },
  alojamiento: { std:30, puppy:35, segundo:25 },
  visita: { base60:22, base90:30, d11_60:18, d11_90:27, med15:12, med15_d11:10 }
};

/************** Preselección de servicio **************/
function canonicalizeService(raw){
  if(!raw) return "";
  const s = String(raw).toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'');
  const map = {
    'paseo':'paseo','paseos':'paseo',
    'guarderia':'guarderia_dia','guarderia-de-dia':'guarderia_dia','guarderia_dia':'guarderia_dia',
    'alojamiento':'alojamiento_nocturno','estancias':'alojamiento_nocturno','nocturnas':'alojamiento_nocturno','estancias-nocturnas':'alojamiento_nocturno',
    'visitas':'visita_gato','visita-gato':'visita_gato','visita':'visita_gato',
    'exoticos':'exoticos_aves','exoticos-aves':'exoticos_aves','aves':'exoticos_aves',
    'exoticos-reptiles':'exoticos_reptiles','reptiles':'exoticos_reptiles',
    'exoticos-mamiferos':'exoticos_mamiferos','mamiferos':'exoticos_mamiferos',
    'transporte':'transporte'
  };
  const allowed = new Set(['paseo','guarderia_dia','alojamiento_nocturno','visita_gato','exoticos_aves','exoticos_reptiles','exoticos_mamiferos','transporte']);
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
    if(/exotico|exoticos/.test(p) && /ave|aves/.test(p)) return 'exoticos_aves';
    if(/exotico|exoticos/.test(p) && /reptil|reptiles/.test(p)) return 'exoticos_reptiles';
    if(/exotico|exoticos/.test(p) && /mamifer/.test(p)) return 'exoticos_mamiferos';
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
      ? `<img class="pet-thumb" src="${p.foto}" alt="${p.nombre||'Mascota'}">`
      : `<div class="pet-icon"><i class="fa-solid fa-paw"></i></div>`;

    const el=document.createElement("label");
    el.className="pet-item";
    el.innerHTML = `
      <input type="checkbox" class="pet-check" data-id="${p.id}" style="margin-right:6px;width:18px;height:18px">
      ${iconHtml}
      <div style="display:flex;flex-direction:column;line-height:1.25">
        <strong>${p.nombre||"Mascota"}</strong>
        <span class="muted">${(p.especie||'').toLowerCase()}</span>
      </div>
    `;
    grid.appendChild(el);
  });

  if(!(pets||[]).length){
    grid.innerHTML = `
      <div class="pet-item">
        <div><strong style="color:#666">No hay mascotas en tu perfil</strong>
        <div class="muted">Añádelas en tu perfil para seleccionarlas aquí.</div></div>
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
  return {
    serviceType: $("#serviceType").value,
    startDate: $("#startDate").value,
    endDate: $("#endDate").value || $("#startDate").value,
    startTime: $("#startTime").value,
    endTime: $("#endTime").value,
    region: $("#region").value,
    address: $("#address").value,
    postalCode: $("#postalCode").value,
    travelNeeded: $("#travelNeeded")?.value || "no",
    visitDuration: $("#visitDuration")?.value || "60",
    secondMedVisit: $("#secondMedVisit")?.value || "no",
    pets
  };
}

/************** Cálculo + resumen **************/
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
    const anyPuppy = payload.pets.some(p=>{
      if(p.especie!=="perro" || !p.nacimiento) return false;
      const months = (Date.now() - new Date(p.nacimiento).getTime()) / 2629800000;
      return months <= 6;
    });
    const perDay = anyPuppy ? PRICES_PUBLIC.guarderia.puppy : PRICES_PUBLIC.guarderia.adult;
    lines.push({label:`Guardería · ${nDays} día(s)`, amount:perDay*nDays});
    total += perDay*nDays;
  }

  if(s==="alojamiento_nocturno"){
    const first = payload.pets[0];
    const firstPuppy = first && first.especie==="perro" && first.nacimiento &&
      ( (Date.now()-new Date(first.nacimiento).getTime())/2629800000 <= 6 );
    const firstPrice = firstPuppy?PRICES_PUBLIC.alojamiento.puppy:PRICES_PUBLIC.alojamiento.std;
    lines.push({label:`Alojamiento · 1ª mascota · ${nDays} día(s)`, amount:firstPrice*nDays});
    total+=firstPrice*nDays;

    const secondCount=Math.max(0,(payload.pets.length-1));
    if(secondCount>0){
      const add = PRICES_PUBLIC.alojamiento.segundo * nDays * secondCount;
      lines.push({label:`Alojamiento · ${secondCount} mascota(s) extra`, amount:add});
      total+=add;
    }
  }

  if(s==="visita_gato"){
    const use90 = payload.visitDuration==="90";
    const long = nDays>=11;
    const base = use90 ? (long?PRICES_PUBLIC.visita.d11_90:PRICES_PUBLIC.visita.base90)
                       : (long?PRICES_PUBLIC.visita.d11_60:PRICES_PUBLIC.visita.base60);
    lines.push({label:`Visita gato · ${use90?90:60}’`, amount:base});
    total+=base;

    if(payload.secondMedVisit==="si"){
      const med = long?PRICES_PUBLIC.visita.med15_d11:PRICES_PUBLIC.visita.med15;
      lines.push({label:`2ª visita medicación 15’`, amount:med});
      total+=med;
    }

    const cats = payload.pets.filter(p=>p.especie==="gato").length || payload.pets.length || 1;
    const extraCats = Math.max(0, cats-1);
    if(extraCats>0){
      const add = extraCats===1 ? 12 : (extraCats===2 ? 16 : 6*extraCats);
      lines.push({label:`Gatos extra (${extraCats})`, amount:add});
      total+=add;
    }
  }

  if(s==="transporte"){
    lines.push({label:"Transporte", amount:PRICES_PUBLIC.transporte.base});
    total+=PRICES_PUBLIC.transporte.base;
  }

  const big = BIG_DAYS.includes(fmtMD(payload.startDate)) || BIG_DAYS.includes(fmtMD(payload.endDate));
  if(big){ lines.push({label:"Día señalado", amount:30}); total+=30; }

  if(payload.travelNeeded==="si"){
    lines.push({label:"Desplazamiento", note:"pendiente"});
  }

  const payNow   = Math.max(0, total * 0.20);
  const payLater = Math.max(0, total - payNow);
  return { linesPublic:lines, totalPublic:total, payNow, payLater };
}

function renderSummary(calc, payload){
  $("#summaryContext").textContent =
    `${labelService(payload.serviceType)} · ${payload.startDate||"—"}${payload.endDate?(" — "+payload.endDate):""}${payload.startTime?(" · "+payload.startTime):""}${payload.endTime?("–"+payload.endTime):""} · ${(payload.pets||[]).length||0} mascota(s)`;

  const box=$("#summaryLines"); box.innerHTML="";
  calc.linesPublic.forEach(l=>{
    const row=document.createElement("div");
    row.className="line";
    row.innerHTML = `<span>${l.label}</span><span>${l.note?'<span class="muted">pendiente</span>':fmtMoney(l.amount)}</span>`;
    box.appendChild(row);
  });

  $("#subtotalTxt").textContent = fmtMoney(calc.totalPublic);
  $("#payNowTxt").textContent   = fmtMoney(calc.payNow);
  $("#payLaterTxt").textContent = fmtMoney(calc.payLater);
}

function doRecalc(){
  const payload = collectPayload();
  $("#visitCatControls").style.display = (payload.serviceType==="visita_gato") ? "" : "none";

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
  ["serviceType","startDate","endDate","startTime","endTime","region","address","postalCode","travelNeeded","visitDuration","secondMedVisit"]
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
        ...localPets.map((p,i)=>({ id:p.id||`loc_${i}`, nombre:p.nombre, especie:(p.especie||p.tipo||"").toLowerCase(), nacimiento:p.nacimiento||p.birthdate||"", raza:p.raza||p.tipoExotico||"", sexo:p.sexo||p.genero||"", foto:p.foto||"" }))
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

    // Mostrar controles visita gato si aplica
    $("#visitCatControls").style.display =
      ($("#serviceType").value==="visita_gato") ? "" : "none";

    doRecalc();

    // CTA reservar
    $("#btnReserve").addEventListener("click", async ()=>{
      const payload=collectPayload();
      if(!payload.serviceType || !payload.startDate || !payload.endDate){
        alert("Selecciona servicio y fechas de inicio/fin."); return;
      }
      if(!STATE.selectedPetIds.length){
        alert("Elige al menos una mascota."); return;
      }

      const c=calc(payload);
      const reservation = {
        id: "resv_"+Date.now(),
        status: "paid_review",
        createdAt: nowISO(),
        region: payload.region,
        service: { type: payload.serviceType },
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

      // UI gracias
      $("#reservaForm").style.display="none";
      $("#thanks").style.display="block";
    });
  });
});

/* ============================================================
   UI: tarjetas de mascotas compactas (lista vertical, mini avatar)
   - SIN ARCHIVOS NUEVOS
   - No toca la lógica: solo maqueta las tarjetas ya renderizadas
   ============================================================ */
(function(){
  var _origRender = window.renderPetsGrid;

  // util: capitalizar primera letra
  function cap(s){ s=String(s||''); return s? s.charAt(0).toUpperCase()+s.slice(1) : s; }

  // Años aproximados desde nacimiento
  function calcAge(birth){
    if(!birth) return "";
    var d = new Date(birth); if(isNaN(d)) return "";
    var t = new Date();
    var years = t.getFullYear() - d.getFullYear()
              - ((t.getMonth()<d.getMonth()) || (t.getMonth()===d.getMonth() && t.getDate()<d.getDate()) ? 1 : 0);
    return years>=0 ? String(years) : "";
  }

  function normalizeCard(el){
    // etiqueta base
    el.classList.add('tpl-pet-item');

    // checkbox
    var chk = el.querySelector('input[type="checkbox"]');
    if(chk) chk.classList.add('pet-check');

    // foto/icono
    var img = el.querySelector('img');
    var ico = el.querySelector('.pet-icon');
    if(img){ img.classList.add('tpl-pet-thumb'); }
    else if(ico){ ico.classList.add('tpl-pet-thumb'); }

    // contenedor meta
    var meta = el.querySelector('.tpl-pet-meta');
    if(!meta){
      meta = document.createElement('div');
      meta.className = 'tpl-pet-meta';
      var anchor = el.querySelector('img, .tpl-pet-thumb, .pet-icon');
      if(anchor && anchor.nextSibling) anchor.parentNode.insertBefore(meta, anchor.nextSibling);
      else el.appendChild(meta);
    }

    // nombre
    var name = meta.querySelector('.tpl-pet-name') || el.querySelector('strong');
    if(!name){
      name = document.createElement('div');
      name.className='tpl-pet-name';
      meta.appendChild(name);
    }else{
      name.classList.add('tpl-pet-name');
      if(name.parentElement!==meta) meta.prepend(name);
    }

    // sublínea
    var sub = meta.querySelector('.tpl-pet-sub');
    if(!sub){
      sub = document.createElement('div');
      sub.className='tpl-pet-sub';
      meta.appendChild(sub);
    }
  }

  function fillCard(el, pet){
    var name = el.querySelector('.tpl-pet-name');
    if(name) name.textContent = pet.nombre || "Mascota";

    // Para helper de "cachorro"
    if(pet.nacimiento) el.setAttribute('data-birth', pet.nacimiento);
    if(pet.especie)    el.setAttribute('data-species', String(pet.especie).toLowerCase());

    var especie = (pet.especie||"").toString().trim();
    var raza    = (pet.raza||"").toString().trim();
    var edadY   = calcAge(pet.nacimiento||"");
    var sexo    = (pet.sexo||"").toString().trim(); // macho/hembra

    var bits=[];
    if(especie) bits.push(cap(especie));
    if(raza)    bits.push(raza);
    if(edadY)   bits.push("Edad: "+edadY);
    if(sexo)    bits.push(cap(sexo));

    var sub = el.querySelector('.tpl-pet-sub');
    if(sub) sub.textContent = bits.join(" · ");
  }

  function enhance(pets){
    var grid = document.getElementById('petsGrid'); if(!grid) return;
    var cards = grid.querySelectorAll('label, .pet-item, .tpl-pet-item');

    cards.forEach(function(card){
      normalizeCard(card);
      // localizar pet por data-id del checkbox
      var id = card.querySelector('.pet-check')?.getAttribute('data-id');
      var p = id ? (pets||[]).find(x => String(x.id)===String(id)) : null;
      if(p) fillCard(card, p);
    });

    // Recalcular display de cachorro si tu helper existe
    try{ if(typeof __updatePuppyDisplay==='function') __updatePuppyDisplay(); }catch(_){}
  }

  // Hook al render original de tus tarjetas
  window.renderPetsGrid = function(pets){
    // llama a tu función original
    if(typeof _origRender === 'function') _origRender(pets);
    // y luego maqueta
    enhance(pets||STATE.pets||[]);
  };

  // Si por cualquier motivo se pintó antes de hookear:
  document.addEventListener('DOMContentLoaded', function(){
    if($('#petsGrid')?.children?.length){
      enhance(STATE?.pets||[]);
    }
  });
})();
