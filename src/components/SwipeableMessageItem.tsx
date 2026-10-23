import { Image, Text, TouchableOpacity, View } from "react-native";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import Animated, { runOnJS, useAnimatedStyle, useSharedValue, withSpring } from "react-native-reanimated";
import Ionicons from "@expo/vector-icons/Ionicons";
import { Doc, Id } from "@/convex/_generated/dataModel";
import { COLORS } from "@/constants/theme";
import { VoiceMessagePlayer } from "./VoiceMessagePlayer";
import { VideoNotePlayer } from "./VideoNotePlayer";
import { ReactionBadges } from "./ReactionBadges";

export function SwipeableMessageItem({ item, own, onReply, onActions, onImage, onAuthor, active }: {
  item: Doc<"messages">;
  own: boolean;
  onReply: (item: Doc<"messages">) => void;
  onActions: (item: Doc<"messages">) => void;
  onImage: (url: string) => void;
  onAuthor: (id: Id<"users">) => void;
  active: boolean;
}) {
  const translateX = useSharedValue(0);
  const reply = () => onReply(item);
  const pan = Gesture.Pan().activeOffsetX(10).failOffsetY([-15, 15])
    .onUpdate(event => { translateX.set(Math.max(0, Math.min(event.translationX, 80))); })
    .onEnd(event => { if (event.translationX > 50) runOnJS(reply)(); })
    .onFinalize(() => { translateX.set(withSpring(0, { damping: 16, stiffness: 200 })); });
  const bubbleStyle = useAnimatedStyle(() => ({ transform: [{ translateX: translateX.get() }] }));
  const iconStyle = useAnimatedStyle(() => ({ opacity: Math.min(translateX.get() / 50, 1) }));

  return (
    <View style={{ marginBottom: 12, justifyContent: "center" }}>
      <Animated.View style={[{ position: "absolute", left: 4 }, iconStyle]}>
        <Ionicons name="arrow-undo-circle" size={30} color={COLORS.primary} />
      </Animated.View>
      <GestureDetector gesture={pan} touchAction="pan-y">
        <Animated.View style={[{ flexDirection: "row", justifyContent: own ? "flex-end" : "flex-start" }, bubbleStyle]}>
          {!own ? (
            <TouchableOpacity accessibilityRole="button" accessibilityLabel={`Профіль ${item.senderName}`} onPress={() => onAuthor(item.senderId)} style={{ marginRight: 8, alignSelf: "flex-end" }}>
              {item.senderPhoto ? <Image source={{ uri: item.senderPhoto }} style={{ width: 30, height: 30, borderRadius: 15 }} /> :
                <View className="bg-surface rounded-full items-center justify-center" style={{ width: 30, height: 30 }}><Ionicons name="person" size={18} color={COLORS.grey} /></View>}
            </TouchableOpacity>
          ) : null}
          <TouchableOpacity testID={`message-${item._id}`} activeOpacity={0.9} onLongPress={() => onActions(item)} style={{ maxWidth: "85%", minWidth: 100, padding: 12, borderRadius: 16, backgroundColor: item.videoUrl ? "transparent" : own ? COLORS.primary : COLORS.surface }}>
            <View className="flex-row justify-between items-center gap-3 mb-1">
              <TouchableOpacity accessibilityRole="button" accessibilityLabel={`Автор ${item.senderName}`} onPress={() => onAuthor(item.senderId)} style={{ flexShrink: 1 }}>
                <Text className="text-white/80 font-semibold text-xs" numberOfLines={1}>{item.senderName}</Text>
              </TouchableOpacity>
              <TouchableOpacity accessibilityRole="button" accessibilityLabel="Дії з повідомленням" testID={`message-actions-${item._id}`} onPress={() => onActions(item)} className="p-1">
                <Ionicons name="ellipsis-horizontal" size={16} color="white" />
              </TouchableOpacity>
            </View>
            {item.replyToId ? (
              <View testID={`quote-${item._id}`} style={{ borderLeftWidth: 3, borderLeftColor: own ? "white" : COLORS.primary, backgroundColor: "rgba(0,0,0,0.22)", borderRadius: 5, padding: 8, marginBottom: 8 }}>
                <Text className="text-white font-semibold text-xs">{item.replyToSender}</Text>
                <Text className="text-white/80 text-xs mt-1" numberOfLines={2}>{item.replyToText}</Text>
              </View>
            ) : null}
            {item.imageUrl ? (
              <TouchableOpacity accessibilityRole="button" accessibilityLabel="Відкрити фото" onPress={() => onImage(item.imageUrl!)} onLongPress={() => onActions(item)}>
                <Image accessibilityLabel="Фото у повідомленні" source={{ uri: item.imageUrl }} resizeMode="cover" style={{ width: 210, maxWidth: "100%", height: 190, borderRadius: 10, marginBottom: 6 }} />
              </TouchableOpacity>
            ) : null}
            {item.audioUrl ? <VoiceMessagePlayer url={item.audioUrl} duration={item.audioDuration ?? 0} /> : null}
            {item.videoUrl ? <VideoNotePlayer url={item.videoUrl} duration={item.videoDuration ?? 0} active={active} /> : null}
            {item.content ? <Text className="text-white text-base" style={{ flexShrink: 1 }}>{item.content}</Text> : null}
            <ReactionBadges messageId={item._id} />
            <Text className="text-white/70 text-xs text-right mt-2">
              {item.isEdited ? "(ред.) " : ""}
              {new Date(item._creationTime).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
            </Text>
          </TouchableOpacity>
        </Animated.View>
      </GestureDetector>
    </View>
  );
}
