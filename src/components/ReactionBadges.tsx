import { useMutation, useQuery } from "convex/react";
import { useState } from "react";
import { Text, TouchableOpacity, View } from "react-native";
import { api } from "@/convex/_generated/api";
import { Id } from "@/convex/_generated/dataModel";
import { COLORS } from "@/constants/theme";

export function ReactionBadges({ messageId }: { messageId: Id<"messages"> }) {
  const reactions = useQuery(api.reactions.getMessageReactions, { messageId });
  const toggle = useMutation(api.reactions.toggleReaction);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(false);

  async function change(emoji: string) {
    if (busy) return;
    setBusy(true);
    setError(false);
    try { await toggle({ messageId, emoji }); }
    catch { setError(true); }
    finally { setBusy(false); }
  }

  return (
    <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6, marginTop: reactions?.length ? 8 : 0 }}>
      {reactions?.map(reaction => (
        <TouchableOpacity key={reaction.emoji} accessibilityRole="button" accessibilityLabel={`Реакція ${reaction.emoji}: ${reaction.count}`} accessibilityState={{ selected: reaction.active }} disabled={busy} onPress={() => change(reaction.emoji)} style={{ borderWidth: 1, borderColor: reaction.active ? "white" : COLORS.grey, borderRadius: 12, paddingHorizontal: 9, paddingVertical: 4, backgroundColor: reaction.active ? "#ffffff30" : "#00000030" }}>
          <Text className="text-white text-sm">{reaction.emoji} {reaction.count}</Text>
        </TouchableOpacity>
      ))}
      {error ? <Text className="text-red-300 text-xs">Спробуйте ще раз.</Text> : null}
    </View>
  );
}
