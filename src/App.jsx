import { useState, useEffect, useCallback, useRef } from "react";
import { supabase } from "./supabase.js";
import mamanPhoto from "./assets/maman.png";
import iconSans from "./assets/icon-sans-512.png";

const SLOTS = ["12:00", "14:00", "16:00", "18:00"];
const START_DATE = new Date("2026-05-12T00:00:00");
const NIGHT_SUSPENDED_FROM = new Date("2026-05-15T00:00:00");

const HOSPITAL = {
  name: "Hôpital Michallon · CHU Grenoble Alpes · Pavillon de Neurologie",
  address: "Bd de la Chantourne, 38700 La Tronche",
  room: "Neurologie | Secteur A | Chambre 102",
  mapsUrl: "https://maps.app.goo.gl/uPXWyKzcTGMKCnNG7",
};

const APP_URL = "https://planning-visites-maman.vercel.app";

const RULES = [
  { icon: "⏱️", text: "15 à 20 minutes maximum par visite" },
  { icon: "👥", text: "2 personnes maximum par créneau" },
  { icon: "🕐", text: "Créneaux : 12h, 14h, 16h, 18h" },
  { icon: "⏳", text: "Au moins 2h entre chaque visite" },
  { icon: "🤫", text: "Peu de sollicitation : maman a besoin de repos. Si elle dort, la laisser dormir sans faire de bruit — elle ressent notre présence." },
  { icon: "🚨", text: "Au moindre doute pendant la visite, alerter immédiatement le personnel soignant — c'est à nous de le faire." },
  { icon: "📖", text: "Un livre a été laissé dans la chambre pour maman : chacun peut y écrire un mot, un souvenir, un poème, coller une photo ou un dessin afin de lui laisser une trace de [...]" },
  { icon: "🚪", text: "À la fin de la visite, laisser la porte grande ouverte pour que le personnel puisse surveiller que tout va bien." },
  { icon: "🌙", text: "Les nuitées familiales sont suspendues par l'équipe médicale depuis le 15/05/2026." },
  { icon: "🌙", text: "Maman a changé de chambre depuis le 21/05/2026 (du Secteur C / chambre 140 au Secteur A / Chambre 102 - Même bâtiment)." },
];

const C = {
  bg: "#0D1B2E", card: "#112240", border: "#1E3A5F",
  accent: "#2E75B6", gold: "#f0b429",
  text: "#e8edf5", muted: "#7a8fa6",
  success: "#3ecf8e", danger: "#e94560",
  orange: "#f97316",
};

function toISO(d) {
  const y = d.getFullYear();
  const m = String(d.getMonth()+1).padStart(2,"0");
  const day = String(d.getDate()).padStart(2,"0");
  return `${y}-${m}-${day}`;
}
function toFrLong(d) {
  return d.toLocaleDateString("fr-FR", { weekday:"long", day:"numeric", month:"long" });
}
function toFrShort(d) {
  return d.toLocaleDateString("fr-FR", { day:"2-digit", month:"2-digit", year:"numeric" });
}
function addDays(d, n) {
  const r = new Date(d); r.setDate(r.getDate()+n); return r;
}
function sameDay(a, b) { return toISO(a) === toISO(b); }

function isNightSuspended(date) {
  return date >= NIGHT_SUSPENDED_FROM;
}


function getDayStatus(reservations, iso, dateObj) {
  const visits = reservations.filter(r => r.date === iso && r.type === "Visite");
  const night = reservations.find(r => r.date === iso && r.type === "Nuit");
  const maxVisits = SLOTS.length * 2;
  const nightSusp = isNightSuspended(dateObj);
  if (visits.length === 0 && !night) return "empty";
  if (nightSusp) {
    if (visits.length >= maxVisits) return "full";
    return "partial";
  }
  if (visits.length >= maxVisits && night) return "full";
  return "partial";
}

function gcalUrl({ title, date, startH, endH, description }) {
  const pad = n => String(n).padStart(2,"0");
  const d = date.replace(/-/g,"");
  const start = `${d}T${pad(startH)}0000`;
  const end = `${d}T${pad(endH)}0000`;
  return `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${encodeURIComponent(title)}&dates=${start}/${end}&details=${encodeURIComponent(description)}&location=${encodeURIComponent(HOSPITAL.address)}`;
}

function getDaysInMonth(year, month) {
  const days = [];
  const first = new Date(year, month, 1);
  const last = new Date(year, month+1, 0);
  for (let d = new Date(first); d <= last; d.setDate(d.getDate()+1)) {
    days.push(new Date(d));
  }
  return days;
}

function getTodayOrStart() {
  const now = new Date();
  now.setHours(0,0,0,0);
  return now < START_DATE ? new Date(START_DATE) : now;
}

function detectDevice() {
  const ua = navigator.userAgent || "";
  if (/iPad|iPhone|iPod/.test(ua)) return "ios";
  if (/Android/.test(ua)) return "android";
  return "desktop";
}

// ─── Composant modal PIN ──────────────────────────────────────────────────────
function PinModal({ reservation, onClose, onSuccess }) {
  const [pin, setPin] = useState("");
  const [error, setError] = useState(false);
  const [step, setStep] = useState("enter"); // "enter" | "actions"
  const [deleting, setDeleting] = useState(false);

  function checkPin() {
    if (pin === String(reservation.pin)) {
      setError(false);
      setStep("actions");
    } else {
      setError(true);
      setPin("");
    }
  }

  return (
    <div style={{ position:"fixed", inset:0, background:"rgba(0,0,0,0.85)", display:"flex", alignItems:"center", justifyContent:"center", zIndex:200, padding:16 }}
      onClick={onClose}>
      <div style={{ background:C.card, border:`1px solid ${C.accent}`, borderRadius:14, padding:"24px 20px", width:"100%", maxWidth:340 }}
        onClick={e => e.stopPropagation()}>

        {step === "enter" ? (
          <>
            <div style={{ textAlign:"center", marginBottom:18 }}>
              <div style={{ fontSize:"2rem", marginBottom:6 }}>🔐</div>
              <div style={{ fontFamily:"'Playfair Display',serif", fontSize:"1.1rem", fontWeight:700, color:"#fff", marginBottom:4 }}>
                Code PIN
              </div>
              <p style={{ fontSize:"0.8rem", color:C.muted, margin:0, lineHeight:1.5 }}>
                Saisis le code PIN reçu lors de ta réservation pour modifier ou annuler ta visite.
              </p>
            </div>

            {/* Affichage résa concernée */}
            <div style={{ background:C.bg, border:`1px solid ${C.border}`, borderRadius:8, padding:"10px 14px", marginBottom:16, fontSize:"0.8rem", color:C.text }}>
              <span style={{ color:C.muted }}>Réservation : </span>
              <strong>{reservation.prenom} {reservation.nom}</strong>
              <br/>
              <span style={{ color:C.muted }}>
                {reservation.type === "Nuit" ? "🌙 Nuit" : `🕐 ${reservation.creneau}`} · {toFrShort(new Date(reservation.date+"T12:00:00"))}
              </span>
            </div>

            {/* Saisie PIN style clavier */}
            <div style={{ display:"flex", gap:10, justifyContent:"center", marginBottom:14 }}>
              {[0,1,2,3].map(i => (
                <div key={i} style={{
                  width:48, height:54, borderRadius:8,
                  border:`2px solid ${error ? C.danger : pin.length > i ? C.accent : C.border}`,
                  background: C.bg,
                  display:"flex", alignItems:"center", justifyContent:"center",
                  fontSize:"1.4rem", fontWeight:700, color: error ? C.danger : C.text,
                  transition:"border-color 0.2s",
                }}>
                  {pin[i] ? "●" : ""}
                </div>
              ))}
            </div>

            {error && (
              <div style={{ textAlign:"center", fontSize:"0.76rem", color:C.danger, marginBottom:10 }}>
                PIN incorrect. Vérifie ta confirmation de réservation.
              </div>
            )}

            {/* Clavier numérique */}
            <div style={{ display:"grid", gridTemplateColumns:"repeat(3,1fr)", gap:8, marginBottom:14 }}>
              {[1,2,3,4,5,6,7,8,9,"",0,"⌫"].map((k, i) => (
                <button key={i} onClick={() => {
                  if (k === "⌫") { setPin(p => p.slice(0,-1)); setError(false); }
                  else if (k !== "" && pin.length < 4) { setPin(p => p + String(k)); setError(false); }
                }} style={{
                  padding:"14px 0",
                  background: k === "" ? "transparent" : k === "⌫" ? "rgba(233,69,96,0.1)" : C.bg,
                  border: k === "" ? "none" : `1px solid ${k === "⌫" ? "rgba(233,69,96,0.3)" : C.border}`,
                  borderRadius:8,
                  color: k === "⌫" ? C.danger : C.text,
                  fontSize:"1.1rem", fontWeight:600,
                  cursor: k === "" ? "default" : "pointer",
                  fontFamily:"'DM Sans',system-ui,sans-serif",
                }}>
                  {k}
                </button>
              ))}
            </div>

            <div style={{ display:"flex", gap:8 }}>
              <button onClick={onClose} style={{ flex:1, padding:11, background:"transparent", color:C.muted, border:`1px solid ${C.border}`, borderRadius:8, cursor:"pointer", fontSize:"0.84rem", fontFamily:"'DM Sans',system-ui,sans-serif" }}>
                Annuler
              </button>
              <button onClick={checkPin} disabled={pin.length < 4} style={{ flex:1.3, padding:11, background: pin.length < 4 ? "rgba(46,117,182,0.3)" : C.accent, color:"#fff", border:"none", borderRadius:8, cursor: pin.length < 4 ? "default" : "pointer", fontWeight:600, fontSize:"0.84rem", fontFamily:"'DM Sans',system-ui,sans-serif" }}>
                Valider
              </button>
            </div>

            <div style={{ textAlign:"center", marginTop:14 }}>
              <span style={{ fontSize:"0.72rem", color:C.muted }}>Code oublié ? Contacte Guillaume au </span>
              <a href="tel:0617927600" style={{ fontSize:"0.72rem", color:C.accent, textDecoration:"none", fontWeight:600 }}>
                06.17.92.76.00
              </a>
            </div>
          </>
        ) : (
          <>
            <div style={{ textAlign:"center", marginBottom:18 }}>
              <div style={{ fontSize:"2rem", marginBottom:6 }}>✅</div>
              <div style={{ fontFamily:"'Playfair Display',serif", fontSize:"1.1rem", fontWeight:700, color:C.success, marginBottom:4 }}>
                PIN validé
              </div>
              <p style={{ fontSize:"0.8rem", color:C.muted, margin:0 }}>
                Que souhaites-tu faire ?
              </p>
            </div>

            <div style={{ background:C.bg, border:`1px solid ${C.border}`, borderRadius:8, padding:"10px 14px", marginBottom:16, fontSize:"0.8rem", color:C.text }}>
              <strong>{reservation.prenom} {reservation.nom}</strong>
              <br/>
              <span style={{ color:C.muted }}>
                {reservation.type === "Nuit" ? "🌙 Nuit" : `🕐 ${reservation.creneau}`} · {toFrShort(new Date(reservation.date+"T12:00:00"))}
              </span>
            </div>

            <button onClick={() => onSuccess({ action: "edit", id: reservation.id, reservation })} style={{
              width:"100%", padding:"12px", background:C.accent, color:"#fff", border:"none",
              borderRadius:8, cursor:"pointer", fontWeight:600, fontSize:"0.86rem",
              fontFamily:"'DM Sans',system-ui,sans-serif", marginBottom:8
            }}>
              ✏️ Modifier ma réservation
            </button>

            <button onClick={async () => {
              setDeleting(true);
              await onSuccess({ action: "delete", id: reservation.id });
              setDeleting(false);
            }} style={{
              width:"100%", padding:"12px", background:"rgba(233,69,96,0.12)", color:C.danger,
              border:`1px solid rgba(233,69,96,0.35)`, borderRadius:8, cursor:"pointer",
              fontWeight:600, fontSize:"0.86rem", fontFamily:"'DM Sans',system-ui,sans-serif", marginBottom:8
            }}>
              {deleting ? "Suppression…" : "🗑️ Annuler ma visite"}
            </button>

            <button onClick={onClose} style={{ width:"100%", padding:10, background:"transparent", color:C.muted, border:`1px solid ${C.border}`, borderRadius:8, cursor:"pointer", fontSize:"0.82rem", fontFamily:"'DM Sans',system-ui,sans-serif" }}>
              Fermer
            </button>
          </>
        )}
      </div>
    </div>
  );
}

// ─── Modal édition complète ───────────────────────────────────────────────────
function EditFullModal({ reservation, reservations, onClose, onSave }) {
  const initDate = new Date(reservation.date + "T12:00:00");
  const [selDate, setSelDate] = useState(reservation.date); // ISO string
  const [selSlot, setSelSlot] = useState(reservation.creneau === "🌙 Nuit" ? null : reservation.creneau);
  const [isNight, setIsNight] = useState(reservation.type === "Nuit");
  const [prenom, setPrenom] = useState(reservation.prenom || "");
  const [nom, setNom] = useState(reservation.nom || "");
  const [tel, setTel] = useState(reservation.telephone || "");
  const [saving, setSaving] = useState(false);
  const [calMonth, setCalMonth] = useState({ year: initDate.getFullYear(), month: initDate.getMonth() });

  const today = new Date(); today.setHours(0,0,0,0);

  const monthDays = getDaysInMonth(calMonth.year, calMonth.month);
  const firstDow = (new Date(calMonth.year, calMonth.month, 1).getDay() + 6) % 7;
  const monthName = new Date(calMonth.year, calMonth.month, 1).toLocaleDateString("fr-FR", { month:"long", year:"numeric" });

  // Créneaux disponibles pour le jour sélectionné (en excluant la résa courante du comptage)
  function slotOccupancy(slot) {
    return reservations.filter(r =>
      r.date === selDate && r.creneau === slot && r.type === "Visite" && r.id !== reservation.id
    ).length;
  }
  function nightOccupied() {
    return reservations.some(r =>
      r.date === selDate && r.type === "Nuit" && r.id !== reservation.id
    );
  }

  const canSave = prenom.trim() && selDate && (isNight ? !nightOccupied() : !!selSlot);

  async function handleSave() {
    if (!canSave) return;
    setSaving(true);
    await onSave({
      date: selDate,
      creneau: isNight ? "🌙 Nuit" : selSlot,
      prenom, nom, telephone: tel,
    });
    setSaving(false);
  }

  return (
    <div style={{ position:"fixed", inset:0, background:"rgba(0,0,0,0.9)", display:"flex", alignItems:"flex-start", justifyContent:"center", zIndex:210, padding:16, overflowY:"auto" }}
      onClick={onClose}>
      <div style={{ background:C.card, border:`1px solid ${C.accent}`, borderRadius:14, padding:"22px 18px", width:"100%", maxWidth:380, marginTop:20, marginBottom:20 }}
        onClick={e => e.stopPropagation()}>

        <div style={{ fontFamily:"'Playfair Display',serif", fontSize:"1.1rem", fontWeight:700, color:"#fff", marginBottom:4 }}>
          ✏️ Modifier la réservation
        </div>
        <p style={{ fontSize:"0.78rem", color:C.muted, margin:"0 0 18px" }}>
          {reservation.prenom} {reservation.nom} · résa originale : {toFrShort(new Date(reservation.date+"T12:00:00"))} {reservation.type === "Nuit" ? "🌙" : reservation.creneau}
        </p>

        {/* ── Calendrier mini ── */}
        <div style={{ fontSize:"0.72rem", color:C.gold, fontWeight:600, letterSpacing:"0.08em", textTransform:"uppercase", marginBottom:8 }}>
          Nouveau jour
        </div>
        <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:8 }}>
          <button onClick={() => setCalMonth(m => { const d = new Date(m.year, m.month-1,1); return {year:d.getFullYear(),month:d.getMonth()}; })}
            style={{ background:"transparent", border:`1px solid ${C.border}`, color:C.text, borderRadius:6, padding:"4px 10px", cursor:"pointer" }}>‹</button>
          <span style={{ fontSize:"0.84rem", fontWeight:600, textTransform:"capitalize", color:C.text }}>{monthName}</span>
          <button onClick={() => setCalMonth(m => { const d = new Date(m.year, m.month+1,1); return {year:d.getFullYear(),month:d.getMonth()}; })}
            style={{ background:"transparent", border:`1px solid ${C.border}`, color:C.text, borderRadius:6, padding:"4px 10px", cursor:"pointer" }}>›</button>
        </div>
        <div style={{ display:"grid", gridTemplateColumns:"repeat(7,1fr)", gap:1, marginBottom:3 }}>
          {["L","M","M","J","V","S","D"].map((d,i) => (
            <div key={i} style={{ textAlign:"center", fontSize:"0.62rem", color:C.muted, padding:"2px 0" }}>{d}</div>
          ))}
        </div>
        <div style={{ display:"grid", gridTemplateColumns:"repeat(7,1fr)", gap:2, marginBottom:14 }}>
          {Array(firstDow).fill(null).map((_,i) => <div key={"e"+i}/>)}
          {monthDays.map(day => {
            const iso = toISO(day);
            const isPast = day < START_DATE || day < today;
            const isSelected = iso === selDate;
            return (
              <div key={iso} onClick={() => { if (!isPast) { setSelDate(iso); setSelSlot(null); } }}
                style={{ background: isSelected ? C.accent : isPast ? "transparent" : C.bg, border:`1px solid ${isSelected ? C.accent : C.border}`, borderRadius:6, padding:"5px 2px", textAlign:"center", cursor: isPast ? "default" : "pointer", opacity: isPast ? 0.3 : 1 }}>
                <div style={{ fontSize:"0.78rem", fontWeight:600, color: isSelected ? "#fff" : C.text }}>{day.getDate()}</div>
              </div>
            );
          })}
        </div>

        {/* ── Type : visite ou nuit ── */}
        {reservation.type !== "Nuit" && (
          <>
            <div style={{ fontSize:"0.72rem", color:C.gold, fontWeight:600, letterSpacing:"0.08em", textTransform:"uppercase", marginBottom:8 }}>
              Nouveau créneau
            </div>
            <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:6, marginBottom:14 }}>
              {SLOTS.filter(slot => slotOccupancy(slot) < 2).map(slot => {
                const occ = slotOccupancy(slot);
                const selected = selSlot === slot;
                return (
                  <button key={slot} onClick={() => setSelSlot(slot)} style={{
                    padding:"10px 8px", background: selected ? C.accent : C.bg,
                    border:`1px solid ${selected ? C.accent : C.border}`,
                    borderRadius:8, cursor:"pointer",
                    color: selected ? "#fff" : C.text,
                    fontSize:"0.84rem", fontWeight:600, fontFamily:"'DM Sans',system-ui,sans-serif",
                  }}>
                    {slot}<br/>
                    <span style={{ fontSize:"0.68rem", fontWeight:400, color: selected ? "rgba(255,255,255,0.7)" : C.muted }}>{occ}/2 inscrits</span>
                  </button>
                );
              })}
              {SLOTS.filter(slot => slotOccupancy(slot) < 2).length === 0 && (
                <div style={{ gridColumn:"1/-1", textAlign:"center", padding:"14px", fontSize:"0.8rem", color:C.muted, fontStyle:"italic" }}>
                  Aucun créneau disponible ce jour
                </div>
              )}
            </div>
          </>
        )}

        {reservation.type === "Nuit" && (
          <div style={{ marginBottom:14, padding:"10px 14px", background: nightOccupied() ? "rgba(233,69,96,0.08)" : "rgba(240,180,41,0.08)", border:`1px solid ${nightOccupied() ? "rgba(233,69,96,0.3)" : "rgba(240,180,41,0.3)"}`, borderRadius:8, fontSize:"0.82rem", color: nightOccupied() ? C.danger : C.gold }}>
            🌙 Nuit · {nightOccupied() ? "Déjà occupée ce jour" : "Disponible"}
          </div>
        )}

        {/* ── Infos personnelles ── */}
        <div style={{ fontSize:"0.72rem", color:C.gold, fontWeight:600, letterSpacing:"0.08em", textTransform:"uppercase", marginBottom:8 }}>
          Tes informations
        </div>
        {[
          { ph:"Prénom *", val:prenom, set:setPrenom },
          { ph:"Nom", val:nom, set:setNom },
          { ph:"Téléphone", val:tel, set:setTel, type:"tel" },
        ].map(({ph,val,set,type="text"}) => (
          <input key={ph} type={type} placeholder={ph} value={val} onChange={e=>set(e.target.value)}
            style={{ width:"100%", padding:"10px 12px", background:C.bg, border:`1px solid ${C.border}`, borderRadius:7, color:C.text, fontSize:"0.9rem", fontFamily:"'DM Sans',system-ui,sans-serif", marginBottom:8, boxSizing:"border-box" }}
          />
        ))}

        <div style={{ display:"flex", gap:8, marginTop:6 }}>
          <button onClick={onClose} style={{ flex:1, padding:11, background:"transparent", color:C.muted, border:`1px solid ${C.border}`, borderRadius:8, cursor:"pointer", fontSize:"0.84rem", fontFamily:"'DM Sans',system-ui,sans-serif" }}>
            Annuler
          </button>
          <button onClick={handleSave} disabled={!canSave || saving} style={{ flex:1.3, padding:11, background: canSave ? C.accent : "rgba(46,117,182,0.3)", color:"#fff", border:"none", borderRadius:8, cursor: canSave ? "pointer" : "default", fontWeight:600, fontSize:"0.84rem", fontFamily:"'DM Sans',system-ui,sans-serif" }}>
            {saving ? "Enregistrement…" : "✓ Enregistrer"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Composant Souvenirs ──────────────────────────────────────────────────────
function SouvenirsTab({ showToast }) {
  const [photos, setPhotos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [selected, setSelected] = useState(new Set());
  const [selectMode, setSelectMode] = useState(false);
  const [lightbox, setLightbox] = useState(null);
  const [prenom, setPrenom] = useState("");
  const [legende, setLegende] = useState("");
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [pendingFile, setPendingFile] = useState(null);
  const [pendingPreview, setPendingPreview] = useState(null);
  const fileInputRef = useRef(null);

  async function loadPhotos() {
    setLoading(true);
    try {
      const { data, error } = await supabase.storage.from("souvenirs").list("", {
        limit: 200,
        sortBy: { column: "created_at", order: "desc" },
      });
      if (error) throw error;
      const photosWithUrls = (data || [])
        .filter(f => f.name !== ".emptyFolderPlaceholder")
        .map(f => {
          const { data: urlData } = supabase.storage.from("souvenirs").getPublicUrl(f.name);
          const parts = f.name.replace(/\.[^.]+$/, "").split("__");
          const ts = parts[0];
          const prenomVal = parts[1] || "";
          const legendeVal = parts[2] || "";
          return {
            name: f.name,
            url: urlData.publicUrl,
            prenom: prenomVal.replace(/-/g, " "),
            legende: legendeVal.replace(/-/g, " "),
            date: new Date(parseInt(ts)),
          };
        });
      setPhotos(photosWithUrls);
    } catch (e) { showToast("Erreur chargement photos : " + e.message); }
    setLoading(false);
  }

  useEffect(() => { loadPhotos(); }, []);

  async function compressImage(file) {
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        const img = new Image();
        img.onload = () => {
          const canvas = document.createElement("canvas");
          const MAX = 1200;
          let w = img.width, h = img.height;
          if (w > MAX || h > MAX) {
            if (w > h) { h = Math.round(h * MAX / w); w = MAX; }
            else { w = Math.round(w * MAX / h); h = MAX; }
          }
          canvas.width = w; canvas.height = h;
          canvas.getContext("2d").drawImage(img, 0, 0, w, h);
          canvas.toBlob((blob) => resolve(blob), "image/jpeg", 0.82);
        };
        img.src = e.target.result;
      };
      reader.readAsDataURL(file);
    });
  }

  function handleFileSelect(e) {
    const file = e.target.files[0];
    if (!file) return;
    setPendingFile(file);
    setPendingPreview(URL.createObjectURL(file));
    setShowUploadModal(true);
    e.target.value = "";
  }

  async function handleUpload() {
    if (!pendingFile || !prenom.trim()) return;
    setUploading(true); setUploadProgress(10);
    try {
      setUploadProgress(30);
      const compressed = await compressImage(pendingFile);
      setUploadProgress(60);
      const ts = Date.now();
      const sanitize = (str) => str.normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-zA-Z0-9]/g, "-").replace(/-+/g, "-").replace(/^-|-$/g, "");
      const prenomClean = sanitize(prenom.trim()) || "Anonyme";
      const legendeClean = sanitize(legende.trim());
      // Séparateur __ entre prénom et légende pour éviter toute ambiguïté au parsing
      const fileName = legendeClean ? `${ts}__${prenomClean}__${legendeClean}.jpg` : `${ts}__${prenomClean}.jpg`;
      const { error } = await supabase.storage.from("souvenirs").upload(fileName, compressed, {
        contentType: "image/jpeg", cacheControl: "3600",
      });
      if (error) throw error;
      setUploadProgress(100);
      showToast("Photo ajoutée ✓");
      setShowUploadModal(false); setPendingFile(null); setPendingPreview(null);
      setPrenom(""); setLegende("");
      loadPhotos();
    } catch (e) { showToast("Erreur upload : " + e.message); }
    setUploading(false); setUploadProgress(0);
  }

  function toggleSelect(name) {
    setSelected(prev => { const n = new Set(prev); n.has(name) ? n.delete(name) : n.add(name); return n; });
  }

  async function downloadSelected() {
    for (const photo of photos.filter(p => selected.has(p.name))) {
      const blob = await (await fetch(photo.url)).blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `souvenir_${photo.prenom}_${photo.date.toLocaleDateString("fr-FR").replace(/\//g,"-")}.jpg`;
      a.click();
      URL.revokeObjectURL(url);
      await new Promise(r => setTimeout(r, 400));
    }
    setSelectMode(false); setSelected(new Set());
  }

  return (
    <div>
      <div style={{ display:"flex", gap:8, marginBottom:16 }}>
        <button onClick={() => fileInputRef.current?.click()} style={{
          flex:1, padding:"13px 0", background:`linear-gradient(135deg, ${C.accent}, #1a5a9e)`,
          color:"#fff", border:"none", borderRadius:10, cursor:"pointer",
          fontWeight:700, fontSize:"0.88rem", fontFamily:"'DM Sans',system-ui,sans-serif",
        }}>📸 Ajouter une photo</button>
        <button onClick={() => { setSelectMode(!selectMode); setSelected(new Set()); }} style={{
          padding:"13px 14px", background: selectMode ? C.orange : "transparent",
          color: selectMode ? "#fff" : C.muted, border:`1px solid ${selectMode ? C.orange : C.border}`,
          borderRadius:10, cursor:"pointer", fontWeight:600, fontSize:"0.82rem",
          fontFamily:"'DM Sans',system-ui,sans-serif",
        }}>{selectMode ? "✕ Annuler" : "☑️ Sélection"}</button>
      </div>

      <input ref={fileInputRef} type="file" accept="image/*" style={{ display:"none" }} onChange={handleFileSelect} />

      {selectMode && selected.size > 0 && (
        <button onClick={downloadSelected} style={{
          width:"100%", padding:"12px", marginBottom:14,
          background:C.success, color:"#fff", border:"none", borderRadius:10,
          cursor:"pointer", fontWeight:700, fontSize:"0.88rem", fontFamily:"'DM Sans',system-ui,sans-serif",
        }}>⬇️ Télécharger {selected.size} photo{selected.size > 1 ? "s" : ""}</button>
      )}

      {loading ? (
        <div style={{ textAlign:"center", color:C.muted, padding:"40px 0", fontSize:"0.85rem" }}>Chargement des souvenirs…</div>
      ) : photos.length === 0 ? (
        <div style={{ textAlign:"center", padding:"50px 20px" }}>
          <div style={{ fontSize:"3rem", marginBottom:12 }}>📷</div>
          <div style={{ color:C.muted, fontSize:"0.88rem", lineHeight:1.6 }}>
            Aucune photo pour l'instant.<br/>Sois le premier à partager un souvenir 💛
          </div>
        </div>
      ) : (
        <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:8 }}>
          {photos.map(photo => {
            const isSel = selected.has(photo.name);
            return (
              <div key={photo.name} onClick={() => selectMode ? toggleSelect(photo.name) : setLightbox(photo)}
                style={{ position:"relative", borderRadius:10, overflow:"hidden", border:`2px solid ${isSel ? C.gold : "transparent"}`, cursor:"pointer", aspectRatio:"1", background:C.card, transition:"border-color 0.15s" }}>
                <img src={photo.url} alt={photo.legende || "Souvenir"} style={{ width:"100%", height:"100%", objectFit:"cover", display:"block" }} />
                {isSel && (
                  <div style={{ position:"absolute", top:6, right:6, width:24, height:24, borderRadius:"50%", background:C.gold, display:"flex", alignItems:"center", justifyContent:"center", fontSize:"0.75rem", fontWeight:700, color:"#0D1B2E" }}>✓</div>
                )}
                <div style={{ position:"absolute", bottom:0, left:0, right:0, background:"linear-gradient(transparent,rgba(0,0,0,0.72))", padding:"20px 8px 8px" }}>
                  {photo.prenom && <div style={{ fontSize:"0.72rem", fontWeight:700, color:"#fff" }}>{photo.prenom}</div>}
                  {photo.legende && <div style={{ fontSize:"0.65rem", color:"rgba(255,255,255,0.75)", marginTop:1, overflow:"hidden", whiteSpace:"nowrap", textOverflow:"ellipsis" }}>{photo.legende}</div>}
                  <div style={{ fontSize:"0.6rem", color:"rgba(255,255,255,0.5)", marginTop:2 }}>{photo.date.toLocaleDateString("fr-FR", { day:"numeric", month:"short" })}</div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Lightbox */}
      {lightbox && (
        <div style={{ position:"fixed", inset:0, background:"rgba(0,0,0,0.95)", zIndex:300, display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center", padding:16 }}
          onClick={() => setLightbox(null)}>
          <img src={lightbox.url} alt={lightbox.legende} style={{ maxWidth:"100%", maxHeight:"72vh", borderRadius:10, objectFit:"contain" }} onClick={e => e.stopPropagation()} />
          <div style={{ marginTop:14, textAlign:"center" }} onClick={e => e.stopPropagation()}>
            {lightbox.prenom && <div style={{ color:"#fff", fontWeight:600, fontSize:"0.9rem" }}>{lightbox.prenom}</div>}
            {lightbox.legende && <div style={{ color:"rgba(255,255,255,0.7)", fontSize:"0.8rem", marginTop:3 }}>{lightbox.legende}</div>}
            <div style={{ color:"rgba(255,255,255,0.4)", fontSize:"0.72rem", marginTop:4 }}>{lightbox.date.toLocaleDateString("fr-FR", { weekday:"long", day:"numeric", month:"long", year:"numeric" })}</div>
            <button onClick={async () => {
              const blob = await (await fetch(lightbox.url)).blob();
              const url = URL.createObjectURL(blob);
              const a = document.createElement("a"); a.href = url; a.download = `souvenir_${lightbox.prenom}.jpg`; a.click(); URL.revokeObjectURL(url);
            }} style={{ marginTop:12, padding:"10px 24px", background:C.accent, color:"#fff", border:"none", borderRadius:8, cursor:"pointer", fontWeight:600, fontSize:"0.82rem", fontFamily:"'DM Sans',system-ui,sans-serif" }}>
              ⬇️ Télécharger
            </button>
          </div>
          <button style={{ position:"absolute", top:16, right:16, background:"rgba(255,255,255,0.15)", border:"none", color:"#fff", width:36, height:36, borderRadius:"50%", cursor:"pointer", fontSize:"1.1rem" }} onClick={() => setLightbox(null)}>✕</button>
        </div>
      )}

      {/* Modal upload */}
      {showUploadModal && (
        <div style={{ position:"fixed", inset:0, background:"rgba(0,0,0,0.85)", zIndex:250, display:"flex", alignItems:"center", justifyContent:"center", padding:16 }}
          onClick={() => !uploading && setShowUploadModal(false)}>
          <div style={{ background:C.card, border:`1px solid ${C.accent}`, borderRadius:14, padding:"22px 18px", width:"100%", maxWidth:360 }}
            onClick={e => e.stopPropagation()}>
            <div style={{ fontFamily:"'Playfair Display',serif", fontSize:"1.05rem", fontWeight:700, color:"#fff", marginBottom:14 }}>📸 Ajouter un souvenir</div>
            {pendingPreview && (
              <div style={{ borderRadius:10, overflow:"hidden", marginBottom:14, aspectRatio:"4/3" }}>
                <img src={pendingPreview} alt="Aperçu" style={{ width:"100%", height:"100%", objectFit:"cover" }} />
              </div>
            )}
            <div style={{ fontSize:"0.72rem", color:C.success, marginBottom:10, display:"flex", alignItems:"center", gap:6 }}>
              ✓ Photo compressée automatiquement avant envoi
            </div>
            {[
              { ph:"Ton prénom *", val:prenom, set:setPrenom },
            ].map(({ ph, val, set }) => (
              <input key={ph} placeholder={ph} value={val} onChange={e => set(e.target.value)}
                style={{ width:"100%", padding:"10px 12px", background:C.bg, border:`1px solid ${C.border}`, borderRadius:7, color:C.text, fontSize:"0.9rem", fontFamily:"'DM Sans',system-ui,sans-serif", marginBottom:8, boxSizing:"border-box" }} />
            ))}
            <textarea
              placeholder="Lieu, date, contexte… ex : Jardin de la maison, été 2023 🌞"
              value={legende}
              onChange={e => setLegende(e.target.value)}
              rows={2}
              style={{ width:"100%", padding:"10px 12px", background:C.bg, border:`1px solid ${C.border}`, borderRadius:7, color:C.text, fontSize:"0.85rem", fontFamily:"'DM Sans',system-ui,sans-serif", marginBottom:8, boxSizing:"border-box", resize:"none", lineHeight:1.5 }}
            />
            {uploading && (
              <div style={{ marginBottom:12 }}>
                <div style={{ height:4, background:C.border, borderRadius:2, overflow:"hidden" }}>
                  <div style={{ height:"100%", width:`${uploadProgress}%`, background:C.accent, borderRadius:2, transition:"width 0.3s" }} />
                </div>
                <div style={{ fontSize:"0.72rem", color:C.muted, marginTop:4, textAlign:"center" }}>
                  {uploadProgress < 50 ? "Compression en cours…" : "Envoi en cours…"}
                </div>
              </div>
            )}
            <div style={{ display:"flex", gap:8, marginTop:6 }}>
              <button onClick={() => { setShowUploadModal(false); setPendingFile(null); setPendingPreview(null); }} disabled={uploading}
                style={{ flex:1, padding:11, background:"transparent", color:C.muted, border:`1px solid ${C.border}`, borderRadius:8, cursor:"pointer", fontSize:"0.84rem", fontFamily:"'DM Sans',system-ui,sans-serif" }}>
                Annuler
              </button>
              <button onClick={handleUpload} disabled={!prenom.trim() || uploading}
                style={{ flex:1.3, padding:11, background: prenom.trim() && !uploading ? C.accent : "rgba(46,117,182,0.3)", color:"#fff", border:"none", borderRadius:8, cursor: prenom.trim() && !uploading ? "pointer" : "default", fontWeight:600, fontSize:"0.84rem", fontFamily:"'DM Sans',system-ui,sans-serif" }}>
                {uploading ? "Envoi…" : "✓ Publier"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── App principale ───────────────────────────────────────────────────────────
export default function App() {
  const [reservations, setReservations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState("calendar");
  const [currentDay, setCurrentDay] = useState(getTodayOrStart());
  const [currentNightDay, setCurrentNightDay] = useState(getTodayOrStart());
  const initialDay = getTodayOrStart();
  const [calMonth, setCalMonth] = useState({ year: initialDay.getFullYear(), month: initialDay.getMonth() });
  const [modal, setModal] = useState(null);
  const [confirmed, setConfirmed] = useState(null);
  const [prenom, setPrenom] = useState("");
  const [nom, setNom] = useState("");
  const [tel, setTel] = useState("");
  const [userPin, setUserPin] = useState(""); // PIN choisi par l'utilisateur
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState("");
  const [photoOpen, setPhotoOpen] = useState(false);
  const [suspendedAlert, setSuspendedAlert] = useState(false);
  const [nextDispoModal, setNextDispoModal] = useState(null);
  const [deferredPrompt, setDeferredPrompt] = useState(null);
  const [installSuccess, setInstallSuccess] = useState(false);
  const [manualInstallOpen, setManualInstallOpen] = useState(false);

  // PIN / modification
  const [pinModal, setPinModal] = useState(null); // reservation ciblée
  const [editingId, setEditingId] = useState(null); // id de la résa en cours de modif (nouvelle résa)
  const [editModal, setEditModal] = useState(null); // résa complète en cours d'édition (date+créneau)

  const [isMobile, setIsMobile] = useState(typeof window !== "undefined" ? window.innerWidth < 640 : false);
  useEffect(() => {
    const handler = () => setIsMobile(window.innerWidth < 640);
    window.addEventListener("resize", handler);
    return () => window.removeEventListener("resize", handler);
  }, []);

  useEffect(() => {
    const handler = (e) => {
      e.preventDefault();
      setDeferredPrompt(e);
    };
    window.addEventListener("beforeinstallprompt", handler);
    window.addEventListener("appinstalled", () => {
      setInstallSuccess(true);
      setDeferredPrompt(null);
    });
    return () => window.removeEventListener("beforeinstallprompt", handler);
  }, []);

  const load = useCallback(async () => {
    try {
      const { data, error } = await supabase.from("reservations").select("*");
      if (error) throw error;
      setReservations(data || []);
    } catch(e) { showToast("Erreur chargement: "+e.message); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => {
    load();
    const ch = supabase.channel("res")
      .on("postgres_changes", { event:"*", schema:"public", table:"reservations" }, load)
      .subscribe();
    return () => supabase.removeChannel(ch);
  }, [load]);

  function showToast(msg) { setToast(msg); setTimeout(() => setToast(""), 3500); }

  function getVisitors(iso, slot) {
    return reservations.filter(r => r.date === iso && r.creneau === slot && r.type === "Visite");
  }
  function getNight(iso) {
    return reservations.find(r => r.date === iso && r.type === "Nuit");
  }

  function findNextDispo() {
    const now = new Date();
    const today = new Date();
    today.setHours(0,0,0,0);
    const currentHour = now.getHours() + now.getMinutes()/60;
    const searchStart = today < START_DATE ? new Date(START_DATE) : today;
    for (let i = 0; i < 90; i++) {
      const d = addDays(searchStart, i);
      const iso = toISO(d);
      const isToday = sameDay(d, today);
      for (const slot of SLOTS) {
        const slotH = parseInt(slot);
        if (isToday && slotH <= currentHour) continue;
        const occ = getVisitors(iso, slot);
        if (occ.length < 2) {
          setNextDispoModal({ date: d, iso, slot });
          return;
        }
      }
    }
    showToast("Aucune disponibilité trouvée dans les 90 prochains jours");
  }

  function openModal(type, date, slot=null, existingResa=null) {
    setModal({ type, date, slot });
    setConfirmed(null);
    if (existingResa) {
      // Mode édition : pré-remplissage
      setPrenom(existingResa.prenom || "");
      setNom(existingResa.nom || "");
      setTel(existingResa.telephone || "");
      setEditingId(existingResa.id);
    } else {
    setPrenom(""); setNom(""); setTel(""); setUserPin("");
      setEditingId(null);
    }
  }

  function bookFromNextDispo() {
    if (!nextDispoModal) return;
    const { iso, slot } = nextDispoModal;
    setNextDispoModal(null);
    openModal("visit", iso, slot);
  }

  async function handleBook() {
    if (!prenom.trim() || (!editingId && userPin.length < 4)) return;
    setSaving(true);
    try {
      if (editingId) {
        // Mise à jour
        const { error } = await supabase.from("reservations").update({
          prenom: prenom.trim(),
          nom: nom.trim(),
          telephone: tel.trim(),
        }).eq("id", editingId);
        if (error) throw error;

        // On récupère le pin existant pour l'afficher dans la confirmation
        const existing = reservations.find(r => r.id === editingId);
        const existingPin = existing?.pin || "—";

        const isNight = modal.type === "night";
        const startH = isNight ? 18 : parseInt(modal.slot);
        const endH = isNight ? 11 : startH + 1;
        const gcal = gcalUrl({
          title: `Visite Rose-Marie · ${HOSPITAL.room}`,
          date: modal.date, startH, endH,
          description: `Visite à ${HOSPITAL.name} - ${HOSPITAL.room}\nDurée : 15-20 min max`,
        });
        setConfirmed({ prenom: prenom.trim(), gcal, pin: existingPin, isEdit: true });
      } else {
        // Nouvelle réservation
        const { error } = await supabase.from("reservations").insert({
          date: modal.date,
          creneau: modal.slot || "🌙 Nuit",
          prenom: prenom.trim(),
          nom: nom.trim(),
          telephone: tel.trim(),
          type: modal.type === "night" ? "Nuit" : "Visite",
          pin: userPin,
        });
        if (error) throw error;

        const isNight = modal.type === "night";
        const startH = isNight ? 18 : parseInt(modal.slot);
        const endH = isNight ? 11 : startH + 1;
        const gcal = gcalUrl({
          title: `Visite Rose-Marie · ${HOSPITAL.room}`,
          date: modal.date, startH, endH,
          description: `Visite à ${HOSPITAL.name} - ${HOSPITAL.room}\nDurée : 15-20 min max\n\n🔐 Ton PIN de modification : ${userPin}`,
        });
        setConfirmed({ prenom: prenom.trim(), gcal, pin: userPin, isEdit: false });
      }
      load();
    } catch(e) { showToast("Erreur : "+e.message); }
    finally { setSaving(false); }
  }

  // Gestion des actions PIN validé — reçoit { action, id, reservation }
  async function handlePinAction({ action, id, reservation }) {
    if (action === "delete") {
      const { error, count } = await supabase
        .from("reservations")
        .delete({ count: "exact" })
        .eq("id", id);
      if (error) { showToast("Erreur suppression : " + error.message); return; }
      if (count === 0) {
        showToast("⚠️ Suppression bloquée — vérifie les policies RLS dans Supabase (autoriser DELETE sans auth)");
        return;
      }
      showToast("Réservation annulée ✓");
      setPinModal(null);
      load();
    } else if (action === "edit") {
      setPinModal(null);
      setEditModal(reservation);
    }
  }

  function prevDay() {
    const prev = addDays(currentDay, -1);
    if (prev >= START_DATE) setCurrentDay(prev);
  }
  function nextDay() { setCurrentDay(addDays(currentDay, 1)); }

  function prevNightDay() {
    const prev = addDays(currentNightDay, -1);
    if (prev >= START_DATE) setCurrentNightDay(prev);
  }
  function nextNightDay() { setCurrentNightDay(addDays(currentNightDay, 1)); }

  async function handleInstall() {
    if (deferredPrompt) {
      deferredPrompt.prompt();
      const { outcome } = await deferredPrompt.userChoice;
      if (outcome === "accepted") setInstallSuccess(true);
      setDeferredPrompt(null);
    } else {
      setManualInstallOpen(true);
    }
  }

  function copyUrl() {
    navigator.clipboard?.writeText(APP_URL);
    showToast("Lien copié dans le presse-papier !");
  }

  const monthDays = getDaysInMonth(calMonth.year, calMonth.month);
  const firstDow = (new Date(calMonth.year, calMonth.month, 1).getDay() + 6) % 7;
  const monthName = new Date(calMonth.year, calMonth.month, 1)
    .toLocaleDateString("fr-FR", { month:"long", year:"numeric" });

  const today = new Date();
  today.setHours(0,0,0,0);

  const TABS = [
    ["calendar","📅 Calendrier"],
    ["slots","🕐 Créneaux"],
    ["nights","🌙 Nuits"],
    ["souvenirs","📸 Souvenirs"],
    ["info","ℹ️ Infos"],
    ["share","📱 Partager"],
    ["install","⬇️ Installer"],
  ];

  if (loading) return (
    <div style={{ minHeight:"100vh", background:C.bg, display:"flex", alignItems:"center", justifyContent:"center", color:C.muted, fontFamily:"DM Sans,sans-serif" }}>
      Chargement…
    </div>
  );

  const device = detectDevice();

  return (
    <div style={{ minHeight:"100vh", background:C.bg, color:C.text, fontFamily:"'DM Sans',system-ui,sans-serif", paddingBottom:80 }}>

      {/* HEADER */}
      <div style={{ background:"linear-gradient(160deg,#0D1B2E 0%,#1F3864 100%)", borderBottom:`1px solid ${C.border}`, padding:"10px 20px 0", textAlign:"center" }}>
        <div
          onClick={() => setPhotoOpen(true)}
          style={{ position:"relative", width:135, height:135, borderRadius:"50%", overflow:"hidden", margin:"4px auto 6px", cursor:"pointer" }}
        >
          <img src={mamanPhoto} alt="Patient" style={{ width:"50%", height:"50%", objectFit:"cover", position:"absolute", top:"45%", left:"50%", transform:"translate(-50%, -50%)", borderRadius:"50%", zIndex:1 }} />
          <img src={iconSans} alt="Logo" style={{ width:"100%", height:"100%", objectFit:"contain", position:"absolute", inset:0, zIndex:2 }} />
        </div>
        <h1 style={{ fontFamily:"'Playfair Display',Georgia,serif", fontSize:"1.7rem", fontWeight:700, color:"#fff", margin:"0 0 3px" }}>
          Visites Rose-Marie
        </h1>
        <p style={{ color:C.gold, fontSize:"0.72rem", letterSpacing:"0.14em", textTransform:"uppercase", fontWeight:500, margin:"0 0 6px" }}>
          {HOSPITAL.room} · CHU Grenoble
        </p>
        <a href={HOSPITAL.mapsUrl} target="_blank" rel="noopener noreferrer"
          style={{ display:"inline-flex", alignItems:"center", gap:4, color:C.accent, fontSize:"0.76rem", textDecoration:"none", marginBottom:10 }}>
          📍 {HOSPITAL.address}
        </a>

        <div style={{ display:"flex", justifyContent:"center", borderTop:`1px solid ${C.border}`, marginTop:6, flexWrap: isMobile ? "wrap" : "nowrap", gap: isMobile ? 0 : 4 }}>
          {TABS.filter(([id]) => id !== "souvenirs").map(([id,label]) => (
            <button key={id} onClick={() => setTab(id)} style={{
              flex: isMobile ? "1 1 33%" : "0 0 auto",
              padding: isMobile ? "10px 4px" : "12px 14px",
              background:"transparent",
              color: tab===id ? "#fff" : C.muted,
              border:"none",
              borderBottom: tab===id ? `2px solid ${C.accent}` : "2px solid transparent",
              cursor:"pointer",
              fontSize: isMobile ? "0.65rem" : "0.7rem",
              fontWeight:600,
              letterSpacing:"0.04em",
              textTransform:"uppercase",
              fontFamily:"'DM Sans',system-ui,sans-serif",
              whiteSpace:"nowrap",
            }}>{label}</button>
          ))}
        </div>
        {/* Onglet Souvenirs — ligne séparée, aligné sous Créneaux→Partager */}
        <div style={{ borderTop:`1px solid ${C.border}`, display:"flex", justifyContent:"center" }}>
          <div style={{ display:"flex", flex: isMobile ? "0 0 66.66%" : "0 0 auto" }}>
            <button onClick={() => setTab("souvenirs")} style={{
              padding: isMobile ? "10px 0" : "12px 28px",
              width: isMobile ? "100%" : "auto",
              background: tab==="souvenirs" ? "rgba(46,117,182,0.15)" : "transparent",
              color: tab==="souvenirs" ? "#fff" : C.muted,
              border:"none",
              borderBottom: tab==="souvenirs" ? `2px solid ${C.accent}` : "2px solid transparent",
              cursor:"pointer",
              fontSize: isMobile ? "0.65rem" : "0.7rem",
              fontWeight:700,
              letterSpacing:"0.06em",
              textTransform:"uppercase",
              fontFamily:"'DM Sans',system-ui,sans-serif",
            }}>📸 Souvenirs</button>
          </div>
        </div>
      </div>

      <div style={{ maxWidth:520, margin:"0 auto", padding:"20px 16px" }}>

        {/* ===== CALENDRIER ===== */}
        {tab === "calendar" && (
          <div>
            <button onClick={findNextDispo} style={{
              width:"100%", padding:"13px", marginBottom:16,
              background:`linear-gradient(135deg, ${C.accent}, #1a5a9e)`,
              color:"#fff", border:"none", borderRadius:10, cursor:"pointer",
              fontWeight:700, fontSize:"0.92rem", fontFamily:"'DM Sans',system-ui,sans-serif",
            }}>⚡ Prochaine disponibilité</button>

            <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:14 }}>
              <button onClick={() => setCalMonth(m => { const d = new Date(m.year, m.month-1, 1); return { year:d.getFullYear(), month:d.getMonth() }; })} style={{ background:"transparent", border:`1px solid ${C.border}`, color:C.text, borderRadius:6, padding:"6px 12px", cursor:"pointer", fontSize:"1rem" }}>‹</button>
              <span style={{ fontFamily:"'Playfair Display',serif", fontSize:"1.05rem", fontWeight:700, textTransform:"capitalize" }}>{monthName}</span>
              <button onClick={() => setCalMonth(m => { const d = new Date(m.year, m.month+1, 1); return { year:d.getFullYear(), month:d.getMonth() }; })} style={{ background:"transparent", border:`1px solid ${C.border}`, color:C.text, borderRadius:6, padding:"6px 12px", cursor:"pointer", fontSize:"1rem" }}>›</button>
            </div>

            <div style={{ display:"grid", gridTemplateColumns:"repeat(7,1fr)", gap:2, marginBottom:4 }}>
              {["L","M","M","J","V","S","D"].map((d,i) => (
                <div key={i} style={{ textAlign:"center", fontSize:"0.7rem", color:C.muted, fontWeight:600, padding:"4px 0" }}>{d}</div>
              ))}
            </div>

            <div style={{ display:"grid", gridTemplateColumns:"repeat(7,1fr)", gap:3 }}>
              {Array(firstDow).fill(null).map((_,i) => <div key={"e"+i} />)}
              {monthDays.map(day => {
                const iso = toISO(day);
                const isPast = day < START_DATE;
                const isToday = sameDay(day, today);
                const status = isPast ? "past" : getDayStatus(reservations, iso, day);
                const isSelected = sameDay(day, currentDay);
                const dotColor = status==="full" ? C.danger : status==="partial" ? C.orange : status==="empty" ? C.success : "transparent";
                return (
                  <div key={iso} onClick={() => { if (!isPast) { setCurrentDay(day); setTab("slots"); } }}
                    style={{ background: isSelected ? C.accent : isPast ? "transparent" : C.card, border: `${isToday ? 2 : 1}px solid ${isSelected ? C.accent : isToday ? C.gold : C.border}`, borderRadius:8, padding:"8px 4px 6px", textAlign:"center", cursor: isPast ? "default" : "pointer", opacity: isPast ? 0.3 : 1 }}>
                    <div style={{ fontSize:"0.85rem", fontWeight:600, color: isSelected ? "#fff" : isToday ? C.gold : C.text }}>
                      {day.getDate()}
                    </div>
                    <div style={{ width:6, height:6, borderRadius:"50%", background:dotColor, margin:"3px auto 0" }} />
                  </div>
                );
              })}
            </div>

            <div style={{ display:"flex", gap:14, marginTop:14, justifyContent:"center", flexWrap:"wrap" }}>
              {[["#3ecf8e","Disponible"],["#f97316","En cours"],["#e94560","Complet"]].map(([color,label]) => (
                <div key={label} style={{ display:"flex", alignItems:"center", gap:5, fontSize:"0.72rem", color:C.muted }}>
                  <div style={{ width:8, height:8, borderRadius:"50%", background:color }} />
                  {label}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ===== CRÉNEAUX ===== */}
        {tab === "slots" && (
          <div>
            <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:20, background:C.card, border:`1px solid ${C.border}`, borderRadius:12, padding:"14px 16px" }}>
              <button onClick={prevDay} disabled={sameDay(currentDay, START_DATE)}
                style={{ background:"transparent", border:`1px solid ${C.border}`, color: sameDay(currentDay,START_DATE) ? C.muted : C.text, borderRadius:6, padding:"8px 14px", cursor: sameDay(currentDay,START_DATE) ? "default" : "pointer", fontSize:"1rem" }}>‹</button>
              <div style={{ textAlign:"center" }}>
                <div style={{ fontFamily:"'Playfair Display',serif", fontSize:"1.05rem", fontWeight:700, color:"#fff", textTransform:"capitalize" }}>
                  {toFrLong(currentDay)}
                </div>
                <div style={{ fontSize:"0.75rem", color:C.muted, marginTop:2 }}>{toFrShort(currentDay)}</div>
              </div>
              <button onClick={nextDay}
                style={{ background:"transparent", border:`1px solid ${C.border}`, color:C.text, borderRadius:6, padding:"8px 14px", cursor:"pointer", fontSize:"1.1rem" }}>›</button>
            </div>

            {SLOTS.map(slot => {
              const iso = toISO(currentDay);
              const occ = getVisitors(iso, slot);
              const full = occ.length >= 2;
              return (
                <div key={slot} style={{ background:C.card, border:`1px solid ${full ? "rgba(233,69,96,0.3)" : C.border}`, borderRadius:10, padding:"14px 16px", marginBottom:10, display:"flex", alignItems:"flex-start", justifyContent:"space-between", gap:10 }}>
                  <div style={{ flex:1 }}>
                    <div style={{ fontFamily:"'Playfair Display',serif", fontSize:"1.3rem", fontWeight:700, color:C.gold }}>{slot}</div>
                    <div style={{ fontSize:"0.75rem", color:C.muted, marginTop:2 }}>{occ.length}/2 inscrits</div>
                    <div style={{ marginTop:4 }}>
                      {occ.length === 0
                        ? <div style={{ fontSize:"0.75rem", color:C.muted }}>——</div>
                        : occ.map(r => (
                            <div key={r.id} style={{ fontSize:"0.78rem", color:C.success }}>
                              ● {r.prenom} {r.nom}
                            </div>
                          ))
                      }
                    </div>
                  </div>
                  <div style={{ display:"flex", flexDirection:"column", gap:6, flexShrink:0 }}>
                    <button onClick={() => !full && openModal("visit", toISO(currentDay), slot)}
                      style={{ padding:"9px 16px", background: full ? "transparent" : C.accent, color: full ? C.muted : "#fff", border: full ? `1px solid ${C.border}` : "none", borderRadius:8, cursor: full ? "default" : "pointer", fontWeight:600, fontSize:"0.78rem", whiteSpace:"nowrap" }}>
                      {full ? "Complet" : "+ Réserver"}
                    </button>
                    {occ.length > 0 && occ.map(r => (
                      <button key={r.id} onClick={() => setPinModal(r)}
                        style={{ padding:"9px 16px", background:C.orange, color:"#fff", border:"none", borderRadius:8, cursor:"pointer", fontWeight:600, fontSize:"0.78rem", whiteSpace:"nowrap" }}>
                        ✏️ Modifier
                      </button>
                    ))}
                  </div>
                </div>
              );
            })}

            {/* Bloc Nuit */}
            {(() => {
              const iso = toISO(currentDay);
              const occ = getNight(iso);
              const full = !!occ;
              const suspended = isNightSuspended(currentDay);

              if (suspended) {
                return (
                  <div onClick={() => setSuspendedAlert(true)}
                    style={{ background:"rgba(122,143,166,0.08)", border:`1px dashed ${C.muted}`, borderRadius:10, padding:"14px 16px", display:"flex", alignItems:"center", justifyContent:"space-between", cursor:"pointer" }}>
                    <div>
                      <div style={{ fontSize:"1.1rem", marginBottom:2 }}>🌙</div>
                      <div style={{ fontSize:"0.82rem", fontWeight:600, color:C.muted }}>Nuitée suspendue</div>
                      <div style={{ fontSize:"0.72rem", color:C.muted, marginTop:2, fontStyle:"italic" }}>Plus de réservation possible</div>
                      {occ && (
                        <div style={{ fontSize:"0.75rem", color:C.success, marginTop:4, display:"flex", alignItems:"center", gap:8 }}>
                          ● {occ.prenom} {occ.nom} (historique)
                          <button onClick={(e) => { e.stopPropagation(); setPinModal(occ); }}
                            style={{ padding:"2px 8px", background:C.orange, color:"#fff", border:"none", borderRadius:5, cursor:"pointer", fontSize:"0.7rem", fontWeight:600 }}>
                            ✏️
                          </button>
                        </div>
                      )}
                    </div>
                    <div style={{ padding:"9px 14px", background:"transparent", color:C.muted, border:`1px solid ${C.border}`, borderRadius:8, fontWeight:600, fontSize:"0.78rem" }}>
                      ℹ️ Info
                    </div>
                  </div>
                );
              }

              return (
                <div style={{ background: full ? "rgba(233,69,96,0.07)" : "rgba(240,180,41,0.07)", border:`1px solid ${full ? "rgba(233,69,96,0.3)" : "rgba(240,180,41,0.3)"}`, borderRadius:10, padding:"14px 16px", marginBottom:10, display:"flex", alignItems:"flex-start", justifyContent:"space-between", gap:10 }}>
                  <div>
                    <div style={{ fontSize:"1.1rem", marginBottom:2 }}>🌙</div>
                    <div style={{ fontSize:"0.82rem", fontWeight:600, color:C.gold }}>Nuit · {occ ? 1 : 0}/1 inscrits</div>
                    <div style={{ fontSize:"0.72rem", color:C.muted, marginTop:2 }}>18h00 → 11h00</div>
                    <div style={{ marginTop:4 }}>
                      {occ
                        ? <div style={{ fontSize:"0.78rem", color:C.success }}>● {occ.prenom} {occ.nom}</div>
                        : <div style={{ fontSize:"0.75rem", color:C.muted }}>—</div>
                      }
                    </div>
                  </div>
                  <div style={{ display:"flex", flexDirection:"column", gap:6, flexShrink:0 }}>
                    <button onClick={() => !full && openModal("night", toISO(currentDay))}
                      style={{ padding:"9px 16px", background: full ? "transparent" : C.gold, color: full ? C.muted : "#0D1B2E", border: full ? `1px solid ${C.border}` : "none", borderRadius:8, cursor: full ? "default" : "pointer", fontWeight:600, fontSize:"0.78rem", whiteSpace:"nowrap" }}>
                      {full ? "Occupé" : "+ Réserver"}
                    </button>
                    {occ && (
                      <button onClick={() => setPinModal(occ)}
                        style={{ padding:"9px 16px", background:C.orange, color:"#fff", border:"none", borderRadius:8, cursor:"pointer", fontWeight:600, fontSize:"0.78rem", whiteSpace:"nowrap" }}>
                        ✏️ Modifier
                      </button>
                    )}
                  </div>
                </div>
              );
            })()}
          </div>
        )}

        {/* ===== NUITS ===== */}
        {tab === "nights" && (
          <div>
            <div style={{ background:"rgba(46,117,182,0.1)", border:`1px solid rgba(46,117,182,0.3)`, borderRadius:10, padding:"12px 14px", marginBottom:16, display:"flex", gap:10, alignItems:"flex-start" }}>
              <span style={{ fontSize:"1.1rem" }}>ℹ️</span>
              <div style={{ fontSize:"0.78rem", color:C.text, lineHeight:1.5 }}>
                <strong style={{ color:C.accent }}>Nuitées suspendues depuis le 15/05/2026.</strong><br/>
                Cet onglet permet de consulter l'historique des nuits passées.
              </div>
            </div>

            <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:20, background:C.card, border:`1px solid ${C.border}`, borderRadius:12, padding:"14px 16px" }}>
              <button onClick={prevNightDay} disabled={sameDay(currentNightDay, START_DATE)}
                style={{ background:"transparent", border:`1px solid ${C.border}`, color: sameDay(currentNightDay,START_DATE) ? C.muted : C.text, borderRadius:6, padding:"8px 14px", cursor: sameDay(currentNightDay,START_DATE) ? "default" : "pointer", fontSize:"1rem" }}>‹</button>
              <div style={{ textAlign:"center" }}>
                <div style={{ fontFamily:"'Playfair Display',serif", fontSize:"1.05rem", fontWeight:700, color:"#fff", textTransform:"capitalize" }}>
                  {toFrLong(currentNightDay)}
                </div>
                <div style={{ fontSize:"0.75rem", color:C.muted, marginTop:2 }}>{toFrShort(currentNightDay)}</div>
              </div>
              <button onClick={nextNightDay}
                style={{ background:"transparent", border:`1px solid ${C.border}`, color:C.text, borderRadius:6, padding:"8px 14px", cursor:"pointer", fontSize:"1.1rem" }}>›</button>
            </div>

            {(() => {
              const iso = toISO(currentNightDay);
              const occ = getNight(iso);
              const suspended = isNightSuspended(currentNightDay);
              return (
                <div style={{ background: suspended ? "rgba(122,143,166,0.08)" : (occ ? "rgba(62,207,142,0.07)" : "rgba(240,180,41,0.07)"), border:`1px solid ${suspended ? C.border : (occ ? "rgba(62,207,142,0.3)" : "rgba(240,180,41,0.3)")}`, borderRadius:12, padding:"24px 20px", textAlign:"center" }}>
                  <div style={{ fontSize:"2.4rem", marginBottom:10, opacity: suspended ? 0.5 : 1 }}>🌙</div>
                  <div style={{ fontFamily:"'Playfair Display',serif", fontSize:"1.3rem", fontWeight:700, color: suspended ? C.muted : C.gold, marginBottom:6 }}>
                    Nuit du {toFrShort(currentNightDay)}
                  </div>
                  {suspended && <div style={{ fontSize:"0.78rem", color:C.muted, marginBottom:12, fontStyle:"italic" }}>Nuitée suspendue</div>}
                  <div style={{ fontSize:"0.85rem", color:C.muted, marginBottom:16 }}>18h00 → 11h00 le lendemain</div>
                  <div style={{ marginBottom:18, minHeight:24 }}>
                    {occ
                      ? <div style={{ fontSize:"0.92rem", color:C.success, fontWeight:600 }}>
                          ● {occ.prenom} {occ.nom}
                        </div>
                      : <div style={{ fontSize:"0.85rem", color:C.muted }}>Aucune personne inscrite</div>
                    }
                  </div>
                  {suspended ? (
                    <button onClick={() => setSuspendedAlert(true)}
                      style={{ padding:"12px 28px", background:"transparent", color:C.muted, border:`1px solid ${C.border}`, borderRadius:8, cursor:"pointer", fontWeight:600, fontSize:"0.85rem", fontFamily:"'DM Sans',system-ui,sans-serif" }}>
                      ℹ️ Pourquoi suspendu ?
                    </button>
                  ) : (
                    <button onClick={() => !occ && openModal("night", iso)}
                      style={{ padding:"12px 28px", background: occ ? "transparent" : C.gold, color: occ ? C.muted : "#0D1B2E", border: occ ? `1px solid ${C.border}` : "none", borderRadius:8, cursor: occ ? "default" : "pointer", fontWeight:600, fontSize:"0.85rem", fontFamily:"'DM Sans',system-ui,sans-serif" }}>
                      {occ ? "Occupée" : "+ Réserver cette nuit"}
                    </button>
                  )}
                </div>
              );
            })()}

            <div style={{ marginTop:24 }}>
              <div style={{ fontSize:"0.75rem", color:C.muted, fontWeight:600, letterSpacing:"0.08em", textTransform:"uppercase", marginBottom:10 }}>
                Historique des nuits
              </div>
              {reservations.filter(r => r.type === "Nuit").sort((a,b) => a.date.localeCompare(b.date)).map(r => (
                <div key={r.id} style={{ background:C.card, border:`1px solid ${C.border}`, borderRadius:8, padding:"10px 14px", marginBottom:6, display:"flex", alignItems:"center", justifyContent:"space-between" }}>
                  <div>
                    <div style={{ fontSize:"0.84rem", color:C.text, fontWeight:500 }}>
                      {toFrLong(new Date(r.date+"T12:00:00"))}
                    </div>
                    <div style={{ fontSize:"0.72rem", color:C.success, marginTop:2 }}>
                      ● {r.prenom} {r.nom}
                    </div>
                  </div>
                  <div style={{ fontSize:"0.7rem", color:C.muted, fontWeight:600 }}>
                    {toFrShort(new Date(r.date+"T12:00:00"))}
                  </div>
                </div>
              ))}
              {reservations.filter(r => r.type === "Nuit").length === 0 && (
                <div style={{ textAlign:"center", color:C.muted, fontSize:"0.82rem", padding:"20px 0", fontStyle:"italic" }}>
                  Aucune nuit dans l'historique
                </div>
              )}
            </div>
          </div>
        )}

        {/* ===== SOUVENIRS ===== */}
        {tab === "souvenirs" && (
          <SouvenirsTab showToast={showToast} />
        )}

        {/* ===== INFOS ===== */}
        {tab === "info" && (
          <div>
            <div style={{ background:C.card, border:`1px solid ${C.border}`, borderRadius:12, padding:"18px 18px", marginBottom:12 }}>
              <h2 style={{ fontFamily:"'Playfair Display',serif", fontSize:"1.1rem", margin:"0 0 16px", color:"#fff" }}>Consignes de visite</h2>
              {RULES.map((r,i) => (
                <div key={i} style={{ display:"flex", gap:12, alignItems:"flex-start", marginBottom:14 }}>
                  <span style={{ fontSize:"1.1rem", flexShrink:0, lineHeight:1.4 }}>{r.icon}</span>
                  <span style={{ fontSize:"0.86rem", color:C.text, lineHeight:1.5 }}>{r.text}</span>
                </div>
              ))}
            </div>
            <div style={{ background:C.card, border:`1px solid ${C.border}`, borderRadius:12, padding:"16px 18px" }}>
              <div style={{ fontSize:"0.8rem", fontWeight:600, color:C.accent, marginBottom:8 }}>📍 Adresse</div>
              <div style={{ fontSize:"0.86rem", color:C.text }}>{HOSPITAL.name}</div>
              <div style={{ fontSize:"0.84rem", color:C.muted, marginTop:2 }}>{HOSPITAL.address}</div>
              <a href={HOSPITAL.mapsUrl} target="_blank" rel="noopener noreferrer"
                style={{ display:"inline-block", marginTop:10, fontSize:"0.8rem", color:C.accent, textDecoration:"none" }}>
                Ouvrir dans Google Maps →
              </a>
            </div>
          </div>
        )}

        {/* ===== PARTAGER ===== */}
        {tab === "share" && (
          <div>
            <div style={{ background:C.card, border:`1px solid ${C.border}`, borderRadius:12, padding:"20px 18px", marginBottom:12, textAlign:"center" }}>
              <h2 style={{ fontFamily:"'Playfair Display',serif", fontSize:"1.15rem", margin:"0 0 6px", color:"#fff" }}>📱 Partager l'app</h2>
              <p style={{ fontSize:"0.82rem", color:C.muted, margin:"0 0 18px" }}>
                Fais scanner ce QR code par un autre téléphone pour partager l'application
              </p>
              <div style={{ background:"#fff", padding:14, borderRadius:12, display:"inline-block", marginBottom:14 }}>
                <img
                  src={`https://api.qrserver.com/v1/create-qr-code/?size=280x280&data=${encodeURIComponent(APP_URL)}&color=1F3864&bgcolor=ffffff&margin=0`}
                  alt="QR Code"
                  style={{ display:"block", width:240, height:240 }}
                />
              </div>
              <div style={{ fontSize:"0.78rem", color:C.muted, marginBottom:6 }}>Lien direct :</div>
              <div style={{ fontSize:"0.82rem", color:C.gold, fontWeight:600, wordBreak:"break-all", padding:"8px 12px", background:C.bg, borderRadius:8, border:`1px solid ${C.border}`, marginBottom:12 }}>
                {APP_URL}
              </div>
              <button onClick={copyUrl} style={{ width:"100%", padding:"11px", background:C.accent, color:"#fff", border:"none", borderRadius:8, cursor:"pointer", fontWeight:600, fontSize:"0.85rem", fontFamily:"'DM Sans',system-ui,sans-serif" }}>
                📋 Copier le lien
              </button>
            </div>
            <div style={{ background:C.card, border:`1px solid ${C.border}`, borderRadius:12, padding:"16px 18px" }}>
              <h3 style={{ fontFamily:"'Playfair Display',serif", fontSize:"0.95rem", margin:"0 0 12px", color:"#fff" }}>Comment ça marche ?</h3>
              <ol style={{ margin:0, paddingLeft:20, fontSize:"0.82rem", color:C.text, lineHeight:1.7 }}>
                <li>Affiche cet écran sur ton téléphone</li>
                <li>L'autre personne ouvre l'<strong style={{color:C.gold}}>appareil photo</strong> de son téléphone</li>
                <li>Elle pointe la caméra vers le QR code</li>
                <li>Un lien apparaît, elle tape dessus 👉</li>
                <li>L'app s'ouvre ! Elle peut ensuite l'installer (onglet "Installer")</li>
              </ol>
              <div style={{ fontSize:"0.75rem", color:C.muted, fontStyle:"italic", marginTop:12, padding:"10px 12px", background:C.bg, borderRadius:6, border:`1px solid ${C.border}` }}>
                💡 Tu peux aussi envoyer le lien directement par{" "}
                <a href={`sms:?body=${encodeURIComponent("Planning visites Rose-Marie : " + APP_URL)}`}
                  style={{ color:C.accent, textDecoration:"none", fontWeight:600 }}>SMS</a>
                {" "}ou{" "}
                <a href={`https://wa.me/?text=${encodeURIComponent("Planning visites Rose-Marie : " + APP_URL)}`}
                  target="_blank" rel="noopener noreferrer"
                  style={{ color:"#25D366", textDecoration:"none", fontWeight:600 }}>WhatsApp</a>
              </div>
              <div style={{ fontSize:"0.75rem", color:C.muted, marginTop:10, padding:"10px 12px", background:C.bg, borderRadius:6, border:`1px solid ${C.border}` }}>
                Problème technique ? Contacte Guillaume au{" "}
                <a href="tel:0617927600" style={{ color:C.accent, textDecoration:"none", fontWeight:600 }}>06.17.92.76.00</a> !
              </div>
            </div>
          </div>
        )}

        {/* ===== INSTALLER ===== */}
        {tab === "install" && (
          <div>
            <div style={{ background:C.card, border:`1px solid ${C.border}`, borderRadius:12, padding:"24px 20px", marginBottom:14, textAlign:"center" }}>
              <div style={{ fontSize:"3rem", marginBottom:8 }}>📲</div>
              <h2 style={{ fontFamily:"'Playfair Display',serif", fontSize:"1.2rem", margin:"0 0 6px", color:"#fff" }}>Installer l'application</h2>
              <p style={{ fontSize:"0.84rem", color:C.muted, margin:"0 0 22px", lineHeight:1.5 }}>
                Ajoute l'app sur ton écran d'accueil pour y accéder en 1 clic.
              </p>
              {installSuccess ? (
                <div style={{ padding:"14px", background:"rgba(62,207,142,0.15)", border:`1px solid ${C.success}`, borderRadius:10, color:C.success, fontWeight:600, fontSize:"0.9rem" }}>
                  ✅ Application installée avec succès !
                </div>
              ) : (
                <>
                  <button onClick={handleInstall} style={{ width:"100%", padding:"16px", background:`linear-gradient(135deg, ${C.gold}, #c69100)`, color:"#0D1B2E", border:"none", borderRadius:12, cursor:"pointer", fontWeight:700, fontSize:"1rem", fontFamily:"'DM Sans',system-ui,sans-serif", boxShadow:"0 4px 18px rgba(240,180,41,0.35)", marginBottom:10 }}>
                    📲 {deferredPrompt ? "Installer maintenant" : "Comment installer ?"}
                  </button>
                  {!deferredPrompt && (
                    <p style={{ fontSize:"0.72rem", color:C.muted, margin:"0 0 14px", fontStyle:"italic" }}>
                      Ton navigateur ne supporte pas l'installation automatique. Touche le bouton pour voir comment faire.
                    </p>
                  )}
                  <button onClick={async () => {
                    if (navigator.share) {
                      try { await navigator.share({ title: "Visites Rose-Marie", text: "Planning des visites à l'hôpital Michallon", url: APP_URL }); } catch(e) {}
                    } else {
                      navigator.clipboard?.writeText(APP_URL);
                      showToast("Lien copié — colle-le où tu veux !");
                    }
                  }} style={{ width:"100%", padding:"12px", background:"transparent", color:C.accent, border:`1px solid ${C.accent}`, borderRadius:10, cursor:"pointer", fontWeight:600, fontSize:"0.85rem", fontFamily:"'DM Sans',system-ui,sans-serif" }}>
                    📤 Envoyer le lien par SMS/WhatsApp
                  </button>
                </>
              )}
            </div>
            <div style={{ background:"rgba(46,117,182,0.08)", border:`1px solid rgba(46,117,182,0.25)`, borderRadius:12, padding:"14px 16px", display:"flex", gap:14, alignItems:"center" }}>
              <div style={{ position:"relative", width:84, height:84, borderRadius:"50%", overflow:"hidden", flexShrink:0 }}>
                <img src={mamanPhoto} alt="Patient" style={{ width:"52%", height:"52%", objectFit:"cover", position:"absolute", top:"50%", left:"50%", transform:"translate(-50%, -50%)", borderRadius:"50%", zIndex:1 }} />
                <img src={iconSans} alt="Logo" style={{ width:"100%", height:"100%", objectFit:"contain", position:"absolute", inset:0, zIndex:2 }} />
              </div>
              <div>
                <div style={{ fontSize:"0.82rem", color:C.text, fontWeight:600 }}>Planning Visites</div>
                <div style={{ fontSize:"0.72rem", color:C.muted, marginTop:2 }}>
                  L'icône qui apparaîtra sur ton écran d'accueil ↑
                </div>
                <div style={{ fontSize:"0.72rem", color:C.muted, marginTop:6, lineHeight:1.5 }}>
                  Problème technique ? Contacte Guillaume au{" "}
                  <a href="tel:0617927600" style={{ color:C.accent, textDecoration:"none", fontWeight:600 }}>06.17.92.76.00</a> !
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ── MODAL ÉDITION COMPLÈTE (date + créneau + infos) ── */}
        {editModal && (
          <EditFullModal
            reservation={editModal}
            reservations={reservations}
            onClose={() => setEditModal(null)}
            onSave={async (updates) => {
              const { error, count } = await supabase.from("reservations").update({
                date: updates.date,
                creneau: updates.creneau,
                prenom: updates.prenom.trim(),
                nom: updates.nom.trim(),
                telephone: updates.telephone.trim(),
              }, { count: "exact" }).eq("id", editModal.id);
              if (error) { showToast("Erreur : "+error.message); return; }
              if (count === 0) {
                showToast("⚠️ Modification bloquée — vérifie les policies RLS dans Supabase (autoriser UPDATE sans auth)");
                return;
              }
              showToast("Réservation modifiée ✓");
              setEditModal(null);
              load();
            }}
          />
        )}

        {/* ── MODAL PIN ── */}
        {pinModal && (
          <PinModal
            reservation={pinModal}
            onClose={() => setPinModal(null)}
            onSuccess={handlePinAction}
          />
        )}

        {/* ── MODAL INSTALLATION MANUELLE ── */}
        {manualInstallOpen && (
          <div style={{ position:"fixed", inset:0, background:"rgba(0,0,0,0.85)", display:"flex", alignItems:"center", justifyContent:"center", zIndex:120, padding:16, overflowY:"auto" }}
            onClick={() => setManualInstallOpen(false)}>
            <div style={{ background:C.card, border:`1px solid ${C.accent}`, borderRadius:14, padding:"22px 20px", width:"100%", maxWidth:380, maxHeight:"90vh", overflowY:"auto" }}
              onClick={e => e.stopPropagation()}>
              <div style={{ textAlign:"center", marginBottom:18 }}>
                <div style={{ fontSize:"2.4rem", marginBottom:6 }}>📲</div>
                <h3 style={{ fontFamily:"'Playfair Display',serif", fontSize:"1.15rem", margin:"0 0 4px", color:"#fff" }}>Comment installer ?</h3>
                <p style={{ fontSize:"0.76rem", color:C.muted, margin:0 }}>
                  {device === "ios" ? "Sur iPhone / iPad" : device === "android" ? "Sur Android" : "Sur ordinateur"}
                </p>
              </div>
              {device === "ios" && (
                <>
                  <div style={{ background:"rgba(233,69,96,0.1)", border:`1px solid rgba(233,69,96,0.3)`, borderRadius:8, padding:"10px 12px", marginBottom:14, fontSize:"0.78rem", color:C.danger }}>
                    ⚠️ Tu dois utiliser <strong>Safari</strong> (pas Chrome ni Firefox)
                  </div>
                  {[
                    ["1", <>Touche le bouton <strong style={{color:C.gold}}>Partager</strong> en bas de Safari (carré avec une flèche ↑)</>],
                    ["2", <>Fais défiler et touche <strong style={{color:C.gold}}>"Sur l'écran d'accueil"</strong> (icône ⊕)</>],
                    ["3", <>Touche <strong style={{color:C.gold}}>"Ajouter"</strong> en haut à droite</>],
                  ].map(([n, txt]) => (
                    <div key={n} style={{ display:"flex", gap:12, alignItems:"flex-start", marginBottom:14, fontSize:"0.86rem", color:C.text, lineHeight:1.6 }}>
                      <span style={{ background:C.accent, color:"#fff", width:26, height:26, borderRadius:"50%", display:"flex", alignItems:"center", justifyContent:"center", fontSize:"0.82rem", fontWeight:700, flexShrink:0 }}>{n}</span>
                      <span>{txt}</span>
                    </div>
                  ))}
                </>
              )}
              {device === "android" && (
                <>
                  {[
                    ["1", <>Touche le menu <strong style={{color:C.gold}}>⋮</strong> (3 points) en haut à droite de Chrome</>],
                    ["2", <>Touche <strong style={{color:C.gold}}>"Ajouter à l'écran d'accueil"</strong> ou <strong style={{color:C.gold}}>"Installer l'application"</strong></>],
                    ["3", <>Confirme en touchant <strong style={{color:C.gold}}>"Ajouter"</strong> ou <strong style={{color:C.gold}}>"Installer"</strong></>],
                  ].map(([n, txt]) => (
                    <div key={n} style={{ display:"flex", gap:12, alignItems:"flex-start", marginBottom:14, fontSize:"0.86rem", color:C.text, lineHeight:1.6 }}>
                      <span style={{ background:C.accent, color:"#fff", width:26, height:26, borderRadius:"50%", display:"flex", alignItems:"center", justifyContent:"center", fontSize:"0.82rem", fontWeight:700, flexShrink:0 }}>{n}</span>
                      <span>{txt}</span>
                    </div>
                  ))}
                </>
              )}
              {device === "desktop" && (
                <>
                  {[
                    ["1", <>Dans <strong style={{color:C.gold}}>Chrome</strong> ou <strong style={{color:C.gold}}>Edge</strong>, regarde à droite de la barre d'adresse</>],
                    ["2", <>Clique sur l'icône <strong style={{color:C.gold}}>⬇️</strong> ou <strong style={{color:C.gold}}>🖥️</strong> "Installer"</>],
                    ["3", <>Sinon : menu <strong style={{color:C.gold}}>⋮</strong> → <strong style={{color:C.gold}}>"Installer Visites Rose-Marie..."</strong></>],
                  ].map(([n, txt]) => (
                    <div key={n} style={{ display:"flex", gap:12, alignItems:"flex-start", marginBottom:14, fontSize:"0.86rem", color:C.text, lineHeight:1.6 }}>
                      <span style={{ background:C.accent, color:"#fff", width:26, height:26, borderRadius:"50%", display:"flex", alignItems:"center", justifyContent:"center", fontSize:"0.82rem", fontWeight:700, flexShrink:0 }}>{n}</span>
                      <span>{txt}</span>
                    </div>
                  ))}
                </>
              )}
              <button style={{ width:"100%", padding:11, background:C.accent, color:"#fff", border:"none", borderRadius:8, cursor:"pointer", fontWeight:600, fontSize:"0.84rem", fontFamily:"'DM Sans',system-ui,sans-serif", marginTop:14 }}
                onClick={() => setManualInstallOpen(false)}>
                J'ai compris
              </button>
            </div>
          </div>
        )}

        {/* ── MODAL PHOTO ── */}
        {photoOpen && (
          <div style={{ position:"fixed", inset:0, background:"rgba(0,0,0,0.92)", display:"flex", alignItems:"center", justifyContent:"center", zIndex:150, padding:16, cursor:"pointer" }}
            onClick={() => setPhotoOpen(false)}>
            <div style={{ width:350, height:350, borderRadius:"50%", border:`4px solid ${C.gold}`, overflow:"hidden", boxShadow:"0 0 0 6px rgba(240,180,41,0.2), 0 20px 60px rgba(0,0,0,0.6)" }}>
              <img src={mamanPhoto} alt="Rose-Marie" style={{ width:"100%", height:"100%", objectFit:"cover" }} />
            </div>
          </div>
        )}

        {/* ── MODAL NUITÉE SUSPENDUE ── */}
        {suspendedAlert && (
          <div style={{ position:"fixed", inset:0, background:"rgba(0,0,0,0.8)", display:"flex", alignItems:"center", justifyContent:"center", zIndex:100, padding:16 }}
            onClick={() => setSuspendedAlert(false)}>
            <div style={{ background:C.card, border:`1px solid ${C.muted}`, borderRadius:14, padding:"24px 20px", width:"100%", maxWidth:360, textAlign:"center" }}
              onClick={e => e.stopPropagation()}>
              <div style={{ fontSize:"2.4rem", marginBottom:10 }}>🌙</div>
              <h3 style={{ fontFamily:"'Playfair Display',serif", fontSize:"1.15rem", margin:"0 0 12px", color:"#fff" }}>Nuitées suspendues</h3>
              <p style={{ fontSize:"0.86rem", color:C.text, lineHeight:1.6, margin:"0 0 8px" }}>
                Les nuitées familiales sont <strong style={{color:C.gold}}>suspendues depuis le 15/05/2026</strong>.
              </p>
              <p style={{ fontSize:"0.8rem", color:C.muted, lineHeight:1.5, margin:"0 0 18px" }}>
                Tu peux toujours consulter l'historique des nuits passées dans l'onglet 🌙 Nuits.
              </p>
              <button style={{ width:"100%", padding:"11px", background:C.accent, color:"#fff", border:"none", borderRadius:8, cursor:"pointer", fontWeight:600, fontSize:"0.85rem", fontFamily:"'DM Sans',system-ui,sans-serif" }}
                onClick={() => setSuspendedAlert(false)}>
                Compris
              </button>
            </div>
          </div>
        )}

        {/* ── MODAL PROCHAINE DISPO ── */}
        {nextDispoModal && (
          <div style={{ position:"fixed", inset:0, background:"rgba(0,0,0,0.8)", display:"flex", alignItems:"center", justifyContent:"center", zIndex:100, padding:16 }}
            onClick={() => setNextDispoModal(null)}>
            <div style={{ background:C.card, border:`1px solid ${C.accent}`, borderRadius:14, padding:"24px 20px", width:"100%", maxWidth:360, textAlign:"center" }}
              onClick={e => e.stopPropagation()}>
              <div style={{ fontSize:"2.4rem", marginBottom:8 }}>⚡</div>
              <div style={{ fontSize:"0.72rem", color:C.gold, letterSpacing:"0.1em", textTransform:"uppercase", fontWeight:600, marginBottom:10 }}>
                Prochaine disponibilité
              </div>
              <div style={{ fontFamily:"'Playfair Display',serif", fontSize:"1.3rem", fontWeight:700, color:"#fff", marginBottom:4, textTransform:"capitalize" }}>
                {toFrLong(nextDispoModal.date)}
              </div>
              <div style={{ fontSize:"2rem", fontWeight:700, color:C.gold, fontFamily:"'Playfair Display',serif", margin:"8px 0 6px" }}>
                {nextDispoModal.slot}
              </div>
              <div style={{ fontSize:"0.78rem", color:C.muted, marginBottom:20 }}>
                Visite de 15-20 min · 2 personnes max
              </div>
              <div style={{ display:"flex", gap:8 }}>
                <button onClick={() => { setCurrentDay(nextDispoModal.date); setTab("slots"); setNextDispoModal(null); }}
                  style={{ flex:1, padding:11, background:"transparent", color:C.muted, border:`1px solid ${C.border}`, borderRadius:8, cursor:"pointer", fontWeight:500, fontSize:"0.82rem", fontFamily:"'DM Sans',system-ui,sans-serif" }}>
                  Voir le jour
                </button>
                <button onClick={bookFromNextDispo}
                  style={{ flex:1.3, padding:11, background:C.accent, color:"#fff", border:"none", borderRadius:8, cursor:"pointer", fontWeight:700, fontSize:"0.82rem", fontFamily:"'DM Sans',system-ui,sans-serif" }}>
                  ✓ Réserver
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ── MODAL RÉSERVATION ── */}
        {modal && (
          <div style={{ position:"fixed", inset:0, background:"rgba(0,0,0,0.8)", display:"flex", alignItems:"center", justifyContent:"center", zIndex:100, padding:16, overflowY:"auto" }}
            onClick={() => setModal(null)}>
            <div style={{ background:C.card, border:`1px solid ${C.accent}`, borderRadius:14, padding:"24px 20px", width:"100%", maxWidth:360, marginTop:"auto", marginBottom:"auto" }}
              onClick={e => e.stopPropagation()}>
              {!confirmed ? (
                <>
                  <div style={{ fontFamily:"'Playfair Display',serif", fontSize:"1.15rem", fontWeight:700, margin:"0 0 3px", color:"#fff" }}>
                    {editingId ? "✏️ Modifier la réservation" : (modal.type==="night" ? "🌙 Réserver une nuit" : `🕐 Visite ${modal.slot}`)}
                  </div>
                  <p style={{ fontSize:"0.8rem", color:C.muted, margin:"0 0 16px" }}>
                    {toFrLong(new Date(modal.date+"T12:00:00"))} · {modal.type==="night" ? "18h → 11h" : "15-20 min max"}
                  </p>

                  {/* Champs infos */}
                  {[
                    { ph:"Prénom *", val:prenom, set:setPrenom },
                    { ph:"Nom", val:nom, set:setNom },
                    { ph:"Téléphone", val:tel, set:setTel, type:"tel" },
                  ].map(({ph,val,set,type="text"}) => (
                    <input key={ph} type={type} placeholder={ph} value={val} onChange={e=>set(e.target.value)}
                      style={{ width:"100%", padding:"10px 12px", background:C.bg, border:`1px solid ${C.border}`, borderRadius:7, color:C.text, fontSize:"0.92rem", fontFamily:"'DM Sans',system-ui,sans-serif", marginBottom:8, boxSizing:"border-box" }}
                    />
                  ))}

                  {/* Choix du PIN — uniquement à la création */}
                  {!editingId && (
                    <div style={{ marginTop:8, marginBottom:4 }}>
                      <div style={{ fontSize:"0.72rem", color:C.gold, fontWeight:600, letterSpacing:"0.08em", textTransform:"uppercase", marginBottom:8 }}>
                        🔐 Choisis ton code PIN (4 chiffres)
                      </div>
                      <p style={{ fontSize:"0.72rem", color:C.muted, margin:"0 0 10px", lineHeight:1.4 }}>
                        Ce code te permettra de modifier ou annuler ta visite plus tard.
                      </p>
                      {/* Affichage des 4 cases */}
                      <div style={{ display:"flex", gap:8, justifyContent:"center", marginBottom:10 }}>
                        {[0,1,2,3].map(i => (
                          <div key={i} style={{
                            width:48, height:54, borderRadius:8,
                            border:`2px solid ${userPin.length > i ? C.gold : C.border}`,
                            background: C.bg,
                            display:"flex", alignItems:"center", justifyContent:"center",
                            fontSize:"1.4rem", fontWeight:700, color:C.gold,
                            transition:"border-color 0.2s",
                          }}>
                            {userPin[i] ? "●" : ""}
                          </div>
                        ))}
                      </div>
                      {/* Clavier numérique */}
                      <div style={{ display:"grid", gridTemplateColumns:"repeat(3,1fr)", gap:6 }}>
                        {[1,2,3,4,5,6,7,8,9,"",0,"⌫"].map((k, i) => (
                          <button key={i} onClick={() => {
                            if (k === "⌫") setUserPin(p => p.slice(0,-1));
                            else if (k !== "" && userPin.length < 4) setUserPin(p => p + String(k));
                          }} style={{
                            padding:"12px 0",
                            background: k === "" ? "transparent" : k === "⌫" ? "rgba(233,69,96,0.1)" : C.bg,
                            border: k === "" ? "none" : `1px solid ${k === "⌫" ? "rgba(233,69,96,0.3)" : C.border}`,
                            borderRadius:7,
                            color: k === "⌫" ? C.danger : C.text,
                            fontSize:"1rem", fontWeight:600,
                            cursor: k === "" ? "default" : "pointer",
                            fontFamily:"'DM Sans',system-ui,sans-serif",
                          }}>
                            {k}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}

                  <div style={{ display:"flex", gap:8, marginTop:14 }}>
                    <button style={{ flex:1, padding:11, background:"transparent", color:C.muted, border:`1px solid ${C.border}`, borderRadius:8, cursor:"pointer", fontWeight:500, fontSize:"0.84rem", fontFamily:"'DM Sans',system-ui,sans-serif" }}
                      onClick={() => setModal(null)}>Annuler</button>
                    <button style={{ flex:1, padding:11, background:C.accent, color:"#fff", border:"none", borderRadius:8, fontWeight:600, fontSize:"0.84rem", fontFamily:"'DM Sans',system-ui,sans-serif", opacity: (!prenom.trim() || saving || (!editingId && userPin.length < 4)) ? 0.5 : 1, cursor: (!prenom.trim() || saving || (!editingId && userPin.length < 4)) ? "default" : "pointer" }}
                      onClick={handleBook} disabled={!prenom.trim() || saving || (!editingId && userPin.length < 4)}>
                      {saving ? "Envoi…" : editingId ? "Enregistrer" : "Confirmer"}
                    </button>
                  </div>
                </>
              ) : (
                <>
                  <div style={{ textAlign:"center", padding:"8px 0" }}>
                    <div style={{ fontSize:"2.4rem", marginBottom:6 }}>{confirmed.isEdit ? "✅" : "🎉"}</div>
                    <div style={{ fontSize:"1.05rem", fontWeight:700, color:C.success, margin:"0 0 4px" }}>
                      {confirmed.isEdit ? "Modification enregistrée !" : `Merci ${confirmed.prenom} !`}
                    </div>
                    <p style={{ fontSize:"0.8rem", color:C.muted, margin:"0 0 14px" }}>
                      {confirmed.isEdit ? "Tes informations ont bien été mises à jour." : "Ta visite est enregistrée. Rose-Marie sera heureuse de te voir 💛"}
                    </p>
                    {!confirmed.isEdit && (
                      <div style={{ background:"rgba(240,180,41,0.1)", border:`1px solid rgba(240,180,41,0.4)`, borderRadius:10, padding:"14px 16px", marginBottom:14 }}>
                        <div style={{ fontSize:"0.72rem", color:C.gold, fontWeight:600, letterSpacing:"0.08em", textTransform:"uppercase", marginBottom:6 }}>
                          🔐 Ton code PIN
                        </div>
                        <div style={{ fontFamily:"'Playfair Display',serif", fontSize:"2.2rem", fontWeight:700, color:C.gold, letterSpacing:"0.2em" }}>
                          {confirmed.pin}
                        </div>
                        <div style={{ fontSize:"0.72rem", color:C.muted, marginTop:6, lineHeight:1.4 }}>
                          Note ce code — tu en auras besoin pour modifier ou annuler ta réservation.
                        </div>
                      </div>
                    )}
                  </div>
                  <a href={confirmed.gcal} target="_blank" rel="noopener noreferrer"
                    style={{ display:"block", padding:"11px 0", background:"rgba(52,168,83,0.15)", color:"#3da85e", border:"1px solid rgba(52,168,83,0.4)", borderRadius:8, textAlign:"center", textDecoration:"none", fontWeight:600, fontSize:"0.82rem", marginBottom:10 }}>
                    📅 Ajouter à Google Calendar
                  </a>
                  <button style={{ width:"100%", padding:10, background:"transparent", color:C.muted, border:`1px solid ${C.border}`, borderRadius:8, cursor:"pointer", fontSize:"0.84rem", fontFamily:"'DM Sans',system-ui,sans-serif" }}
                    onClick={() => setModal(null)}>Fermer</button>
                </>
              )}
            </div>
          </div>
        )}

      </div>

      {toast && (
        <div style={{ position:"fixed", bottom:24, left:"50%", transform:"translateX(-50%)", background:C.success, color:"#fff", padding:"11px 20px", borderRadius:8, fontWeight:600, fontSize:"0.8rem", zIndex:200, whiteSpace:"nowrap", boxShadow:"0 4px 20px rgba(0,0,0,0.4)" }}>
          {toast}
        </div>
      )}
    </div>
  );
}
