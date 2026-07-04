import { createClient } from "npm:@supabase/supabase-js@2";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...CORS, "Content-Type": "application/json" },
  });
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });

  try {
    const { space_id, visitor_prenom, visitor_nom, date, creneau, type } =
      await req.json();

    if (!space_id || !visitor_prenom || !date) {
      return json({ error: "Missing required fields" }, 400);
    }

    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    // Fetch space + admin email in one query
    const { data: space } = await supabaseAdmin
      .from("patient_spaces")
      .select("admin_id, patient_firstname, patient_lastname, hospital_name, hospital_room")
      .eq("id", space_id)
      .single();

    if (!space) return json({ error: "Space not found" }, 404);

    let nightStartHour = 19;
    let nightEndHour = 8;
    if (type === "Nuit") {
      const { data: slotConfig } = await supabaseAdmin
        .from("slot_config")
        .select("night_start_hour, night_end_hour")
        .eq("space_id", space_id)
        .single();
      if (slotConfig?.night_start_hour != null) nightStartHour = slotConfig.night_start_hour;
      if (slotConfig?.night_end_hour != null) nightEndHour = slotConfig.night_end_hour;
    }

    const { data: adminData } = await supabaseAdmin.auth.admin.getUserById(space.admin_id);
    const adminEmail = adminData?.user?.email;

    if (!adminEmail) return json({ error: "Admin email not found" }, 400);

    const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");
    if (!RESEND_API_KEY) {
      console.warn("RESEND_API_KEY not set — email skipped");
      return json({ ok: true, warning: "email not sent" });
    }

    const dateObj = new Date(date + "T12:00:00");
    const dateFr = dateObj.toLocaleDateString("fr-FR", {
      weekday: "long", day: "numeric", month: "long", year: "numeric",
    });

    const slotLabel = type === "Nuit" ? `🌙 Nuit (${nightStartHour}h → ${nightEndHour}h)` : creneau;
    const locationLabel = `${space.hospital_name}${space.hospital_room ? " — " + space.hospital_room : ""}`;

    const html = `
<div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;padding:20px">
  <h2 style="color:#0D1B2E;margin-bottom:4px">🗑️ Annulation de visite</h2>
  <p style="color:#666;margin-top:0">AvecToi — ${space.patient_firstname} ${space.patient_lastname}</p>

  <p><strong>${visitor_prenom} ${visitor_nom}</strong> a annulé sa visite.</p>

  <table style="border-collapse:collapse;width:100%;margin-top:16px">
    <tr>
      <td style="padding:10px;border:1px solid #eee;background:#f9f9f9;width:130px"><strong>Patient</strong></td>
      <td style="padding:10px;border:1px solid #eee">${space.patient_firstname} ${space.patient_lastname}</td>
    </tr>
    <tr>
      <td style="padding:10px;border:1px solid #eee;background:#f9f9f9"><strong>Date</strong></td>
      <td style="padding:10px;border:1px solid #eee">${dateFr}</td>
    </tr>
    <tr>
      <td style="padding:10px;border:1px solid #eee;background:#f9f9f9"><strong>Créneau</strong></td>
      <td style="padding:10px;border:1px solid #eee">${slotLabel}</td>
    </tr>
    <tr>
      <td style="padding:10px;border:1px solid #eee;background:#f9f9f9"><strong>Lieu</strong></td>
      <td style="padding:10px;border:1px solid #eee">${locationLabel}</td>
    </tr>
  </table>

  <p style="color:#999;font-size:12px;margin-top:24px">
    Ce créneau est maintenant disponible. Connectez-vous à l'app pour gérer le planning.
  </p>
</div>`;

    const resendRes = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${RESEND_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: "AvecToi <notifications@avectoi.care>",
        to: [adminEmail],
        subject: `AvecToi — Annulation de ${visitor_prenom} ${visitor_nom} (${dateFr})`,
        html,
      }),
    });

    if (!resendRes.ok) {
      const detail = await resendRes.text();
      console.error("Resend error:", detail);
      return json({ error: "Email failed", detail }, 500);
    }

    return json({ ok: true });
  } catch (err) {
    console.error("notify-cancel error:", err);
    return json({ error: String(err) }, 500);
  }
});
