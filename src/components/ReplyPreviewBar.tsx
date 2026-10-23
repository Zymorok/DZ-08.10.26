import { Text, TouchableOpacity, View } from "react-native";
import Ionicons from "@expo/vector-icons/Ionicons";
import { Doc } from "@/convex/_generated/dataModel";
import { COLORS } from "@/constants/theme";

export function ReplyPreviewBar({ message, onCancel }: {
  message: Doc<"messages">;
  onCancel: () => void;
}) {
  return (
    <View className="bg-surface flex-row items-center px-4 py-2 border-l-4 border-primary gap-3">
      <Ionicons name="arrow-undo" size={20} color={COLORS.primary} />
      <View className="flex-1">
        <Text className="text-primary font-semibold text-xs">Відповідь для {message.senderName}</Text>
        <Text className="text-white text-sm" numberOfLines={1}>{message.content || (message.audioUrl ? "🎤 Голосове повідомлення" : message.videoUrl ? "📹 Відеоповідомлення" : "📷 Фотографія")}</Text>
      </View>
      <TouchableOpacity accessibilityRole="button" accessibilityLabel="Скасувати відповідь" onPress={onCancel} className="p-2">
        <Ionicons name="close-circle-outline" size={23} color={COLORS.grey} />
      </TouchableOpacity>
    </View>
  );
}
