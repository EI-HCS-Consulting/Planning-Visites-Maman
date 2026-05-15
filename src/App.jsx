import { useState, useEffect, useCallback } from "react";
import { supabase } from "./supabase.js";
import mamanPhoto from "./assets/maman.png";

const SLOTS = ["12:00", "14:00", "16:00", "18:00"];
const START_DATE = new Date("2026-05-12T00:00:00");
const NIGHT_SUSPENDED_FROM = new Date("2026-05-15T00:00:00");

const HOSPITAL = {
  name: "Hôpital Michallon · CHU Grenoble Alpes",
  address: "Bd de la Chantourne, 38700 La Tronche",
  room: "Neurologie | Secteur C | Chambre 140",
  mapsUrl: "https://maps.google.com/?q=Hôpital+Michallon+CHU+Grenoble+Alpes+La+Tronche",
};

const APP_URL = "https://planning-visites-maman.vercel.app";

const RULES = [
  { icon: "⏱️", text: "15 à 20 minutes maximum par visite" },
  { icon: "👥", text: "2 personnes maximum par créneau" },
  { icon: "🕐", text: "Créneaux : 12h, 14h, 16h, 18h" },
  { icon: "⏳", text: "Au moins 2h entre chaque visite" },
  { icon: "🤫", text: "Peu de sollicitation : maman a besoin de repos. Si elle dort, la laisser dormir sans faire de bruit — elle ressent notre présence." },
  { icon: "🚨", text: "Au moindre doute pendant la visite, alerter immédiatement le personnel soignant — c'est à nous de le faire." },
  { icon: "📖", text: "Un livre a été laissé dans la chambre pour maman : chacun peut y écrire un mot, un souvenir, un poème, coller une photo ou un dessin afin de lui laisser une trace de notre présence." },
  { icon: "🚪", text: "À la fin de la visite, laisser la porte grande ouverte pour que le personnel puisse surveiller que tout va bien." },
  { icon: "🌙", text: "Les nuitées familiales sont suspendues par l'équipe médicale depuis le 15/05/2026." },
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

// Une nuit est suspendue si la date est >= 15/05/2026
function isNightSuspended(date) {
  return date >= NIGHT_SUSPENDED_FROM;
}

function getDayStatus(reservations, iso, dateObj) {
  const visits = reservations.filter(r => r.date === iso && r.type === "Visite");
  const night = reservations.find(r => r.date === iso && r.type === "Nuit");
  const maxVisits = SLOTS.length * 2;
  const nightSusp = isNightSuspended(dateObj);
  if (visits.length === 0 && !night) return "empty";
  // Si nuit suspendue, full = juste les visites pleines
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

// Détection device pour PWA
function detectDevice() {
  const ua = navigator.userAgent || "";
  if (/iPad|iPhone|iPod/.test(ua)) return "ios";
  if (/Android/.test(ua)) return "android";
  return "desktop";
}

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
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState("");
  const [photoOpen, setPhotoOpen] = useState(false);
  const [suspendedAlert, setSuspendedAlert] = useState(false);
  const [nextDispoModal, setNextDispoModal] = useState(null);
  const [deferredPrompt, setDeferredPrompt] = useState(null);
  const [installSuccess, setInstallSuccess] = useState(false);
  const [manualInstallOpen, setManualInstallOpen] = useState(false);

  // Détection responsive
  const [isMobile, setIsMobile] = useState(typeof window !== "undefined" ? window.innerWidth < 640 : false);
  useEffect(() => {
    const handler = () => setIsMobile(window.innerWidth < 640);
    window.addEventListener("resize", handler);
    return () => window.removeEventListener("resize", handler);
  }, []);

  // Capture beforeinstallprompt (Android/Chrome)
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

  // Trouve la prochaine dispo et ouvre une popup
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

  function openModal(type, date, slot=null) {
    setModal({ type, date, slot });
    setConfirmed(null);
    setPrenom(""); setNom(""); setTel("");
  }

  // Depuis la popup "prochaine dispo", réserver directement
  function bookFromNextDispo() {
    if (!nextDispoModal) return;
    const { iso, slot } = nextDispoModal;
    setNextDispoModal(null);
    openModal("visit", iso, slot);
  }

  async function handleBook() {
    if (!prenom.trim()) return;
    setSaving(true);
    try {
      const { error } = await supabase.from("reservations").insert({
        date: modal.date,
        creneau: modal.slot || "Nuit",
        prenom: prenom.trim(),
        nom: nom.trim(),
        type: modal.type === "night" ? "Nuit" : "Visite",
      });
      if (error) throw error;
      const isNight = modal.type === "night";
      const startH = isNight ? 18 : parseInt(modal.slot);
      const endH = isNight ? 11 : startH + 1;
      const gcal = gcalUrl({
        title: `Visite Rose-Marie · ${HOSPITAL.room}`,
        date: modal.date, startH, endH,
        description: `Visite à ${HOSPITAL.name} - ${HOSPITAL.room}\nDurée : 15-20 min max`,
      });
      setConfirmed({ prenom: prenom.trim(), gcal });
      load();
    } catch(e) { showToast("Erreur : "+e.message); }
    finally { setSaving(false); }
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

  // PWA install
  async function handleInstall() {
    if (deferredPrompt) {
      // Cas idéal : Chrome a capturé l'événement, on peut installer directement
      deferredPrompt.prompt();
      const { outcome } = await deferredPrompt.userChoice;
      if (outcome === "accepted") setInstallSuccess(true);
      setDeferredPrompt(null);
    } else {
      // Sinon : ouvrir la popup avec les instructions précises
      setManualInstallOpen(true);
    }
  }

  // QR Code via API publique (pas de dep externe)
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
      <div style={{ background:"linear-gradient(160deg,#0D1B2E 0%,#1F3864 100%)", borderBottom:`1px solid ${C.border}`, padding:"24px 20px 0", textAlign:"center" }}>
        <div
          onClick={() => setPhotoOpen(true)}
          style={{ width:80, height:80, borderRadius:"50%", border:`3px solid ${C.gold}`, overflow:"hidden", margin:"0 auto 12px", boxShadow:"0 0 0 4px rgba(240,180,41,0.15)", cursor:"pointer" }}
        >
          <img src={mamanPhoto} alt="Rose-Marie" style={{ width:"100%", height:"100%", objectFit:"cover" }} />
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

        {/* TABS responsive : 2 lignes mobile, 1 ligne desktop */}
        <div style={{
          display:"flex",
          justifyContent:"center",
          borderTop:`1px solid ${C.border}`,
          marginTop:6,
          flexWrap: isMobile ? "wrap" : "nowrap",
          gap: isMobile ? 0 : 4,
        }}>
          {TABS.map(([id,label]) => (
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
              boxShadow:"0 4px 15px rgba(46,117,182,0.4)",
            }}>⚡ Prochaine disponibilité</button>

            <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:14 }}>
              <button onClick={() => setCalMonth(m => {
                const d = new Date(m.year, m.month-1, 1);
                return { year:d.getFullYear(), month:d.getMonth() };
              })} style={{ background:"transparent", border:`1px solid ${C.border}`, color:C.text, borderRadius:6, padding:"6px 12px", cursor:"pointer", fontSize:"1rem" }}>‹</button>
              <span style={{ fontFamily:"'Playfair Display',serif", fontSize:"1.05rem", fontWeight:700, textTransform:"capitalize" }}>{monthName}</span>
              <button onClick={() => setCalMonth(m => {
                const d = new Date(m.year, m.month+1, 1);
                return { year:d.getFullYear(), month:d.getMonth() };
              })} style={{ background:"transparent", border:`1px solid ${C.border}`, color:C.text, borderRadius:6, padding:"6px 12px", cursor:"pointer", fontSize:"1rem" }}>›</button>
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
                    style={{
                      background: isSelected ? C.accent : isPast ? "transparent" : C.card,
                      border: `${isToday ? 2 : 1}px solid ${isSelected ? C.accent : isToday ? C.gold : C.border}`,
                      borderRadius:8, padding:"8px 4px 6px", textAlign:"center",
                      cursor: isPast ? "default" : "pointer",
                      opacity: isPast ? 0.3 : 1,
                    }}>
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
                style={{ background:"transparent", border:`1px solid ${C.border}`, color: sameDay(currentDay,START_DATE) ? C.muted : C.text, borderRadius:6, padding:"8px 14px", cursor: sameDay(currentDay,START_DATE) ? "default" : "pointer", fontSize:"1.1rem" }}>‹</button>
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
                <div key={slot} style={{ background:C.card, border:`1px solid ${full ? "rgba(233,69,96,0.3)" : C.border}`, borderRadius:10, padding:"14px 16px", marginBottom:10, display:"flex", alignItems:"center", justifyContent:"space-between" }}>
                  <div>
                    <div style={{ fontFamily:"'Playfair Display',serif", fontSize:"1.3rem", fontWeight:700, color:C.gold }}>{slot}</div>
                    <div style={{ fontSize:"0.75rem", color:C.muted, marginTop:2 }}>{occ.length}/2 inscrits</div>
                    <div style={{ marginTop:4 }}>
                      {occ.length === 0
                        ? <div style={{ fontSize:"0.75rem", color:C.muted }}>——</div>
                        : occ.map(r => <div key={r.id} style={{ fontSize:"0.78rem", color:C.success }}>● {r.prenom} {r.nom}</div>)
                      }
                    </div>
                  </div>
                  <button onClick={() => !full && openModal("visit", toISO(currentDay), slot)}
                    style={{ padding:"9px 16px", background: full ? "transparent" : C.accent, color: full ? C.muted : "#fff", border: full ? `1px solid ${C.border}` : "none", borderRadius:8, cursor: full ? "default" : "pointer", fontWeight:600, fontSize:"0.8rem", fontFamily:"'DM Sans',system-ui,sans-serif", whiteSpace:"nowrap" }}>
                    {full ? "Complet" : "+ Réserver"}
                  </button>
                </div>
              );
            })}

            {/* Bloc Nuit : suspendu si >= 15/05/2026 */}
            {(() => {
              const iso = toISO(currentDay);
              const occ = getNight(iso);
              const full = !!occ;
              const suspended = isNightSuspended(currentDay);

              if (suspended) {
                return (
                  <div onClick={() => setSuspendedAlert(true)}
                    style={{ background:"rgba(122,143,166,0.08)", border:`1px dashed ${C.muted}`, borderRadius:10, padding:"14px 16px", display:"flex", alignItems:"center", justifyContent:"space-between", cursor:"pointer", opacity:0.8 }}>
                    <div>
                      <div style={{ fontSize:"1.1rem", marginBottom:2 }}>🌙</div>
                      <div style={{ fontSize:"0.82rem", fontWeight:600, color:C.muted }}>Nuitée suspendue</div>
                      <div style={{ fontSize:"0.72rem", color:C.muted, marginTop:2, fontStyle:"italic" }}>Plus de réservation possible</div>
                      {occ && (
                        <div style={{ fontSize:"0.75rem", color:C.success, marginTop:4 }}>● {occ.prenom} {occ.nom} (historique)</div>
                      )}
                    </div>
                    <div style={{ padding:"9px 14px", background:"transparent", color:C.muted, border:`1px solid ${C.border}`, borderRadius:8, fontWeight:600, fontSize:"0.78rem" }}>
                      ℹ️ Info
                    </div>
                  </div>
                );
              }

              return (
                <div style={{ background: full ? "rgba(233,69,96,0.07)" : "rgba(240,180,41,0.07)", border:`1px solid ${full ? "rgba(233,69,96,0.3)" : "rgba(240,180,41,0.3)"}`, borderRadius:10, padding:"14px 16px", display:"flex", alignItems:"center", justifyContent:"space-between" }}>
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
                  <button onClick={() => !full && openModal("night", toISO(currentDay))}
                    style={{ padding:"9px 16px", background: full ? "transparent" : C.gold, color: full ? C.muted : "#0D1B2E", border: full ? `1px solid ${C.border}` : "none", borderRadius:8, cursor: full ? "default" : "pointer", fontWeight:700, fontSize:"0.8rem", fontFamily:"'DM Sans',system-ui,sans-serif" }}>
                    {full ? "Occupé" : "+ Réserver"}
                  </button>
                </div>
              );
            })()}
          </div>
        )}

        {/* ===== NUITS ===== */}
        {tab === "nights" && (
          <div>
            {/* Bandeau d'info sur la suspension */}
            <div style={{ background:"rgba(46,117,182,0.1)", border:`1px solid rgba(46,117,182,0.3)`, borderRadius:10, padding:"12px 14px", marginBottom:16, display:"flex", gap:10, alignItems:"flex-start" }}>
              <span style={{ fontSize:"1.1rem" }}>ℹ️</span>
              <div style={{ fontSize:"0.78rem", color:C.text, lineHeight:1.5 }}>
                <strong style={{ color:C.accent }}>Nuitées suspendues depuis le 15/05/2026.</strong><br/>
                Cet onglet permet de consulter l'historique des nuits passées.
              </div>
            </div>

            <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:20, background:C.card, border:`1px solid ${C.border}`, borderRadius:12, padding:"14px 16px" }}>
              <button onClick={prevNightDay} disabled={sameDay(currentNightDay, START_DATE)}
                style={{ background:"transparent", border:`1px solid ${C.border}`, color: sameDay(currentNightDay,START_DATE) ? C.muted : C.text, borderRadius:6, padding:"8px 14px", cursor: sameDay(currentNightDay,START_DATE) ? "default" : "pointer", fontSize:"1.1rem" }}>‹</button>
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
                <div style={{
                  background: suspended ? "rgba(122,143,166,0.08)" : (occ ? "rgba(62,207,142,0.07)" : "rgba(240,180,41,0.07)"),
                  border:`1px solid ${suspended ? C.border : (occ ? "rgba(62,207,142,0.3)" : "rgba(240,180,41,0.3)")}`,
                  borderRadius:12, padding:"24px 20px", textAlign:"center"
                }}>
                  <div style={{ fontSize:"2.4rem", marginBottom:10, opacity: suspended ? 0.5 : 1 }}>🌙</div>
                  <div style={{ fontFamily:"'Playfair Display',serif", fontSize:"1.3rem", fontWeight:700, color: suspended ? C.muted : C.gold, marginBottom:6 }}>
                    Nuit du {toFrShort(currentNightDay)}
                  </div>
                  {suspended && (
                    <div style={{ fontSize:"0.78rem", color:C.muted, marginBottom:12, fontStyle:"italic" }}>
                      Nuitée suspendue
                    </div>
                  )}
                  <div style={{ fontSize:"0.85rem", color:C.muted, marginBottom:16 }}>18h00 → 11h00 le lendemain</div>
                  <div style={{ marginBottom:18, minHeight:24 }}>
                    {occ
                      ? <div style={{ fontSize:"0.92rem", color:C.success, fontWeight:600 }}>● {occ.prenom} {occ.nom}</div>
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
                      style={{ padding:"12px 28px", background: occ ? "transparent" : C.gold, color: occ ? C.muted : "#0D1B2E", border: occ ? `1px solid ${C.border}` : "none", borderRadius:8, cursor: occ ? "default" : "pointer", fontWeight:700, fontSize:"0.9rem", fontFamily:"'DM Sans',system-ui,sans-serif" }}>
                      {occ ? "Occupée" : "+ Réserver cette nuit"}
                    </button>
                  )}
                </div>
              );
            })()}

            {/* Historique des nuits */}
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
                    <div style={{ fontSize:"0.72rem", color:C.success, marginTop:2 }}>● {r.prenom} {r.nom}</div>
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

        {/* ===== PARTAGER (QR Code) ===== */}
        {tab === "share" && (
          <div>
            <div style={{ background:C.card, border:`1px solid ${C.border}`, borderRadius:12, padding:"20px 18px", marginBottom:12, textAlign:"center" }}>
              <h2 style={{ fontFamily:"'Playfair Display',serif", fontSize:"1.15rem", margin:"0 0 6px", color:"#fff" }}>📱 Partager l'app</h2>
              <p style={{ fontSize:"0.82rem", color:C.muted, margin:"0 0 18px" }}>
                Fais scanner ce QR code par un autre téléphone pour partager l'application
              </p>

              {/* QR via API publique - pas de dep */}
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

              <button onClick={copyUrl} style={{
                width:"100%", padding:"11px", background:C.accent, color:"#fff", border:"none", borderRadius:8, cursor:"pointer", fontWeight:600, fontSize:"0.85rem", fontFamily:"'DM Sans',system-ui,sans-serif"
              }}>
                📋 Copier le lien
              </button>
            </div>

            {/* Instructions */}
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
                💡 Tu peux aussi envoyer le lien directement par SMS ou WhatsApp
              </div>
            </div>
           </div>
          </div>
        )}

        {/* ===== INSTALLER (PWA) ===== */}
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
                  {/* BOUTON PRINCIPAL — TOUJOURS VISIBLE */}
                  <button onClick={handleInstall} style={{
                    width:"100%",
                    padding:"16px",
                    background:`linear-gradient(135deg, ${C.gold}, #c69100)`,
                    color:"#0D1B2E",
                    border:"none",
                    borderRadius:12,
                    cursor:"pointer",
                    fontWeight:700,
                    fontSize:"1rem",
                    fontFamily:"'DM Sans',system-ui,sans-serif",
                    boxShadow:"0 4px 18px rgba(240,180,41,0.35)",
                    marginBottom:10,
                  }}>
                    📲 {deferredPrompt ? "Installer maintenant" : "Comment installer ?"}
                  </button>

                  {!deferredPrompt && (
                    <p style={{ fontSize:"0.72rem", color:C.muted, margin:"0 0 14px", fontStyle:"italic" }}>
                      Ton navigateur ne supporte pas l'installation automatique. Touche le bouton pour voir comment faire.
                    </p>
                  )}

                  {/* Bouton secondaire : partage natif */}
                  <button onClick={async () => {
                    if (navigator.share) {
                      try {
                        await navigator.share({
                          title: "Visites Rose-Marie",
                          text: "Planning des visites à l'hôpital Michallon",
                          url: APP_URL,
                        });
                      } catch(e) { /* annulé */ }
                    } else {
                      navigator.clipboard?.writeText(APP_URL);
                      showToast("Lien copié — colle-le où tu veux !");
                    }
                  }} style={{
                    width:"100%",
                    padding:"12px",
                    background:"transparent",
                    color:C.accent,
                    border:`1px solid ${C.accent}`,
                    borderRadius:10,
                    cursor:"pointer",
                    fontWeight:600,
                    fontSize:"0.85rem",
                    fontFamily:"'DM Sans',system-ui,sans-serif",
                  }}>
                    📤 Envoyer le lien par SMS/WhatsApp
                  </button>
                </>
              )}
            </div>

            {/* Aperçu visuel de ce qui va se passer */}
            <div style={{ background:"rgba(46,117,182,0.08)", border:`1px solid rgba(46,117,182,0.25)`, borderRadius:12, padding:"14px 16px", display:"flex", gap:14, alignItems:"center" }}>
              <div style={{ width:54, height:54, borderRadius:14, overflow:"hidden", border:`2px solid ${C.gold}`, flexShrink:0, background:C.bg }}>
                <img src={mamanPhoto} alt="" style={{ width:"100%", height:"100%", objectFit:"cover" }} />
              </div>
              <div>
                <div style={{ fontSize:"0.82rem", color:C.text, fontWeight:600 }}>Rose-Marie</div>
                <div style={{ fontSize:"0.72rem", color:C.muted, marginTop:2 }}>
                  L'icône qui apparaîtra sur ton écran d'accueil ↑
                </div>
              </div>
            </div>
          </div>
        )}

        {/* MODAL INSTRUCTIONS INSTALLATION MANUELLE */}
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
                <div style={{ fontSize:"0.86rem", color:C.text, lineHeight:1.6 }}>
                  <div style={{ display:"flex", gap:12, alignItems:"flex-start", marginBottom:14 }}>
                    <span style={{ background:C.accent, color:"#fff", width:26, height:26, borderRadius:"50%", display:"flex", alignItems:"center", justifyContent:"center", fontSize:"0.82rem", fontWeight:700, flexShrink:0 }}>1</span>
                    <span>Touche le bouton <strong style={{color:C.gold}}>Partager</strong> en bas de Safari (carré avec une flèche ↑)</span>
                  </div>
                  <div style={{ display:"flex", gap:12, alignItems:"flex-start", marginBottom:14 }}>
                    <span style={{ background:C.accent, color:"#fff", width:26, height:26, borderRadius:"50%", display:"flex", alignItems:"center", justifyContent:"center", fontSize:"0.82rem", fontWeight:700, flexShrink:0 }}>2</span>
                    <span>Fais défiler et touche <strong style={{color:C.gold}}>"Sur l'écran d'accueil"</strong> (icône ⊕)</span>
                  </div>
                  <div style={{ display:"flex", gap:12, alignItems:"flex-start", marginBottom:14 }}>
                    <span style={{ background:C.accent, color:"#fff", width:26, height:26, borderRadius:"50%", display:"flex", alignItems:"center", justifyContent:"center", fontSize:"0.82rem", fontWeight:700, flexShrink:0 }}>3</span>
                    <span>Touche <strong style={{color:C.gold}}>"Ajouter"</strong> en haut à droite</span>
                  </div>
                </div>
              </>
            )}

            {device === "android" && (
              <div style={{ fontSize:"0.86rem", color:C.text, lineHeight:1.6 }}>
                <div style={{ display:"flex", gap:12, alignItems:"flex-start", marginBottom:14 }}>
                  <span style={{ background:C.accent, color:"#fff", width:26, height:26, borderRadius:"50%", display:"flex", alignItems:"center", justifyContent:"center", fontSize:"0.82rem", fontWeight:700, flexShrink:0 }}>1</span>
                  <span>Touche le menu <strong style={{color:C.gold}}>⋮</strong> (3 points) en haut à droite de Chrome</span>
                </div>
                <div style={{ display:"flex", gap:12, alignItems:"flex-start", marginBottom:14 }}>
                  <span style={{ background:C.accent, color:"#fff", width:26, height:26, borderRadius:"50%", display:"flex", alignItems:"center", justifyContent:"center", fontSize:"0.82rem", fontWeight:700, flexShrink:0 }}>2</span>
                  <span>Touche <strong style={{color:C.gold}}>"Ajouter à l'écran d'accueil"</strong> ou <strong style={{color:C.gold}}>"Installer l'application"</strong></span>
                </div>
                <div style={{ display:"flex", gap:12, alignItems:"flex-start", marginBottom:14 }}>
                  <span style={{ background:C.accent, color:"#fff", width:26, height:26, borderRadius:"50%", display:"flex", alignItems:"center", justifyContent:"center", fontSize:"0.82rem", fontWeight:700, flexShrink:0 }}>3</span>
                  <span>Confirme en touchant <strong style={{color:C.gold}}>"Ajouter"</strong> ou <strong style={{color:C.gold}}>"Installer"</strong></span>
                </div>
                <div style={{ fontSize:"0.74rem", color:C.muted, marginTop:8, fontStyle:"italic", padding:"10px 12px", background:C.bg, borderRadius:6, border:`1px solid ${C.border}` }}>
                  💡 Si tu utilises un autre navigateur (Firefox, Samsung Internet…), ouvre cette page dans <strong>Chrome</strong> pour de meilleurs résultats.
                </div>
              </div>
            )}

            {device === "desktop" && (
              <div style={{ fontSize:"0.86rem", color:C.text, lineHeight:1.6 }}>
                <div style={{ display:"flex", gap:12, alignItems:"flex-start", marginBottom:14 }}>
                  <span style={{ background:C.accent, color:"#fff", width:26, height:26, borderRadius:"50%", display:"flex", alignItems:"center", justifyContent:"center", fontSize:"0.82rem", fontWeight:700, flexShrink:0 }}>1</span>
                  <span>Dans <strong style={{color:C.gold}}>Chrome</strong> ou <strong style={{color:C.gold}}>Edge</strong>, regarde à droite de la barre d'adresse</span>
                </div>
                <div style={{ display:"flex", gap:12, alignItems:"flex-start", marginBottom:14 }}>
                  <span style={{ background:C.accent, color:"#fff", width:26, height:26, borderRadius:"50%", display:"flex", alignItems:"center", justifyContent:"center", fontSize:"0.82rem", fontWeight:700, flexShrink:0 }}>2</span>
                  <span>Clique sur l'icône <strong style={{color:C.gold}}>⬇️</strong> ou <strong style={{color:C.gold}}>🖥️</strong> "Installer"</span>
                </div>
                <div style={{ display:"flex", gap:12, alignItems:"flex-start", marginBottom:14 }}>
                  <span style={{ background:C.accent, color:"#fff", width:26, height:26, borderRadius:"50%", display:"flex", alignItems:"center", justifyContent:"center", fontSize:"0.82rem", fontWeight:700, flexShrink:0 }}>3</span>
                  <span>Sinon : menu <strong style={{color:C.gold}}>⋮</strong> → <strong style={{color:C.gold}}>"Installer Visites Rose-Marie..."</strong></span>
                </div>
                <div style={{ fontSize:"0.74rem", color:C.muted, marginTop:8, fontStyle:"italic", padding:"10px 12px", background:C.bg, borderRadius:6, border:`1px solid ${C.border}` }}>
                  💡 L'app aura son raccourci dans le menu Démarrer (Windows) ou Launchpad (Mac).
                </div>
              </div>
            )}

            <button style={{ width:"100%", padding:11, background:C.accent, color:"#fff", border:"none", borderRadius:8, cursor:"pointer", fontWeight:600, fontSize:"0.84rem", fontFamily:"'DM Sans',system-ui,sans-serif", marginTop:14 }}
              onClick={() => setManualInstallOpen(false)}>
              J'ai compris
            </button>
          </div>
        </div>
      )}

      {/* MODAL PHOTO */}
      {photoOpen && (
        <div style={{ position:"fixed", inset:0, background:"rgba(0,0,0,0.92)", display:"flex", alignItems:"center", justifyContent:"center", zIndex:150, padding:16, cursor:"pointer" }}
          onClick={() => setPhotoOpen(false)}>
          <div style={{ width:350, height:350, borderRadius:"50%", border:`4px solid ${C.gold}`, overflow:"hidden", boxShadow:"0 0 0 6px rgba(240,180,41,0.2), 0 20px 60px rgba(0,0,0,0.6)" }}>
            <img src={mamanPhoto} alt="Rose-Marie" style={{ width:"100%", height:"100%", objectFit:"cover" }} />
          </div>
        </div>
      )}

      {/* MODAL NUITÉE SUSPENDUE */}
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

      {/* MODAL PROCHAINE DISPO */}
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
              <button onClick={() => {
                setCurrentDay(nextDispoModal.date);
                setTab("slots");
                setNextDispoModal(null);
              }} style={{ flex:1, padding:11, background:"transparent", color:C.muted, border:`1px solid ${C.border}`, borderRadius:8, cursor:"pointer", fontWeight:500, fontSize:"0.82rem", fontFamily:"'DM Sans',system-ui,sans-serif" }}>
                Voir le jour
              </button>
              <button onClick={bookFromNextDispo} style={{ flex:1.3, padding:11, background:C.accent, color:"#fff", border:"none", borderRadius:8, cursor:"pointer", fontWeight:700, fontSize:"0.82rem", fontFamily:"'DM Sans',system-ui,sans-serif" }}>
                ✓ Réserver
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL RÉSERVATION */}
      {modal && (
        <div style={{ position:"fixed", inset:0, background:"rgba(0,0,0,0.8)", display:"flex", alignItems:"center", justifyContent:"center", zIndex:100, padding:16 }}
          onClick={() => setModal(null)}>
          <div style={{ background:C.card, border:`1px solid ${C.accent}`, borderRadius:14, padding:"24px 20px", width:"100%", maxWidth:360 }}
            onClick={e => e.stopPropagation()}>
            {!confirmed ? (
              <>
                <div style={{ fontFamily:"'Playfair Display',serif", fontSize:"1.15rem", fontWeight:700, margin:"0 0 3px", color:"#fff" }}>
                  {modal.type==="night" ? "🌙 Réserver une nuit" : `🕐 Visite ${modal.slot}`}
                </div>
                <p style={{ fontSize:"0.8rem", color:C.muted, margin:"0 0 16px" }}>
                  {toFrLong(new Date(modal.date+"T12:00:00"))} · {modal.type==="night" ? "18h → 11h" : "15-20 min max"}
                </p>
                {[
                  { ph:"Prénom *", val:prenom, set:setPrenom },
                  { ph:"Nom", val:nom, set:setNom },
                  { ph:"Téléphone", val:tel, set:setTel, type:"tel" },
                ].map(({ph,val,set,type="text"}) => (
                  <input key={ph} type={type} placeholder={ph} value={val} onChange={e=>set(e.target.value)}
                    onKeyDown={e=>e.key==="Enter"&&handleBook()}
                    style={{ width:"100%", padding:"10px 12px", background:C.bg, border:`1px solid ${C.border}`, borderRadius:7, color:C.text, fontSize:"0.92rem", fontFamily:"'DM Sans',system-ui,sans-serif", boxSizing:"border-box", marginBottom:8, outline:"none" }}
                  />
                ))}
                <div style={{ display:"flex", gap:8, marginTop:4 }}>
                  <button style={{ flex:1, padding:11, background:"transparent", color:C.muted, border:`1px solid ${C.border}`, borderRadius:8, cursor:"pointer", fontWeight:500, fontSize:"0.84rem", fontFamily:"'DM Sans',system-ui,sans-serif" }}
                    onClick={() => setModal(null)}>Annuler</button>
                  <button style={{ flex:1, padding:11, background:C.accent, color:"#fff", border:"none", borderRadius:8, cursor:"pointer", fontWeight:600, fontSize:"0.84rem", fontFamily:"'DM Sans',system-ui,sans-serif", opacity:(!prenom.trim()||saving)?0.5:1 }}
                    onClick={handleBook} disabled={!prenom.trim()||saving}>
                    {saving ? "Envoi…" : "Confirmer"}
                  </button>
                </div>
              </>
            ) : (
              <>
                <div style={{ textAlign:"center", padding:"8px 0" }}>
                  <div style={{ fontSize:"2.4rem", marginBottom:6 }}>🎉</div>
                  <div style={{ fontSize:"1.05rem", fontWeight:700, color:C.success, margin:"0 0 4px" }}>Merci {confirmed.prenom} !</div>
                  <p style={{ fontSize:"0.8rem", color:C.muted, margin:"0 0 12px" }}>Ta visite est enregistrée.<br/>Rose-Marie sera heureuse de te voir 💛</p>
                </div>
                <a href={confirmed.gcal} target="_blank" rel="noopener noreferrer"
                  style={{ display:"block", padding:"11px 0", background:"rgba(52,168,83,0.15)", color:"#3da85e", border:"1px solid rgba(52,168,83,0.4)", borderRadius:8, textAlign:"center", textDecoration:"none", fontWeight:600, fontSize:"0.82rem", fontFamily:"'DM Sans',system-ui,sans-serif", marginBottom:8 }}>
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
      </div>

      {toast && (
        <div style={{ position:"fixed", bottom:24, left:"50%", transform:"translateX(-50%)", background:C.success, color:"#fff", padding:"11px 20px", borderRadius:8, fontWeight:600, fontSize:"0.86rem", zIndex:200, whiteSpace:"nowrap", boxShadow:"0 4px 20px rgba(0,0,0,0.4)" }}>
          {toast}
        </div>
      )}
    </div>
  );
}
