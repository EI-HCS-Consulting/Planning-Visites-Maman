import AsyncStorage from "@react-native-async-storage/async-storage";

// Keeps track of which native calendar event (expo-calendar) belongs to
// which reservation, so it can be updated/deleted later if the visitor
// reschedules or cancels. Same on-device storage pattern as
// lib/notifications.ts's notif_${reservationId} mapping — the event only
// exists locally on this device's calendar app, no server sync needed.

export async function linkCalendarEvent(reservationId: string, eventId: string): Promise<void> {
  if (!reservationId || !eventId) return;
  await AsyncStorage.setItem(`calendar_event_${reservationId}`, eventId);
}

export async function getLinkedCalendarEvent(reservationId: string): Promise<string | null> {
  if (!reservationId) return null;
  return AsyncStorage.getItem(`calendar_event_${reservationId}`);
}

export async function unlinkCalendarEvent(reservationId: string): Promise<void> {
  if (!reservationId) return;
  await AsyncStorage.removeItem(`calendar_event_${reservationId}`);
}
