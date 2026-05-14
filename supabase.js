import { useState, useEffect, useCallback } from "react";
import { supabase } from "./supabase.js";

const VISIT_SLOTS = ["11:00", "13:00", "15:00", "17:00"];

const COLORS = {
  bg: "#0D1B2E",
  card: "#112240",
  border: "#1E3A5F",
  accent: "#2E75B6",
  orange: "#C45911",
  gold: "#f0b429",
  text: "#e8edf5",
  muted: "#7a8fa6",
  success: "#3ecf8e",
  danger: "#e94560",
};

const S = {
  app: {
    minHeight: "100vh",
    background: COLORS.bg,
    color: COLORS.text,
    fontFamily: "'DM Sans', system-ui, sans-serif",
    paddingBottom: 80,
  },
  header: {
    background: "linear-gradient(160deg, #0D1B2E 0%, #1F3864 100%)",
    borderBottom: `1px solid ${COLORS.border}`,
    padding: "36px 24px 28px",
    textAlign: "center",
  },
  h1: {
    fontFamily: "'Playfair Display', Georgia, serif",
    fontSize: "2rem",
    fontWeight: 700,
    color: "#fff",
    margin: "0 0 6px",
    letterSpacing: "0.02em",
  },
  subtitle: {
    color: COLORS.gold,
    fontSize: "0.8rem",
    letterSpacing: "0.14em",
    textTransform: "uppercase",
    fontWeight: 500,
    margin: 0,
  },
  tabs: {
    display: "flex",
    justifyContent: "center",
    gap: 0,
    margin: "24px auto 0",
    maxWidth: 320,
    border: `1px solid ${COLORS.border}`,
    borderRadius: 8,
    overflow: "hidden",
  },
  tab: (active) => ({
    flex: 1,
    padding: "10px 16px",
    background: active ? COLORS.accent : "transparent",
    color: active ? "#fff" : COLORS.muted,
    border: "none",
    cursor: "pointer",
    fontSize: "0.82rem",
    fontWeight: 600,
    letterSpacing: "0.06em",
    textTransform: "uppercase",
    fontFamily: "'DM Sans', system-ui, sans-serif",
    transition: "background 0.2s",
  }),
  container: {
    maxWidth: 720,
    margin: "28px auto 0",
    padding: "0 16px",
  },
  dayCard: {
    background: COLORS.card,
    border: `1px solid ${COLORS.border}`,
    borderRadius: 12,
    marginBottom: 14,
    overflow: "hidden",
  },
  dayHeader: {
    background: "rgba(31,56,100,0.5)",
    padding: "12px 18px",
    borderBottom: `1px solid ${COLORS.border}`,
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
  },
  dayTitle: {
    fontSize: "0.95rem",
    fontWeight: 600,
    color: "#fff",
    textTransform: "capitalize",
    margin: 0,
  },
  grid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fill, minmax(150px, 1fr))",
    gap: 10,
    padding: 14,
  },
  slotCard: (full) => ({
    background: full ? "rgba(233,69,96,0.07)" : "rgba(46,117,182,0.08)",
    border: `1px solid ${full ? "rgba(233,69,96,0.3)" : COLORS.border}`,
    borderRadius: 8,
    padding: "12px 10px",
    cursor: full ? "default" : "pointer",
  }),
  slotTime: {
    fontFamily: "'Playfair Display', serif",
    fontSize: "1.25rem",
    fontWeight: 700,
    color: COLORS.gold,
  },
  slotMeta: {
    fontSize: "0.7rem",
    color: COLORS.muted,
    textTransform: "uppercase",
    letterSpacing: "0.07em",
    marginTop: 2,
  },
  occupants: {
    marginTop: 8,
    display: "flex",
    flexDirection: "column",
    gap: 2,
  },
  occupant: {
    fontSize: "0.8rem",
    color: COLORS.success,
  },
  bookBtn: (full) => ({
    marginTop: 10,
    width: "100%",
    padding: "7px 0",
    background: full ? "transparent" : COLORS.accent,
    color: full ? COLORS.muted : "#fff",
    border: full ? `1px solid ${COLORS.border}` : "none",
    borderRadius: 5,
    cursor: full ? "default" : "pointer",
    fontSize: "0.75rem",
    fontWeight: 600,
    letterSpacing: "0.04em",
    fontFamily: "'DM Sans', system-ui, sans-serif",
  }),
  nightRow: (full) => ({
    margin: "0 14px 14px",
    background: full ? "rgba(233,69,96,0.07)" : "rgba(240,180,41,0.07)",
    border: `1px solid ${full ? "rgba(233,69,96,0.3)" : "rgba(240,180,41,0.3)"}`,
    borderRadius: 8,
    padding: "14px 16px",
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
    flexWrap: "wrap",
  }),
  nightLabel: {
    fontSize: "0.88rem",
    fontWeight: 600,
    color: COLORS.gold,
  },
  nightMeta: {
    fontSize: "0.75rem",
    color: COLORS.muted,
    marginTop: 2,
  },
  nightOccupant: (full) => ({
    fontSize: "0.82rem",
    color: full ? COLORS.muted : COLORS.success,
    marginTop: 4,
  }),
  nightBtn: (full) => ({
    padding: "9px 18px",
    background: full ? "transparent" : COLORS.gold,
    color: full ? COLORS.muted : "#0D1B2E",
    border: full ? `1px solid ${COLORS.border}` : "none",
    borderRadius: 7,
    cursor: full ? "default" : "pointer",
    fontWeight: 700,
    fontSize: "0.82rem",
    fontFamily: "'DM Sans', system-ui, sans-serif",
    whiteSpace: "nowrap",
  }),
  overlay: {
    position: "fixed",
    inset: 0,
    background: "rgba(0,0,0,0.75)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    zIndex: 100,
    padding: 16,
  },
  modal: {
    background: COLORS.card,
    border: `1px solid ${COLORS.accent}`,
    borderRadius: 14,
    padding: "28px 24px",
    width: "100%",
    maxWidth: 380,
  },
  modalTitle: {
    fontFamily: "'Playfair Display', serif",
    fontSize: "1.3rem",
    fontWeight: 700,
    margin: "0 0 4px",
    color: "#fff",
  },
  modalSub: {
    fontSize: "0.84rem",
    color: COLORS.muted,
    margin: "0 0 20px",
  },
  input: {
    width: "100%",
    padding: "11px 13px",
    background: COLORS.bg,
    border: `1px solid ${COLORS.border}`,
    borderRadius: 7,
    color: COLORS.text,
    fontSize: "0.95rem",
    fontFamily: "'DM Sans', system-ui, sans-serif",
    boxSizing: "border-box",
    marginBottom: 10,
    outline: "none",
  },
  btnRow: {
    display: "flex",
    gap: 10,
    marginTop: 6,
  },
  btnPrimary: {
    flex: 1,
    padding: 12,
    background: COLORS.accent,
    color: "#fff",
    border: "none",
    borderRadius: 8,
    cursor: "pointer",
    fontWeight: 600,
    fontSize: "0.88rem",
    fontFamily: "'DM Sans', system-ui, sans-serif",
  },
  btnSecondary: {
    flex: 1,
    padding: 12,
    background: "transparent",
    color: COLORS.muted,
    border: `1px solid ${COLORS.border}`,
    borderRadius: 8,
    cursor: "pointer",
    fontWeight: 500,
    fontSize: "0.88rem",
    fontFamily: "'DM Sans', system-ui, sans-serif",
  },
  toast: {
    position: "fixed",
    bottom: 24,
    left: "50%",
    transform: "translateX(-50%)",
    background: COLORS.success,
    color: "#fff",
    padding: "12px 22px",
    borderRadius: 8,
    fontWeight: 600,
    fontSize: "0.9rem",
    zIndex: 200,
    whiteSpace: "nowrap",
    boxShadow: "0 4px 20px rgba(0,0,0,0.4)",
  },
  loading: {
    textAlign: "center",
    padding: "60px 0",
    color: COLORS.muted,
    fontSize: "0.9rem",
  },
  error: {
    textAlign: "center",
    padding: "40px 16px",
    color: COLORS.danger,
    fontSize: "0.88rem",
  },
};

function generateDays(count = 21) {
  const days = [];
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  for (let i = 0; i < count; i++) {
    const d = new Date(today);
    d.setDate(today.getDate() + i);
    days.push(d);
  }
  return days;
}

function toISO(d) {
  return d.toISOString().split("T")[0];
}

function toFr(d) {
  return d.toLocaleDateString("fr-FR", {
    weekday: "long",
    day: "numeric",
    month: "long",
  });
}

export default function App() {
  const [reservations, setReservations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [modal, setModal] = useState(null);
  const [prenom, setPrenom] = useState("");
  const [nom, setNom] = useState("");
  const [saving, setSaving] = useState(false);
  const [tab, setTab] = useState("visits");
  const [toast, setToast] = useState("");

  const days = generateDays(21);

  const loadReservations = useCallback(async () => {
    try {
      const { data, error: err } = await supabase
        .from("reservations")
        .select("*");
      if (err) throw err;
      setReservations(data || []);
      setError(null);
    } catch (e) {
      setError("Impossible de charger les réservations. " + e.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadReservations();
    const channel = supabase
      .channel("reservations-changes")
      .on("postgres_changes", { event: "*", schema: "public", table: "reservations" }, () => {
        loadReservations();
      })
      .subscribe();
    return () => supabase.removeChannel(channel);
  }, [loadReservations]);

  function showToast(msg) {
    setToast(msg);
    setTimeout(() => setToast(""), 3000);
  }

  function getVisitOccupants(dateISO, slot) {
    return reservations.filter(
      (r) => r.date === dateISO && r.creneau === slot && r.type === "Visite"
    );
  }

  function getNightOccupant(dateISO) {
    return reservations.find(
      (r) => r.date === dateISO && r.type === "Nuit"
    );
  }

  function openModal(type, date, slot = null) {
    setModal({ type, date, slot });
    setPrenom("");
    setNom("");
  }

  async function handleBook() {
    if (!prenom.trim()) return;
    setSaving(true);
    try {
      const { error: err } = await supabase.from("reservations").insert({
        date: modal.date,
        creneau: modal.slot || "Nuit",
        prenom: prenom.trim(),
        nom: nom.trim(),
        type: modal.type === "night" ? "Nuit" : "Visite",
      });
      if (err) throw err;
      showToast(`✓ ${prenom.trim()} inscrit(e) !`);
      setModal(null);
    } catch (e) {
      showToast("Erreur : " + e.message);
    } finally {
      setSaving(false);
    }
  }

  if (loading) return <div style={S.app}><div style={S.loading}>Chargement…</div></div>;

  return (
    <div style={S.app}>
      <div style={S.header}>
        <h1 style={S.h1}>Visites Rose-Marie</h1>
        <p style={S.subtitle}>Hôpital Michallon · Chambre 140 · CHU Grenoble</p>
        <div style={S.tabs}>
          <button style={S.tab(tab === "visits")} onClick={() => setTab("visits")}>
            🕐 Visites
          </button>
          <button style={S.tab(tab === "nights")} onClick={() => setTab("nights")}>
            🌙 Nuitées
          </button>
        </div>
      </div>

      <div style={S.container}>
        {error && <div style={S.error}>{error}</div>}

        {days.map((day) => {
          const iso = toISO(day);
          const isToday = iso === toISO(new Date());

          if (tab === "visits") {
            return (
              <div key={iso} style={S.dayCard}>
                <div style={S.dayHeader}>
                  <span style={S.dayTitle}>
                    {isToday ? "📍 " : ""}{toFr(day)}
                  </span>
                  <span style={{ fontSize: "0.72rem", color: COLORS.muted }}>
                    4 créneaux · 2 places
                  </span>
                </div>
                <div style={S.grid}>
                  {VISIT_SLOTS.map((slot) => {
                    const occ = getVisitOccupants(iso, slot);
                    const full = occ.length >= 2;
                    return (
                      <div
                        key={slot}
                        style={S.slotCard(full)}
                        onClick={!full ? () => openModal("visit", iso, slot) : undefined}
                      >
                        <div style={S.slotTime}>{slot}</div>
                        <div style={S.slotMeta}>
                          {full ? "Complet" : `${2 - occ.length} place${2 - occ.length > 1 ? "s" : ""} libre${2 - occ.length > 1 ? "s" : ""}`}
                        </div>
                        <div style={S.occupants}>
                          {occ.map((r) => (
                            <div key={r.id} style={S.occupant}>
                              ● {r.prenom} {r.nom}
                            </div>
                          ))}
                        </div>
                        <button
                          style={S.bookBtn(full)}
                          disabled={full}
                          onClick={!full ? (e) => { e.stopPropagation(); openModal("visit", iso, slot); } : undefined}
                        >
                          {full ? "Complet" : "S'inscrire"}
                        </button>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          } else {
            const occ = getNightOccupant(iso);
            const full = !!occ;
            return (
              <div key={iso} style={S.dayCard}>
                <div style={S.dayHeader}>
                  <span style={S.dayTitle}>
                    {isToday ? "📍 " : ""}{toFr(day)}
                  </span>
                </div>
                <div style={S.nightRow(full)}>
                  <div>
                    <div style={S.nightLabel}>🌙 Nuit du {toFr(day).split(" ").slice(0, 3).join(" ")}</div>
                    <div style={S.nightMeta}>18h00 → 11h00 · 1 personne max</div>
                    {occ && (
                      <div style={S.nightOccupant(true)}>● {occ.prenom} {occ.nom}</div>
                    )}
                    {!full && (
                      <div style={{ ...S.nightOccupant(false) }}>Disponible</div>
                    )}
                  </div>
                  <button
                    style={S.nightBtn(full)}
                    disabled={full}
                    onClick={!full ? () => openModal("night", iso) : undefined}
                  >
                    {full ? "Complet" : "Réserver"}
                  </button>
                </div>
              </div>
            );
          }
        })}
      </div>

      {modal && (
        <div style={S.overlay} onClick={() => setModal(null)}>
          <div style={S.modal} onClick={(e) => e.stopPropagation()}>
            <div style={S.modalTitle}>
              {modal.type === "night" ? "🌙 Réserver une nuit" : `🕐 Visite à ${modal.slot}`}
            </div>
            <p style={S.modalSub}>
              {modal.type === "night"
                ? `Nuit du ${toFr(new Date(modal.date + "T12:00:00"))} · 18h → 11h`
                : `${toFr(new Date(modal.date + "T12:00:00"))} · 15-20 min`}
            </p>
            <input
              style={S.input}
              type="text"
              placeholder="Prénom *"
              value={prenom}
              onChange={(e) => setPrenom(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleBook()}
              autoFocus
            />
            <input
              style={S.input}
              type="text"
              placeholder="Nom"
              value={nom}
              onChange={(e) => setNom(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleBook()}
            />
            <div style={S.btnRow}>
              <button style={S.btnSecondary} onClick={() => setModal(null)}>Annuler</button>
              <button
                style={{ ...S.btnPrimary, opacity: (!prenom.trim() || saving) ? 0.5 : 1 }}
                onClick={handleBook}
                disabled={!prenom.trim() || saving}
              >
                {saving ? "Envoi…" : "Confirmer"}
              </button>
            </div>
          </div>
        </div>
      )}

      {toast && <div style={S.toast}>{toast}</div>}
    </div>
  );
}
