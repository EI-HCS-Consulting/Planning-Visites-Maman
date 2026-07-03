-- Ajoute un PIN par message de soutien, sur le même modèle que
-- news_entries.author_pin — nécessaire pour permettre au visiteur de
-- modifier son propre message (jusqu'ici aucune notion de propriété
-- n'existait sur cette table, seul l'admin pouvait supprimer).
-- Les messages déjà postés avant cette migration auront author_pin = NULL :
-- ils restent non modifiables par PIN visiteur (aucun PIN n'a jamais été
-- saisi pour eux), ce qui est le comportement de repli souhaité.
alter table public.support_messages
  add column if not exists author_pin text;
