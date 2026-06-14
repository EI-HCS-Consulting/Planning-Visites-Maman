import type { ThemeKey } from "./themes";

export interface PatientSpace {
  id: string;
  admin_id: string;
  patient_firstname: string;
  patient_lastname: string;
  patient_photo_url: string | null;
  hospital_name: string;
  hospital_service: string;
  hospital_room: string;
  hospital_address: string;
  hospital_maps_url: string;
  visit_rules: string;
  admin_notes: string;
  theme: ThemeKey;
  start_date: string;
  end_date: string;
  is_active: boolean;
  invite_token: string;
  stripe_payment_id: string | null;
  last_activity_at: string;
  purge_scheduled_at: string;
  created_at: string;
}

export interface SlotConfig {
  id: string;
  space_id: string;
  visit_start_hour: number;
  visit_end_hour: number;
  slot_duration_minutes: number;
  min_gap_minutes: number;
  max_visitors_per_slot: number;
  night_enabled: boolean;
  max_night_visitors: number;
}

export interface Reservation {
  id: string;
  space_id: string;
  date: string;
  creneau: string;
  prenom: string;
  nom: string;
  telephone: string;
  type: "Visite" | "Nuit";
  pin: string;
  push_token: string | null;
  timestamp: string;
}

export interface SouvenirPhoto {
  id: string;
  space_id: string;
  filename: string;
  caption: string;
  uploaded_by_prenom: string;
  uploaded_by_nom: string;
  uploaded_by_pin: string;
  created_at: string;
  url?: string;
}

export interface NewsEntry {
  id: string;
  space_id: string;
  news_date: string;
  content: string;
  photos: string[];
  author_prenom: string;
  author_nom: string;
  author_pin: string;
  created_at: string;
}

export interface Task {
  id: string;
  space_id: string;
  title: string;
  description: string;
  category: "repas" | "affaires" | "courses" | "autre";
  status: "ouvert" | "pris_en_charge" | "fait";
  claimed_by_prenom: string | null;
  claimed_by_nom: string | null;
  claimed_by_pin: string | null;
  created_by: string;
  created_at: string;
}

export interface SupportMessage {
  id: string;
  space_id: string;
  message: string;
  author_prenom: string;
  author_nom: string;
  created_at: string;
}
