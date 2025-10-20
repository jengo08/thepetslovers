/****************************************************
 * TPL · RESERVAS (COMPLETO · para reservas.html)
 * (… resto del archivo sin cambios hasta la función sendEmails …)
 ****************************************************/

/* ====== EmailJS (única plantilla; cliente + gestión) ====== */
async function sendEmails(reservation){
  if(!window.TPL_EMAILJS || !TPL_EMAILJS.enabled) return;

  // Construye variables EXACTAS que espera tu plantilla
  const vars = {
    reserva_id: reservation.id,
    _estado: reservation.status || "paid_review",

    service: (()=>{
      const svc = reservation.service?.type || "";
      const exo = reservation.service?.exoticType ? (" · " + reservation.service.exoticType) : "";
      return (svc + exo) || "—";
    })(),

    startDate: reservation.dates?.startDate || "",
    endDate: reservation.dates?.endDate || reservation.dates?.startDate || "",
    Hora_inicio: reservation.dates?.startTime || "",
    Hora_fin: reservation.dates?.endTime || "",

    firstName: reservation.owner?.fullName || "",
    email: reservation.owner?.email || "",
    phone: reservation.owner?.phone || "",
    region: reservation.region || $("#region")?.value || "",
    address: reservation.owner?.address || "",
    postalCode: reservation.owner?.postalCode || "",

    species: (reservation.pets||[]).map(p=>p.nombre||"Mascota").join(", ") || "—",

    summaryField: JSON.stringify(
      (reservation.pricing?.breakdownPublic||[]).map(l=>{
        const amount = (l.amount!=null) ? `${Number(l.amount).toFixed(2).replace('.',',')}€` : "";
        return amount ? `${l.label}: ${amount}` : l.label;
      }),
      null, 2
    ),

    total_cliente: reservation.pricing?.totalClient ?? 0,
    pagar_ahora:   reservation.pricing?.payNow ?? 0,
    pendiente:     reservation.pricing?.payLater ?? 0,

    total_txt:     (reservation.pricing?.totalClient!=null ? reservation.pricing.totalClient.toFixed(2).replace('.',',')+' €' : '—'),
    pay_now_txt:   (reservation.pricing?.payNow!=null   ? reservation.pricing.payNow.toFixed(2).replace('.',',')+' €'   : '—'),
    pay_later_txt: (reservation.pricing?.payLater!=null ? reservation.pricing.payLater.toFixed(2).replace('.',',')+' €' : '—'),

    observations: $("#notes")?.value || "",

    _uid:   (firebase?.auth?.().currentUser?.uid)   || "",
    _email: (firebase?.auth?.().currentUser?.email) || ""
  };

  // Helper: envío con SDK EmailJS
  async function sendWithSDK(to_email, to_name){
    if(!window.emailjs) throw new Error("SDK not loaded");
    try{ if(TPL_EMAILJS.publicKey){ emailjs.init(TPL_EMAILJS.publicKey); } }catch(_){}
    return emailjs.send(
      TPL_EMAILJS.serviceId,
      TPL_EMAILJS.templateId,
      { to_email, to_name, ...vars }
    );
  }

  // Helper: fallback REST oficial
  async function sendWithREST(to_email, to_name){
    const payload = {
      service_id: TPL_EMAILJS.serviceId,
      template_id: TPL_EMAILJS.templateId,
      user_id: TPL_EMAILJS.publicKey,           // <- public key va aquí
      template_params: { to_email, to_name, ...vars }
    };
    const res = await fetch("https://api.emailjs.com/api/v1.0/email/send", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });
    if(!res.ok){
      const txt = await res.text().catch(()=>res.statusText);
      throw new Error("REST send failed: "+txt);
    }
    return res.text();
  }

  // Destinos
  const toClient  = { to_email: vars.email, to_name: vars.firstName || "Cliente" };
  const toAdmin   = { to_email: TPL_EMAILJS.adminEmail || "gestion@thepetslovers.es", to_name: "Gestión The Pets Lovers" };

  // Envío 1: Cliente
  try{
    if(window.emailjs) await sendWithSDK(toClient.to_email, toClient.to_name);
    else await sendWithREST(toClient.to_email, toClient.to_name);
    console.log("[EmailJS] Cliente OK");
  }catch(err1){
    console.warn("[EmailJS] Cliente SDK error, intento REST…", err1);
    try{
      await sendWithREST(toClient.to_email, toClient.to_name);
      console.log("[EmailJS] Cliente OK (REST)");
    }catch(err2){
      console.error("[EmailJS] Cliente FALLÓ", err2);
    }
  }

  // Envío 2: Gestión
  try{
    if(window.emailjs) await sendWithSDK(toAdmin.to_email, toAdmin.to_name);
    else await sendWithREST(toAdmin.to_email, toAdmin.to_name);
    console.log("[EmailJS] Gestión OK");
  }catch(err1){
    console.warn("[EmailJS] Gestión SDK error, intento REST…", err1);
    try{
      await sendWithREST(toAdmin.to_email, toAdmin.to_name);
      console.log("[EmailJS] Gestión OK (REST)");
    }catch(err2){
      console.error("[EmailJS] Gestión FALLÓ", err2);
    }
  }
}

/* ====== INIT ====== */
window.addEventListener("load", ()=>{
  // … aquí sigue TODO igual que ya tenías (listeners, preselect, onAuth, etc.)
  // (no repito por brevedad: usa tu mismo archivo y solo sustituye la función sendEmails por esta)
});
