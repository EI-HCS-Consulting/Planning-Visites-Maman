import type { ThemeKey } from "./themes";

export interface PatientSpace {
  id: string;
  admin_id: string;
  patient_firstname: string;
  patient_lastname: string;
  patient_photo_url: string | null;
  hospital_name: string;
  hospital_service: string;
  hospital_sector: string | null;
  hospital_room: string;
  hospital_address: string;
  hospital_address_line2: string | null;
  hospital_postal_code: string | null;
  hospital_city: string | null;
  hospital_country: string | null;
  hospital_maps_url: string;
  home_care_mode: boolean;
  home_address: string | null;
  home_address_line2: string | null;
  home_postal_code: string | null;
  home_city: string | null;
  home_country: string | null;
  home_maps_url: string | null;
  visit_rules: string;
  admin_notes: string;
  theme: ThemeKey;
  start_date: string;
  end_date: string;
  is_active: boolean;
  premium: boolean;
  invite_token: string;
  dossier_code: string | null;
  cap_email_sent_at: string | null;
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
  gap_includes_duration: boolean;
  max_visitors_per_slot: number;
  night_enabled: boolean;
  max_night_visitors: number;
  night_start_hour: number;
  night_end_hour: number;
  allowed_weekdays: number[];
  blocked_dates: string[];
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
  source_type: "news" | "support" | null;
  source_id: string | null;
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
  claimed_photo: string | null;
  claimed_text: string | null;
  done_photo: string | null;
  created_by: string;
  photo: string | null;
  created_at: string;
}

export interface SupportMessage {
  id: string;
  space_id: string;
  message: string;
  author_prenom: string;
  author_nom: string;
  author_pin: string | null;
  photo: string | null;
  created_at: string;
}
