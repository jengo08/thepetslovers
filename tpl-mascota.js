/* TPL: INICIO BLOQUE NUEVO [Lógica: preview + razas completas con JSON opcional + guardado temporal + anti-overlay] */
(function(){
  'use strict';

  // ===== Respaldo local de razas (compacto). Si existe tpl-razas.json, cargaremos la lista completa. =====
  let DOG_BREEDS = ["Mestizo","Labrador Retriever","Golden Retriever","Pastor Alemán","Bulldog Francés","Bulldog Inglés","Caniche / Poodle","Chihuahua","Pomerania","Yorkshire Terrier","Shih Tzu","Beagle","Bóxer","Border Collie","Dálmata","Rottweiler","Husky Siberiano","Cocker Spaniel","Teckel / Dachshund","Pastor Belga Malinois","Pastor Australiano"];
  let CAT_BREEDS = ["Mestizo","Europeo Común","Siamés","Persa","Maine Coon","Bengalí","Ragdoll","Sphynx","British Shorthair","Scottish Fold","Azul Ruso","Noruego de Bosque","Bosque de Siberia","Abisinio","Exótico de Pelo Corto"];
  const EXOTIC_TYPES = ["Pájaro","Conejo","Hurón","Hámster","Cobaya","Erizo","Iguana","Lagarto","Camaleón","Serpiente","Rana","Tortuga","Araña","Otro"];

  // Intento de cargar listas completas desde un JSON (opcional). Estructura sugerida:
  // { "perro": ["..."], "gato": ["..."] }
  fetch('tpl-razas.json').then(r=>r.ok?r.json():null).then(j=>{
    if (j){
      if (Array.isArray(j.perro) && j.perro.length) DOG_BREEDS = j.perro;
      if (Array.isArray(j.gato)  && j.gato.length)  CAT_BREEDS = j.gato;
    }
  }).catch(()=>{ /* sin JSON, usamos respaldo local */ });

  // ===== Helpers =====
  const $ = (sel, root=document) => root.querySelector(sel);
  const byId = (id) => document.getElementById(id);
  const setOpts = (datalist, arr) => { datalist.innerHTML = arr.map(x=>`<option value="${escapeHtml(x)}"></option>`).join(''); };
  function escapeHtml(s){ return String(s||'').replace(/[&<>"']/g,m=>({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' }[m])); }

  function resizeToDataURL(file, maxW=256, maxH=256, cb){
    const reader = new FileReader();
    reader.onload = () => {
      const img = new Image();
      img.onload = () => {
        const ratio = Math.min(maxW/img.width, maxH/img.height, 1);
        const w = Math.round(img.width * ratio);
        const h = Math.round(img.height * ratio);
        const canvas = document.createElement('canvas');
        canvas.width = w; canvas.height = h;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img,0,0,w,h);
        const dataUrl = canvas.toDataURL('image/jpeg', 0.7);
        cb(dataUrl);
      };
      img.src = reader.result;
    };
    reader.readAsDataURL(file);
  }

  function getPets(){
    try{ return JSON.parse(sessionStorage.getItem('tpl.pets')||'[]'); }
    catch(e){ return []; }
  }
  function savePets(arr){ sessionStorage.setItem('tpl.pets', JSON.stringify(arr||[])); }

  // ===== Cortafuegos anti overlays / subidas =====
  // Evita que otros scripts intercepten nuestros eventos
  const stopCap = (ev) => { ev.stopImmediatePropagation(); ev.stopPropagation(); };
  document.addEventListener('change', (e)=>{ if (e.target && e.target.id==='foto') stopCap(e); }, true);
  document.addEventListener('input',  (e)=>{ if (e.target && e.target.id==='foto') stopCap(e); }, true);
  document.addEventListener('submit', (e)=>{ if (e.target && e.target.id==='tpl-pet-form'){ e.preventDefault(); stopCap(e); }}, true);
  ['dragenter','dragover','drop'].forEach(evt=>document.addEventListener(evt, e=>{ e.preventDefault(); }, true));

  // ===== Init =====
  document.addEventListener('DOMContentLoaded', () => {
    const form = byId('tpl-pet-form');
    const avatarBox = byId('avatarBox');
    const fileInput = byId('foto');
    const preview = byId('preview');

    const especie = byId('especie');
    const raza = byId('raza');
    const breedList = byId('tpl-breed-list');
    const labelRaza = byId('label-raza');

    const seguroVet = byId('seguroVet');
    const seguroVetData = byId('seguroVetData');
    const seguroVetComp = byId('seguroVetComp');
    const seguroVetNum  = byId('seguroVetNum');

    const seguroRC = byId('seguroRC');

    // Preview + overlay de texto
    fileInput.addEventListener('change', () => {
      const f = fileInput.files && fileInput.files[0];
      preview.src = f ? URL.createObjectURL(f) : 'images/pet-placeholder.png';
      avatarBox.classList.toggle('has-image', !!f);
    });

    // Especie -> razas/tipos (sin textos auxiliares)
    function updateBreedList(){
      const v = especie.value;
      if (v === 'Perro'){
        labelRaza.textContent = 'Raza *';
        setOpts(breedList, DOG_BREEDS);
      } else if (v === 'Gato'){
        labelRaza.textContent = 'Raza *';
        setOpts(breedList, CAT_BREEDS);
      } else if (v === 'Exótico'){
        labelRaza.textContent = 'Especie (exóticos) *';
        setOpts(breedList, EXOTIC_TYPES);
      } else {
        labelRaza.textContent = 'Raza / Tipo *';
        setOpts(breedList, []);
      }
    }
    especie.addEventListener('change', updateBreedList);
    updateBreedList();

    // Seguro vet: detalles solo si “Sí”
    function toggleSeguroVet(){
      const yes = (seguroVet.value === 'Sí');
      seguroVetData.hidden = !yes;
      seguroVetComp.required = seguroVetNum.required = yes;
      if (!yes){ seguroVetComp.value = ''; seguroVetNum.value = ''; }
    }
    seguroVet.addEventListener('change', toggleSeguroVet);
    toggleSeguroVet();

    // Submit: guardado local y vuelta a perfil (sin subir nada)
    form.addEventListener('submit', (ev) => {
      ev.preventDefault(); // seguridad extra

      const fd = new FormData(form);
      const mascota = {
        nombre: (fd.get('nombre')||'').toString().trim(),
        microchip: (fd.get('microchip')||'').toString().trim(),
        especie: (fd.get('especie')||'').toString(),
        raza: (fd.get('raza')||'').toString().trim(),
        edad: (fd.get('edad')||'').toString().trim(),
        peso: (fd.get('peso')||'').toString().trim(),
        esterilizado: (fd.get('esterilizado')||'').toString(),
        vacunas: (fd.get('vacunas')||'').toString(),
        salud: (fd.get('salud')||'').toString(),
        tratamiento: (fd.get('tratamiento')||'').toString(),
        comidas: (fd.get('comidas')||'').toString(),
        salidas: (fd.get('salidas')||'').toString(),
        tamano: (fd.get('tamano')||'').toString(),
        clinica: (fd.get('clinica')||'').toString(),
        hospitalPref: (fd.get('hospitalPref')||'').toString(),
        comportamiento: (fd.get('comportamiento')||'').toString(),

        // Seguimiento y extras
        camaras: (fd.get('camaras')||'').toString(),
        fotos: (fd.get('fotos')||'').toString(),

        // Seguros
        seguroVet: (fd.get('seguroVet')||'').toString(),
        seguroVetComp: (seguroVet.value==='Sí') ? (seguroVetComp.value||'') : '',
        seguroVetNum: (seguroVet.value==='Sí') ? (seguroVetNum.value||'') : '',
        seguroRC: (fd.get('seguroRC')||'').toString(),

        // Foto
        foto: ''
      };

      // Validaciones clave
      if (!mascota.nombre || !mascota.especie || !mascota.raza){
        alert('Completa nombre, especie y raza/tipo.');
        return;
      }

      const files = fileInput.files;
      const done = (dataUrl) => {
        mascota.foto = dataUrl || 'images/pet-placeholder.png';
        const arr = getPets(); arr.push(mascota); savePets(arr);
        location.assign('perfil.html'); // sin overlays ni esperas
      };
      if (files && files[0]) resizeToDataURL(files[0], 256, 256, done);
      else done('');
    });
  });
})();
