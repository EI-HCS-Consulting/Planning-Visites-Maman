-- La table slot_config n'avait que SELECT et INSERT comme policies RLS.
-- Sans policy UPDATE, les appels .update() s'exécutaient sans erreur mais
-- mettaient à jour 0 lignes — les réglages semblaient s'enregistrer mais
-- disparaissaient au rechargement.

CREATE POLICY "admins can update own slot_config"
  ON public.slot_config
  FOR UPDATE
  USING (EXISTS (
    SELECT 1 FROM public.patient_spaces s
    WHERE s.id = slot_config.space_id AND s.admin_id = auth.uid()
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.patient_spaces s
    WHERE s.id = slot_config.space_id AND s.admin_id = auth.uid()
  ));
