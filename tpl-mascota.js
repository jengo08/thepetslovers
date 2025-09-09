/* TPL: INICIO BLOQUE NUEVO [Preview + Cambiar/Ajustar (drag con dedo/flechas) + Razas JSON + Validaciones + Guardado local + Submit fiable] */
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
    if (document.readyState !== 'loading') updateBreedList(); // refrescar si ya cargó
  }).catch(()=>{});

  const $ = (sel, root=document) => root.querySelector(sel);
  const byId = (id) => document.getElementById(id);
  const setOpts = (datalist, arr) => { datalist.innerHTML = arr.map(x=>`<option value="${escapeHtml(x)}"></option>`).join(''); };
  function escapeHtml(s){ return String(s||'').replace(/[&<>"']/g,m=>({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' }[m])); }

  // ===== Foto / crop (drag con dedo o flechas) =====
  let originalImg = null;
  let cropState = { offX:0, offY:0, scale:1 }; // scale fijo para cubrir, solo movemos
  let currentCroppedDataUrl = '';

  function fitCoverScale(imgW, imgH, boxW, boxH){
    return Math.max(boxW/imgW, boxH/imgH);
  }

  function drawToCanvas(ctx, img, offX, offY, scale, W, H){
    const dw = img.width * scale, dh = img.height * scale;
    // Limitar para que no aparezcan bordes vacíos
    const minX = W - dw, maxX = 0;
    const minY = H - dh, maxY = 0;
    const x = Math.min(maxX, Math.max(minX, offX));
    const y = Math.min(maxY, Math.max(minY, offY));
    ctx.clearRect(0,0,W,H);
    ctx.drawImage(img, x, y, dw, dh);
    return {x,y};
  }

  document.addEventListener('DOMContentLoaded', () => {
    const form = byId('tpl-pet-form');

    // ——— Foto & UI ———
    const avatarBox = byId('avatarBox');
    const preview = byId('preview');
    const fileInput = byId('foto');
    const photoPickRow = byId('photoPickRow');
    const photoActions = byId('photoActions');
    const btnChangePhoto = byId('btnChangePhoto');
    const btnAdjustPhoto = byId('btnAdjustPhoto');

    // ——— Campos clave ———
    const especie   = byId('especie');
    const labelRaza = byId('label-raza');
    const raza      = byId('raza');
    const breedList = byId('tpl-breed-list');

    const microchip = byId('microchip');
    const microNo   = byId('microchip_no_tiene');

    const camaras   = byId('camaras');
    const fotosSel  = byId('fotos');

    const seguroVet     = byId('seguroVet');
    const seguroVetData = byId('seguroVetData');
    const seguroVetComp = byId('seguroVetComp');
    const seguroVetNum  = byId('seguroVetNum');
    const seguroRC      = byId('seguroRC');

    // ===== Preview al elegir archivo
    fileInput.addEventListener('change', () => {
      const f = fileInput.files && fileInput.files[0];
      if (!f){
        preview.src = 'images/pet-placeholder.png';
        avatarBox.classList.remove('has-image');
        photoActions.style.display='none';
        photoPickRow.style.display='block';
        currentCroppedDataUrl='';
        originalImg=null;
        return;
      }
      const tmp = URL.createObjectURL(f);
      preview.src = tmp;
      avatarBox.classList.add('has-image');
      originalImg = new Image();
      originalImg.onload = ()=> URL.revokeObjectURL(tmp);
      originalImg.src = tmp;

      // UI
      photoPickRow.style.display = 'none';
      photoActions.style.display = 'flex';
      currentCroppedDataUrl='';
    });

    btnChangePhoto.addEventListener('click', () => fileInput.click());

    // ===== Microchip obligatorio con "No tiene"
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

    // ===== Especie -> razas/tipos
    function updateBreedList(){
      const v = especie.value;
      if (v === 'Perro'){ labelRaza.textContent = 'Raza *'; setOpts(breedList, DOG_BREEDS); }
      else if (v === 'Gato'){ labelRaza.textContent = 'Raza *'; setOpts(breedList, CAT_BREEDS); }
      else if (v === 'Exótico'){ labelRaza.textContent = 'Especie (exóticos) *'; setOpts(breedList, EXOTIC_TYPES); }
      else { labelRaza.textContent = 'Raza / Tipo *'; setOpts(breedList, []); }
    }
    especie.addEventListener('change', updateBreedList);
    updateBreedList();

    // ===== Seguro Vet: detalles solo si “Sí”
    function toggleSeguroVet(){
      const yes = (seguroVet.value === 'Sí');
      seguroVetData.hidden = !yes;
      seguroVetComp.required = seguroVetNum.required = yes;
      if (!yes){ seguroVetComp.value=''; seguroVetNum.value=''; }
    }
    seguroVet.addEventListener('change', toggleSeguroVet);
    toggleSeguroVet();

    // ====== Cropper minimal (drag + flechas, sin zoom UI)
    const modal = byId('cropperModal');
    const cropCanvas = byId('cropCanvas');
    const ctx = cropCanvas.getContext('2d');
    const btnCancelCrop = byId('btnCancelCrop');
    const btnApplyCrop = byId('btnApplyCrop');
    let dragging=false, lastX=0, lastY=0;

    function openCropper(){
      if (!originalImg){ fileInput.click(); return; }
      const W = cropCanvas.width, H = cropCanvas.height;
      cropState.scale = fitCoverScale(originalImg.width, originalImg.height, W, H);
      cropState.offX = (W - originalImg.width * cropState.scale)/2;
      cropState.offY = (H - originalImg.height * cropState.scale)/2;
      drawToCanvas(ctx, originalImg, cropState.offX, cropState.offY, cropState.scale, W, H);
      modal.style.display = 'flex'; modal.setAttribute('aria-hidden','false');
      document.body.style.overflow = 'hidden';
      cropCanvas.focus();
    }
    function closeCropper(){
      modal.style.display = 'none'; modal.setAttribute('aria-hidden','true');
      document.body.style.overflow = '';
    }
    btnAdjustPhoto.addEventListener('click', openCropper);
    btnCancelCrop.addEventListener('click', closeCropper);

    cropCanvas.addEventListener('pointerdown', (e)=>{
      dragging=true; cropCanvas.setPointerCapture(e.pointerId);
      lastX=e.clientX; lastY=e.clientY;
    });
    cropCanvas.addEventListener('pointermove', (e)=>{
      if (!dragging || !originalImg) return;
      const dx = e.clientX - lastX, dy = e.clientY - lastY;
      lastX = e.clientX; lastY = e.clientY;
      cropState.offX += dx; cropState.offY += dy;
      const W = cropCanvas.width, H = cropCanvas.height;
      const p = drawToCanvas(ctx, originalImg, cropState.offX, cropState.offY, cropState.scale, W, H);
      cropState.offX = p.x; cropState.offY = p.y;
    });
    cropCanvas.addEventListener('pointerup', ()=>{ dragging=false; });
    cropCanvas.addEventListener('pointercancel', ()=>{ dragging=false; });

    // Flechas para microajuste
    modal.addEventListener('keydown', (e)=>{
      if (!originalImg) return;
      let moved=false;
      if (e.key==='ArrowLeft'){ cropState.offX -= 3; moved=true; }
      if (e.key==='ArrowRight'){ cropState.offX += 3; moved=true; }
      if (e.key==='ArrowUp'){ cropState.offY -= 3; moved=true; }
      if (e.key==='ArrowDown'){ cropState.offY += 3; moved=true; }
      if (moved){
        e.preventDefault();
        const W = cropCanvas.width, H = cropCanvas.height;
        const p = drawToCanvas(ctx, originalImg, cropState.offX, cropState.offY, cropState.scale, W, H);
        cropState.offX = p.x; cropState.offY = p.y;
      }
      if (e.key==='Escape'){ closeCropper(); }
    });

    btnApplyCrop.addEventListener('click', ()=>{
      if (!originalImg) return closeCropper();
      const out = document.createElement('canvas');
      out.width = 256; out.height = 256;
      const octx = out.getContext('2d');
      // Replicar dibujo en 256x256
      const scale = cropState.scale * (256/320);
      const ox = cropState.offX * (256/320);
      const oy = cropState.offY * (256/320);
      const p = drawToCanvas(octx, originalImg, ox, oy, scale, 256, 256);
      currentCroppedDataUrl = out.toDataURL('image/jpeg', 0.9);
      preview.src = currentCroppedDataUrl;
      closeCropper();
    });

    // ====== Guardar (submit robusto)
    // Captura primero (antes de scripts externos), prevenimos y gestionamos nosotros.
    form.addEventListener('submit', onSubmit, {capture:true});
    function onSubmit(ev){
      ev.preventDefault();
      ev.stopPropagation();
      ev.stopImmediatePropagation();

      // Validación: microchip obligatorio salvo “No tiene”
      if (!microNo.checked && !microchip.value.trim()){
        alert('El microchip es obligatorio (o marca “No tiene”).');
        microchip.focus();
        return;
      }
      // Validación HTML5 para el resto
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

      const f = fileInput.files && fileInput.files[0];

      const finalize = (dataUrl) => {
        mascota.foto = currentCroppedDataUrl || dataUrl || 'images/pet-placeholder.png';
        try{
          const arr = JSON.parse(sessionStorage.getItem('tpl.pets')||'[]');
          arr.push(mascota);
          sessionStorage.setItem('tpl.pets', JSON.stringify(arr));
        }catch(_){}
        location.assign('perfil.html');
      };

      if (currentCroppedDataUrl){ finalize(currentCroppedDataUrl); }
      else if (f){
        // Reducción y centrado básico a 256x256 por si no hiciste “Ajustar”
        const reader = new FileReader();
        reader.onload = () => {
          const img = new Image();
          img.onload = () => {
            const out = document.createElement('canvas');
            out.width = 256; out.height = 256;
            const octx = out.getContext('2d');
            const scale = fitCoverScale(img.width, img.height, 256, 256);
            const dw = img.width*scale, dh = img.height*scale;
            const x = (256 - dw)/2, y = (256 - dh)/2;
            octx.drawImage(img, x, y, dw, dh);
            finalize(out.toDataURL('image/jpeg', 0.85));
          };
          img.src = reader.result;
        };
        reader.readAsDataURL(f);
      } else {
        finalize('');
      }
    }
  });

  // ===== Utilidad global para refrescar datalist tras cargar JSON =====
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
