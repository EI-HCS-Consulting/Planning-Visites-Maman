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

const STORAGE_BUCKETS = ["souvenirs", "news-photos", "patient-photos", "entraide-photos", "support-photos"];

async function deleteStorageFolder(
  supabase: ReturnType<typeof createClient>,
  bucket: string,
  spaceId: string,
): Promise<void> {
  const { data: files } = await supabase.storage.from(bucket).list(spaceId, { limit: 1000 });
  if (!files || files.length === 0) return;
  const paths = files.map((f) => `${spaceId}/${f.name}`);
  await supabase.storage.from(bucket).remove(paths);
}

async function purgeSpace(
  supabase: ReturnType<typeof createClient>,
  spaceId: string,
): Promise<void> {
  // 1. Storage files
  for (const bucket of STORAGE_BUCKETS) {
    await deleteStorageFolder(supabase, bucket, spaceId);
  }

  // 2. DB rows (order matters for FK constraints)
  const tables = ["reservations", "souvenirs", "news_entries", "tasks", "support_messages", "slot_config"];
  for (const table of tables) {
    await supabase.from(table).delete().eq("space_id", spaceId);
  }

  // 3. The space itself
  await supabase.from("patient_spaces").delete().eq("id", spaceId);

  console.log(`Purged space ${spaceId}`);
}

async function sendPurgeAlert(
  supabase: ReturnType<typeof createClient>,
  space: { id: string; admin_id: string; patient_firstname: string; patient_lastname: string; purge_scheduled_at: string },
  resendKey: string,
): Promise<void> {
  const { data: adminData } = await supabase.auth.admin.getUserById(space.admin_id);
  const adminEmail = adminData?.user?.email;
  if (!adminEmail) return;

  const purgeDate = new Date(space.purge_scheduled_at);
  const dateFr = purgeDate.toLocaleDateString("fr-FR", {
    weekday: "long", day: "numeric", month: "long", year: "numeric",
  });

  const html = `
<div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;padding:20px">
  <h2 style="color:#e94560;margin-bottom:4px">⚠️ Suppression dans 7 jours</h2>
  <p style="color:#666;margin-top:0">AvecToi — ${space.patient_firstname} ${space.patient_lastname}</p>

  <p>
    L'espace de <strong>${space.patient_firstname} ${space.patient_lastname}</strong> sera
    <strong>définitivement supprimé le ${dateFr}</strong> conformément à notre politique RGPD.
  </p>

  <p>Toutes les données seront effacées sans possibilité de récupération :</p>
  <ul>
    <li>Planning et créneaux de visite</li>
    <li>Galerie Souvenirs</li>
    <li>Nouvelles du jour</li>
    <li>Tâches d'entraide et messages de soutien</li>
  </ul>

  <div style="background:#fff3cd;border:1px solid #ffc107;border-radius:8px;padding:16px;margin:20px 0">
    <strong>Vous souhaitez conserver les données plus longtemps ?</strong><br/>
    Ouvrez l'application AvecToi → Paramètres → "Prolonger de 30 jours".
  </div>

  <p style="color:#999;font-size:12px;margin-top:24px">
    Ce message est envoyé automatiquement. Ne pas répondre à cet email.
  </p>
</div>`;

  await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${resendKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: "AvecToi <notifications@avectoi.care>",
      to: [adminEmail],
      subject: `AvecToi — Suppression dans 7 jours (${space.patient_firstname} ${space.patient_lastname})`,
      html,
    }),
  });
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });

  // Auth check against CRON_SECRET env var
  const cronSecret = Deno.env.get("CRON_SECRET");
  if (cronSecret) {
    const auth = req.headers.get("Authorization");
    if (auth !== `Bearer ${cronSecret}`) {
      return json({ error: "Unauthorized" }, 401);
    }
  }

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const now = new Date().toISOString();
    const in7Days = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split("T")[0];

    // ── 1. Purge expired spaces ────────────────────────────────────────────────
    const { data: toDelete } = await supabase
      .from("patient_spaces")
      .select("id, patient_firstname, patient_lastname")
      .lte("purge_scheduled_at", now);

    const purged: string[] = [];
    for (const space of (toDelete ?? [])) {
      await purgeSpace(supabase, space.id);
      purged.push(`${space.patient_firstname} ${space.patient_lastname}`);
    }

    // ── 2. Send J-7 alerts ─────────────────────────────────────────────────────
    const { data: toAlert } = await supabase
      .from("patient_spaces")
      .select("id, admin_id, patient_firstname, patient_lastname, purge_scheduled_at")
      .gte("purge_scheduled_at", in7Days + "T00:00:00")
      .lt("purge_scheduled_at", in7Days + "T23:59:59");

    const alerted: string[] = [];
    const resendKey = Deno.env.get("RESEND_API_KEY");

    if (resendKey) {
      for (const space of (toAlert ?? [])) {
        await sendPurgeAlert(supabase, space, resendKey);
        alerted.push(`${space.patient_firstname} ${space.patient_lastname}`);
      }
    } else {
      console.warn("RESEND_API_KEY not set — J-7 alert emails skipped");
    }

    return json({
      ok: true,
      purged,
      alerted,
      timestamp: now,
    });
  } catch (err) {
    console.error("rgpd-purge error:", err);
    return json({ error: String(err) }, 500);
  }
});
