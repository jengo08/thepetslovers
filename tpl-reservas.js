/* reservas.js — The Pets Lovers
   Handler v3: UI + cálculo + envío (Firestore + EmailJS) + diagnóstico
*/

/* ===================== Utilidades base ===================== */

const PRICES = {
  base: { visitas: 22, paseos: 12, guarderia: 15, alojamiento: 30, bodas: 0, postquirurgico: 0, transporte: 0, exoticos: 0 },
  puppyBase: { guarderia: 20, alojamiento: 35 },
  visita60: 22, visita90: 30,
  visita60_larga: 18, visita90_larga: 27,
  visitaMed: 12, visitaMed_larga: 10,
  depositPct: 0.20
};
const BUNDLE_GUARDERIA = {
  adult:  { 10: 135, 20: 250, 30: 315 },
  puppy:  { 10: 185, 20: 350, 30: 465 }
};

function byId(id){ return document.getElementById(id); }
function currency(n){ return (Math.round((n || 0) * 100) / 100).toFixed(2); }
function debounce(fn, wait=300){ let t; return (...a)=>{ clearTimeout(t); t=setTimeout(()=>fn(...a), wait); }; }
const qs = (k) => new URLSearchParams(location.search).get(k);

/* ===================== DOM refs ===================== */
const form = byId('bookingForm');
const wall = byId('authWall');

const els = {
  service: byId('service'),
  region: byId('region'),
  startDate: byId('startDate'),
  endDate: byId('endDate'),
  start: byId('start'),
  end: byId('end'),

  address: byId('location'),
  addrSuggest: byId('tplAddrSuggest'),
  postalCode: byId('postalCode'),

  species: byId('species'),
  isPuppy: byId('isPuppy'),
  numPets: byId('numPets'),
  numPetsExact: byId('numPetsExact'),

  needTravel: byId('needTravel'),
  travelBubble: byId('travelBubble'),

  visitDuration: byId('visitDuration'),
  visitDaily: byId('visitDaily'),
  fieldVisitDuration: byId('fieldVisitDuration'),
  fieldVisitDaily: byId('fieldVisitDaily'),

  firstName: byId('firstName'),
  lastName: byId('lastName'),
  phone: byId('phone'),
  email: byId('email'),
  contactTime: byId('contactTime'),

  petsContainer: byId('petsContainer'),
  petsListHidden: byId('petsListHidden'),
  petNamesList: byId('tplPetNamesList'),

  // resumen
  sumBase: byId('sumBase'),
  sumVisit1: byId('sumVisit1'),
  sumVisit2: byId('sumVisit2'),
  rowVisit1: byId('rowVisit1'),
  rowVisit2: byId('rowVisit2'),
  sumPets: byId('sumPets'),
  sumFestivo: byId('sumFestivo'),
  sumSenalado: byId('sumSenalado'),
  sumTravel: byId('sumTravel'),
  sumBono: byId('sumBono'),
  rowBono: byId('rowBono'),
  sumSubtotal: byId('sumSubtotal'),
  sumDeposit: byId('sumDeposit'),

  summaryField: byId('summaryField'),
};

/* ===================== Prefill por URL/referrer ===================== */
(function presetService(){
  if(!els.service) return;
  const map = {
    visitas:'visitas','visitas-gatos':'visitas',
    paseos:'paseos',
    guarderia:'guarderia','guarderia-dia':'guarderia',
    alojamiento:'alojamiento','estancias':'alojamiento',
    bodas:'bodas','boda':'bodas',
    postquirurgico:'postquirurgico','post-quirurgico':'postquirurgico','postquirugico':'postquirurgico',
    transporte:'transporte',
    exoticos:'exoticos','exotico':'exoticos'
  };
  const raw = (qs('service') || qs('svc') || '').toLowerCase();
  const norm = raw.normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-z0-9]+/g,'-');
  let val = map[norm] || null;
  if(!val){
    try{
      const u = new URL(document.referrer || '');
      const p = (u.pathname || '').toLowerCase();
      if(p.includes('guarderia')) val='guarderia';
      else if(p.includes('estancias')||p.includes('alojamiento')) val='alojamiento';
      else if(p.includes('paseos')) val='paseos';
      else if(p.includes('visitas')) val='visitas';
      else if(p.includes('bodas')) val='bodas';
      else if(p.includes('postquir')) val='postquirurgico';
      else if(p.includes('transporte')) val='transporte';
      else if(p.includes('exotico')) val='exoticos';
    }catch(_){}
  }
  if(val){ els.service.value = val; }
})();

/* ===================== UI dinámico ===================== */
function toggleFields(){
  const svc = els.service?.value;
  const isVisitas = (svc === 'visitas');
  form?.classList.toggle('tpl-visitas-on', isVisitas);

  if(els.fieldVisitDuration) els.fieldVisitDuration.hidden = !isVisitas;
  if(els.fieldVisitDaily) els.fieldVisitDaily.hidden = !isVisitas;

  if(els.visitDuration){ els.visitDuration.disabled = !isVisitas; if(!isVisitas) els.visitDuration.value='60'; }
  if(els.visitDaily){ els.visitDaily.disabled =
