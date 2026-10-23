import { Text, TouchableOpacity, View } from "react-native";

export function ReactionPickerModal({ onSelect, disabled }: { onSelect: (emoji: string) => void; disabled: boolean }) {
  return (
    <View className="flex-row justify-between mb-3" style={{ flexWrap: "wrap" }}>
      {["👍", "❤️", "😂", "🔥", "😮", "😢"].map(emoji => (
        <TouchableOpacity key={emoji} accessibilityRole="button" accessibilityLabel={`Додати реакцію ${emoji}`} disabled={disabled} onPress={() => onSelect(emoji)} style={{ padding: 6 }}>
          <Text style={{ fontSize: 27 }}>{emoji}</Text>
        </TouchableOpacity>
      ))}
    </View>
  );
}
