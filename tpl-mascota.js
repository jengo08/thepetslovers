/* TPL: INICIO BLOQUE NUEVO [Preview + Cambiar/Ajustar + Razas (JSON opcional) + Validaciones + Guardado local] */
(function(){
  'use strict';

  // ===== Listas de respaldo. Si existe tpl-razas.json, se usan sus listas completas =====
  let DOG_BREEDS = ["Mestizo","Labrador Retriever","Golden Retriever","Pastor Alemán","Bulldog Francés","Caniche / Poodle","Chihuahua","Pomerania","Yorkshire Terrier","Shih Tzu","Beagle","Bóxer","Border Collie","Dálmata","Rottweiler","Husky Siberiano","Cocker Spaniel","Teckel / Dachshund","Pastor Belga Malinois","Pastor Australiano"];
  let CAT_BREEDS = ["Mestizo","Europeo Común","Siamés","Persa","Maine Coon","Bengalí","Ragdoll","Sphynx","British Shorthair","Scottish Fold","Azul Ruso","Noruego de Bosque","Bosque de Siberia","Abisinio","Exótico de Pelo Corto"];
  const EXOTIC_TYPES = ["Pájaro","Conejo","Hurón","Hámster","Cobaya","Erizo","Iguana","Lagarto","Camaleón","Serpiente","Rana","Tortuga","Araña","Otro"];

  fetch('tpl-razas.json').then(r=>r.ok?r.json():null).then(j=>{
    if (!j) return;
    if (Array.isArray(j.perro) && j.perro.length) DOG_BREEDS = j.perro;
    if (Array.isArray(j.gato)  && j.gato.length)  CAT_BREEDS = j.gato;
    // Refrescar datalist si ya hay especie seleccionada
    const especie = document.getElementById('especie');
    if (especie && especie.value) updateBreedList();
  }).catch(()=>{});

  const $ = (sel, root=document) => root.querySelector(sel);
  const byId = (id) => document.getElementById(id);
  const setOpts = (datalist, arr) => { datalist.innerHTML = arr.map(x=>`<option value="${escapeHtml(x)}"></option>`).join(''); };
  function escapeHtml(s){ return String(s||'').replace(/[&<>"']/g,m=>({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' }[m])); }

  // ===== Estado foto / crop =====
  let originalImg = null;           // Image() cargada desde el file
  let currentCroppedDataUrl = '';   // DataURL tras aplicar recorte manual

  // Reducir a DataURL cuadrado 256x256 (usado al guardar si no hay crop manual)
  function resizeToDataURL(file, maxW=256, maxH=256, cb){
    const reader = new FileReader();
    reader.onload = () => {
      const img = new Image();
      img.onload = () => {
        const ratio = Math.min(maxW/img.width, maxH/img.height, 1);
        const w = Math.round(img.width * ratio);
        const h = Math.round(img.height * ratio);
        const canvas = document.createElement('canvas');
        canvas.width = 256; canvas.height = 256;
        const ctx = canvas.getContext('2d');
        // Ajuste simple centrado
        const scale = Math.max(256/w, 256/h);
        const dw = w*scale, dh = h*scale;
        ctx.drawImage(img, (256-dw)/2, (256-dh)/2, dw, dh);
        cb(canvas.toDataURL('image/jpeg', 0.85));
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

  // ===== Init =====
  document.addEventListener('DOMContentLoaded', () => {
    const form = byId('tpl-pet-form');

    // Foto & UI
    const avatarBox = byId('avatarBox');
    const preview = byId('preview');
    const fileInput = byId('foto');
    const photoPickRow = byId('photoPickRow');
    const photoActions = byId('photoActions');
    const btnChangePhoto = byId('btnChangePhoto');
    const btnAdjustPhoto = byId('btnAdjustPhoto');

    // Campos clave
    const especie   = byId('especie');
    const labelRaza = byId('label-raza');
    const raza      = byId('raza');
    const breedList = byId('tpl-breed-list');

    const microchip = byId('microchip');
    const microNo   = byId('microchip_no_tiene');

    const isVisita  = byId('isVisita');
    const rowCams   = byId('row-camaras');
    const camaras   = byId('camaras');

    const seguroVet     = byId('seguroVet');
    const seguroVetData = byId('seguroVetData');
    const seguroVetComp = byId('seguroVetComp');
    const seguroVetNum  = byId('seguroVetNum');
    const seguroRC      = byId('seguroRC');

    // ====== PREVIEW: mostrar imagen y cambiar UI a “Cambiar/Ajustar” ======
    fileInput.addEventListener('change', (e) => {
      const f = fileInput.files && fileInput.files[0];
      if (!f){ preview.src = 'images/pet-placeholder.png'; avatarBox.classList.remove('has-image'); photoActions.style.display='none'; photoPickRow.style.display='block'; currentCroppedDataUrl=''; return; }
      const tmp = URL.createObjectURL(f);
      preview.src = tmp;
      avatarBox.classList.add('has-image');
      // Prepara imagen original para el cropper
      originalImg = new Image();
      originalImg.onload = ()=> URL.revokeObjectURL(tmp);
      originalImg.src = tmp;

      // UI: ocultar picker y mostrar acciones
      photoPickRow.style.display = 'none';
      photoActions.style.display = 'flex';
    }, {capture:false}); // no capturamos global para no romper clicks

    btnChangePhoto.addEventListener('click', () => fileInput.click());

    // ====== MICROCHIP: obligatorio o “No tiene” ======
    function updateMicroState(){
      if (microNo.checked){
        microchip.value = '';
        microchip.setAttribute('disabled','disabled');
        microchip.removeAttribute('required');
      } else {
        microchip.removeAttribute('disabled');
        microchip.setAttribute('required','required');
      }
    }
    microNo.addEventListener('change', updateMicroState);
    updateMicroState();

    // ====== ESPECIE -> RAZAS/TIPOS ======
    function updateBreedList(){
      const v = especie.value;
      if (v === 'Perro'){ labelRaza.textContent = 'Raza *'; setOpts(breedList, DOG_BREEDS); }
      else if (v === 'Gato'){ labelRaza.textContent = 'Raza *'; setOpts(breedList, CAT_BREEDS); }
      else if (v === 'Exótico'){ labelRaza.textContent = 'Especie (exóticos) *'; setOpts(breedList, EXOTIC_TYPES); }
      else { labelRaza.textContent = 'Raza / Tipo *'; setOpts(breedList, []); }
    }
    especie.addEventListener('change', updateBreedList);
    updateBreedList();

    // ====== VISITA -> cámaras solo si es visita ======
    function updateVisita(){
      const on = !!isVisita.checked;
      rowCams.hidden = !on;
      camaras.required = on;
      if (!on) camaras.value = '';
    }
    isVisita.addEventListener('change', updateVisita);
    updateVisita();

    // ====== SEGURO VETERINARIO: detalles solo si “Sí” ======
    function toggleSeguroVet(){
      const yes = (seguroVet.value === 'Sí');
      seguroVetData.hidden = !yes;
      seguroVetComp.required = seguroVetNum.required = yes;
      if (!yes){ seguroVetComp.value=''; seguroVetNum.value=''; }
    }
    seguroVet.addEventListener('change', toggleSeguroVet);
    toggleSeguroVet();

    // ====== CROP/ AJUSTAR ======
    const modal = byId('cropperModal');
    const cropCanvas = byId('cropCanvas');
    const ctx = cropCanvas.getContext('2d');
    const zoomRange = byId('zoomRange');
    const xRange = byId('xRange');
    const yRange = byId('yRange');
    const btnCancelCrop = byId('btnCancelCrop');
    const btnApplyCrop = byId('btnApplyCrop');

    function openCropper(){
      if (!originalImg){ fileInput.click(); return; }
      zoomRange.value = '1'; xRange.value = '0'; yRange.value = '0';
      renderCrop();
      modal.style.display = 'flex'; modal.setAttribute('aria-hidden','false');
      document.body.style.overflow = 'hidden';
    }
    function closeCropper(){
      modal.style.display = 'none'; modal.setAttribute('aria-hidden','true');
      document.body.style.overflow = '';
    }
    function renderCrop(){
      const W = cropCanvas.width, H = cropCanvas.height;
      ctx.clearRect(0,0,W,H);
      if (!originalImg) return;
      const zoom = parseFloat(zoomRange.value||'1');
      const offx = parseInt(xRange.value||'0',10);
      const offy = parseInt(yRange.value||'0',10);

      // Escala para que la imagen cubra el canvas y luego aplicamos zoom extra
      const baseScale = Math.max(W/originalImg.width, H/originalImg.height);
      const scale = baseScale * zoom;
      const dw = originalImg.width * scale, dh = originalImg.height * scale;

      const cx = (W - dw)/2 + (offx/100)*(W/2);
      const cy = (H - dh)/2 + (offy/100)*(H/2);

      ctx.drawImage(originalImg, cx, cy, dw, dh);

      // Opcional: guía circular suave
      ctx.strokeStyle = '#ddd'; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.arc(W/2, H/2, W/2-2, 0, Math.PI*2); ctx.stroke();
    }

    [zoomRange, xRange, yRange].forEach(el => el.addEventListener('input', renderCrop));
    btnAdjustPhoto.addEventListener('click', openCropper);
    btnCancelCrop.addEventListener('click', closeCropper);
    btnApplyCrop.addEventListener('click', () => {
      // Exportar recorte cuadrado 256x256
      const out = document.createElement('canvas');
      out.width = 256; out.height = 256;
      const octx = out.getContext('2d');

      // Re-hacer el mismo render en out (256x256)
      const W=256, H=256;
      const zoom = parseFloat(zoomRange.value||'1');
      const offx = parseInt(xRange.value||'0',10);
      const offy = parseInt(yRange.value||'0',10);
      const baseScale = Math.max(W/originalImg.width, H/originalImg.height);
      const scale = baseScale * zoom;
      const dw = originalImg.width * scale, dh = originalImg.height * scale;
      const cx = (W - dw)/2 + (offx/100)*(W/2);
      const cy = (H - dh)/2 + (offy/100)*(H/2);
      octx.drawImage(originalImg, cx, cy, dw, dh);

      currentCroppedDataUrl = out.toDataURL('image/jpeg', 0.9);
      preview.src = currentCroppedDataUrl;
      avatarBox.classList.add('has-image');
      closeCropper();
    });

    // Cerrar modal con Escape
    document.addEventListener('keydown', (e)=>{ if (e.key==='Escape' && modal.style.display==='flex') closeCropper(); });

    // Evitar que overlays externos intercepten SOLO en nuestros elementos (sin romper nada global)
    ['dragenter','dragover','drop'].forEach(evt=>avatarBox.addEventListener(evt, e=>{ e.preventDefault(); }, true));

    // ====== SUBMIT (guardar local y volver a perfil) ======
    form.addEventListener('submit', (ev) => {
      ev.preventDefault();

      // Validación: microchip obligatorio salvo “No tiene”
      if (!microNo.checked && !microchip.value.trim()){
        alert('El microchip es obligatorio (o marca “No tiene”).');
        microchip.focus();
        return;
      }

      // Validación básica global HTML5
      if (!form.reportValidity()) return;

      const fd = new FormData(form);
      const mascota = {
        nombre: (fd.get('nombre')||'').toString().trim(),
        microchip: microNo.checked ? 'No tiene' : (fd.get('microchip')||'').toString().trim(),
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
        isVisita: !!isVisita.checked,
        camaras: isVisita.checked ? (fd.get('camaras')||'').toString() : '',
        fotos: (fd.get('fotos')||'').toString(),

        // Seguros
        seguroVet: (fd.get('seguroVet')||'').toString(),
        seguroVetComp: (seguroVet.value==='Sí') ? (seguroVetComp.value||'') : '',
        seguroVetNum: (seguroVet.value==='Sí') ? (seguroVetNum.value||'') : '',
        seguroRC: (fd.get('seguroRC')||'').toString(),

        // Foto
        foto: ''
      };

      const files = fileInput.files;
      const done = (dataUrl) => {
        mascota.foto = currentCroppedDataUrl || dataUrl || 'images/pet-placeholder.png';
        const arr = getPets(); arr.push(mascota); savePets(arr);
        location.assign('perfil.html');
      };

      if (currentCroppedDataUrl){
        done(currentCroppedDataUrl);
      } else if (files && files[0]){
        resizeToDataURL(files[0], 256, 256, done);
      } else {
        done('');
      }
    });
  });

  // ===== Utils en scope superior para refrescar datalist tras JSON =====
  function updateBreedList(){
    const especie = document.getElementById('especie');
    const labelRaza = document.getElementById('label-raza');
    const breedList = document.getElementById('tpl-breed-list');
    if (!especie || !labelRaza || !breedList) return;
    const v = especie.value;
    if (v === 'Perro'){ labelRaza.textContent = 'Raza *'; setOpts(breedList, DOG_BREEDS); }
    else if (v === 'Gato'){ labelRaza.textContent = 'Raza *'; setOpts(breedList, CAT_BREEDS); }
    else if (v === 'Exótico'){ labelRaza.textContent = 'Especie (exóticos) *'; setOpts(breedList, EXOTIC_TYPES); }
    else { labelRaza.textContent = 'Raza / Tipo *'; setOpts(breedList, []); }
  }
})();
