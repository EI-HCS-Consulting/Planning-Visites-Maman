import { useState, useEffect, useCallback } from "react";
import {
  View, Text, TextInput, TouchableOpacity, ScrollView,
  StyleSheet, Alert, ActivityIndicator,
} from "react-native";
import { supabase } from "@/lib/supabase";
import type { SupportMessage } from "@/lib/types";
import type { Theme } from "@/lib/themes";

// Section "Mur de soutien" extraite de l'ancien EntraideSoutien.tsx — voir
// components/Entraide.tsx pour l'autre moitié (Besoins).

interface Props {
  spaceId: string;
  C: Theme;
  isAdmin: boolean;
}

export default function Soutien({ spaceId, C, isAdmin }: Props) {
  const [messages, setMessages] = useState<SupportMessage[]>([]);
  const [msgsLoading, setMsgsLoading] = useState(true);

  const [msgText, setMsgText] = useState("");
  const [msgPrenom, setMsgPrenom] = useState("");
  const [msgNom, setMsgNom] = useState("");
  const [msgSaving, setMsgSaving] = useState(false);

  const [toast, setToast] = useState("");
  function showToast(msg: string) {
    setToast(msg);
    setTimeout(() => setToast(""), 3000);
  }

  const loadMessages = useCallback(async () => {
    setMsgsLoading(true);
    const { data } = await supabase
      .from("support_messages")
      .select("*")
      .eq("space_id", spaceId)
      .order("created_at", { ascending: false });
    setMessages(data || []);
    setMsgsLoading(false);
  }, [spaceId]);

  useEffect(() => { loadMessages(); }, [loadMessages]);

  useEffect(() => {
    const ch = supabase
      .channel(`support:${spaceId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "support_messages", filter: `space_id=eq.${spaceId}` }, loadMessages)
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [spaceId, loadMessages]);

  async function postMessage() {
    if (!msgText.trim() || !msgPrenom.trim() || !msgNom.trim()) return;
    setMsgSaving(true);
    await supabase.from("support_messages").insert({
      space_id: spaceId,
      message: msgText.trim(),
      author_prenom: msgPrenom.trim(),
      author_nom: msgNom.trim(),
    });
    setMsgSaving(false);
    setMsgText(""); setMsgPrenom(""); setMsgNom("");
    showToast("Message posté ✓");
    loadMessages();
  }

  async function deleteMessage(m: SupportMessage) {
    Alert.alert("Supprimer ce message ?", `"${m.message.slice(0, 60)}…"`, [
      { text: "Annuler", style: "cancel" },
      {
        text: "Supprimer", style: "destructive", onPress: async () => {
          await supabase.from("support_messages").delete().eq("id", m.id);
          loadMessages();
          showToast("Message supprimé");
        },
      },
    ]);
  }

  return (
    <View style={[styles.container, { backgroundColor: C.bg }]}>
      <View style={[styles.header, { backgroundColor: C.card, borderBottomColor: C.border }]}>
        <Text style={[styles.headerTitle, { color: "#fff" }]}>💛 Mur de soutien</Text>
      </View>

      <ScrollView contentContainerStyle={styles.listPad} keyboardShouldPersistTaps="handled">
        <View style={[styles.msgForm, { backgroundColor: C.card, borderColor: C.border }]}>
          <Text style={[styles.msgFormTitle, { color: C.gold }]}>💛 Laisser un message de soutien</Text>
          <TextInput
            style={[styles.input, styles.msgArea, { backgroundColor: C.bg, borderColor: C.border, color: C.text }]}
            placeholder="Un mot d'encouragement pour la famille et le patient…"
            placeholderTextColor={C.muted}
            value={msgText}
            onChangeText={setMsgText}
            multiline
            numberOfLines={3}
            textAlignVertical="top"
          />
          <View style={{ flexDirection: "row", gap: 8 }}>
            <TextInput
              style={[styles.input, { flex: 1, backgroundColor: C.bg, borderColor: C.border, color: C.text }]}
              placeholder="Prénom *"
              placeholderTextColor={C.muted}
              value={msgPrenom}
              onChangeText={setMsgPrenom}
              autoCapitalize="words"
            />
            <TextInput
              style={[styles.input, { flex: 1, backgroundColor: C.bg, borderColor: C.border, color: C.text }]}
              placeholder="Nom *"
              placeholderTextColor={C.muted}
              value={msgNom}
              onChangeText={setMsgNom}
              autoCapitalize="words"
            />
          </View>
          <TouchableOpacity
            style={[
              styles.postBtn,
              { backgroundColor: C.gold },
              (!msgText.trim() || !msgPrenom.trim() || !msgNom.trim() || msgSaving) && { opacity: 0.5 },
            ]}
            onPress={postMessage}
            disabled={!msgText.trim() || !msgPrenom.trim() || !msgNom.trim() || msgSaving}
          >
            {msgSaving
              ? <ActivityIndicator color="#0D1B2E" size="small" />
              : <Text style={styles.postBtnText}>Envoyer 💛</Text>
            }
          </TouchableOpacity>
        </View>

        {msgsLoading ? (
          <ActivityIndicator color={C.accent} style={{ marginTop: 24 }} />
        ) : messages.length === 0 ? (
          <View style={[styles.centered, { marginTop: 32 }]}>
            <Text style={{ fontSize: 32, marginBottom: 10 }}>💛</Text>
            <Text style={[styles.emptyText, { color: C.muted }]}>Aucun message de soutien.</Text>
            <Text style={[styles.emptyHint, { color: C.muted }]}>Sois le premier à en laisser un !</Text>
          </View>
        ) : (
          messages.map((m) => (
            <View key={m.id} style={[styles.msgCard, { backgroundColor: C.card, borderColor: C.border }]}>
              <View style={styles.msgCardHeader}>
                <View style={[styles.msgAvatar, { backgroundColor: `${C.gold}33` }]}>
                  <Text style={[styles.msgAvatarText, { color: C.gold }]}>
                    {m.author_prenom.charAt(0).toUpperCase()}
                  </Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.msgAuthor, { color: "#fff" }]}>{m.author_prenom} {m.author_nom}</Text>
                  <Text style={[styles.msgDate, { color: C.muted }]}>
                    {new Date(m.created_at).toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" })}
                  </Text>
                </View>
                {isAdmin && (
                  <TouchableOpacity onPress={() => deleteMessage(m)} style={[styles.iconBtn, { borderColor: "rgba(233,69,96,0.3)" }]}>
                    <Text style={{ fontSize: 13, color: "#e94560" }}>🗑️</Text>
                  </TouchableOpacity>
                )}
              </View>
              <Text style={[styles.msgText, { color: C.text }]}>{m.message}</Text>
            </View>
          ))
        )}
      </ScrollView>

      {!!toast && (
        <View style={[styles.toast, { backgroundColor: C.success }]}>
          <Text style={styles.toastText}>{toast}</Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  centered: { flex: 1, alignItems: "center", justifyContent: "center", padding: 32 },
  emptyText: { fontFamily: "DM_Sans_600SemiBold", fontSize: 15, textAlign: "center", marginBottom: 6 },
  emptyHint: { fontFamily: "DM_Sans_400Regular", fontSize: 13, textAlign: "center" },

  header: { paddingHorizontal: 16, paddingTop: 52, paddingBottom: 12, borderBottomWidth: 1 },
  headerTitle: { fontFamily: "PlayfairDisplay_700Bold", fontSize: 18 },

  listPad: { padding: 14, paddingBottom: 40 },

  msgForm: { borderWidth: 1, borderRadius: 14, padding: 14, marginBottom: 14 },
  msgFormTitle: { fontFamily: "DM_Sans_600SemiBold", fontSize: 12, letterSpacing: 0.8, textTransform: "uppercase", marginBottom: 10 },
  msgArea: { height: 80, textAlignVertical: "top" },
  postBtn: { borderRadius: 10, paddingVertical: 12, alignItems: "center", marginTop: 4 },
  postBtnText: { fontFamily: "DM_Sans_700Bold", fontSize: 14, color: "#0D1B2E" },
  msgCard: { borderWidth: 1, borderRadius: 14, padding: 14, marginBottom: 10 },
  msgCardHeader: { flexDirection: "row", alignItems: "center", gap: 10, marginBottom: 8 },
  msgAvatar: { width: 36, height: 36, borderRadius: 18, alignItems: "center", justifyContent: "center" },
  msgAvatarText: { fontFamily: "DM_Sans_700Bold", fontSize: 15 },
  msgAuthor: { fontFamily: "DM_Sans_700Bold", fontSize: 13 },
  msgDate: { fontFamily: "DM_Sans_400Regular", fontSize: 11, marginTop: 1 },
  msgText: { fontFamily: "DM_Sans_400Regular", fontSize: 14, lineHeight: 22 },
  iconBtn: { width: 30, height: 30, borderWidth: 1, borderRadius: 8, alignItems: "center", justifyContent: "center" },

  input: { borderWidth: 1, borderRadius: 10, padding: 12, fontFamily: "DM_Sans_400Regular", fontSize: 15, marginBottom: 10 },

  toast: { position: "absolute", bottom: 24, alignSelf: "center", paddingVertical: 10, paddingHorizontal: 20, borderRadius: 10 },
  toastText: { fontFamily: "DM_Sans_600SemiBold", fontSize: 13, color: "#fff" },
});
