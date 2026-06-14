import * as Notifications from "expo-notifications";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { Platform } from "react-native";

export async function setupNotifications(): Promise<void> {
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowAlert: true,
      shouldPlaySound: true,
      shouldSetBadge: false,
    }),
  });

  if (Platform.OS === "android") {
    await Notifications.setNotificationChannelAsync("visits", {
      name: "Rappels de visite",
      importance: Notifications.AndroidImportance.HIGH,
      vibrationPattern: [0, 250, 250, 250],
      lightColor: "#F0B429",
      sound: "default",
    });
  }
}

export async function requestNotificationPermission(): Promise<boolean> {
  const { status: existing } = await Notifications.getPermissionsAsync();
  if (existing === "granted") return true;
  const { status } = await Notifications.requestPermissionsAsync();
  return status === "granted";
}

export async function scheduleVisitReminder(
  reservationId: string,
  iso: string,
  slot: string,
  visitorPrenom: string,
  patientName: string,
): Promise<void> {
  try {
    const granted = await requestNotificationPermission();
    if (!granted) return;

    const visitDate = new Date(`${iso}T${slot}:00`);
    const reminderDate = new Date(visitDate.getTime() - 60 * 60 * 1000);

    if (reminderDate <= new Date()) return;

    const notifId = await Notifications.scheduleNotificationAsync({
      content: {
        title: "🏥 Visite dans 1 heure",
        body: `${visitorPrenom}, ta visite pour ${patientName} est à ${slot}.`,
        sound: "default",
        data: { reservationId, iso, slot },
      },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.DATE,
        date: reminderDate,
        channelId: Platform.OS === "android" ? "visits" : undefined,
      } as Notifications.DateTriggerInput,
    });

    await AsyncStorage.setItem(`notif_${reservationId}`, notifId);
  } catch {
    // Non-fatal
  }
}

export async function cancelVisitReminder(reservationId: string): Promise<void> {
  try {
    const notifId = await AsyncStorage.getItem(`notif_${reservationId}`);
    if (notifId) {
      await Notifications.cancelScheduledNotificationAsync(notifId);
      await AsyncStorage.removeItem(`notif_${reservationId}`);
    }
  } catch {
    // Non-fatal
  }
}
