-- RGPD Purge — Configuration pg_cron
-- Exécuter dans le SQL Editor du dashboard Supabase.
-- Prérequis : activer les extensions pg_cron et pg_net dans
-- Dashboard → Database → Extensions.

-- Remplacer les valeurs suivantes :
--   <PROJECT_REF>  → l'identifiant de projet Supabase (ex: flmslcdzjuifkivmzins)
--   <CRON_SECRET>  → même valeur que le secret CRON_SECRET déployé sur la Edge Function

DO $$
DECLARE
  v_url     TEXT := 'https://<PROJECT_REF>.supabase.co/functions/v1/rgpd-purge';
  v_secret  TEXT := '<CRON_SECRET>';
BEGIN

  -- Supprimer un éventuel job existant
  PERFORM cron.unschedule('rgpd-purge-daily');

  -- Planifier l'exécution quotidienne à 02:00 UTC
  PERFORM cron.schedule(
    'rgpd-purge-daily',
    '0 2 * * *',
    format(
      $cron$
      SELECT net.http_post(
        url     := %L,
        headers := '{"Content-Type":"application/json","Authorization":"Bearer %s"}'::jsonb,
        body    := '{}'::jsonb
      );
      $cron$,
      v_url, v_secret
    )
  );

END $$;

-- Vérifier que le job est bien planifié :
-- SELECT * FROM cron.job WHERE jobname = 'rgpd-purge-daily';

-- Secrets à déployer via CLI avant le cron :
--   supabase secrets set RESEND_API_KEY=re_xxx
--   supabase secrets set CRON_SECRET=<random-string>
--   supabase functions deploy rgpd-purge
--   supabase functions deploy notify-cancel
