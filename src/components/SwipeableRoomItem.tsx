import { Text, TouchableOpacity, View } from "react-native";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from "react-native-reanimated";
import Ionicons from "@expo/vector-icons/Ionicons";
import { Doc } from "@/convex/_generated/dataModel";
import { COLORS } from "@/constants/theme";

export function SwipeableRoomItem({ room, isCreator, onPress, onDelete }: {
  room: Doc<"chatRooms">;
  isCreator: boolean;
  onPress: () => void;
  onDelete: () => void;
}) {
  const translateX = useSharedValue(0);
  const swiping = useSharedValue(false);

  const close = () => {
    translateX.set(withSpring(0, { damping: 18, stiffness: 180 }));
  };

  const pan = Gesture.Pan()
    .activeOffsetX([-10, 10])
    .failOffsetY([-15, 15])
    .onBegin(() => { swiping.set(false); })
    .onStart(() => { swiping.set(true); })
    .onUpdate(event => {
      translateX.set(Math.max(-100, Math.min(0, event.translationX)));
    })
    .onEnd(event => {
      translateX.set(withSpring(event.translationX < -50 ? -80 : 0, {
        damping: 18,
        stiffness: 180,
      }));
    })
    .onFinalize((_event, success) => {
      if (!success) {
        translateX.set(withSpring(0, { damping: 18, stiffness: 180 }));
      }
    });

  const cardStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: translateX.get() }],
  }));
  const iconStyle = useAnimatedStyle(() => {
    const progress = Math.min(-translateX.get() / 80, 1);
    return { opacity: progress, transform: [{ scale: 0.6 + 0.4 * progress }] };
  });

  return (
    <View style={{ marginBottom: 12, borderRadius: 16, overflow: "hidden", backgroundColor: "#DC2626" }}>
      <TouchableOpacity
        accessibilityRole="button"
        accessibilityLabel={`${isCreator ? "Видалити" : "Закрити"} кімнату ${room.title}`}
        onPress={() => { close(); onDelete(); }}
        style={{ position: "absolute", right: 0, top: 0, bottom: 0, width: 80, alignItems: "center", justifyContent: "center" }}
      >
        <Animated.View style={[{ alignItems: "center" }, iconStyle]}>
          <Ionicons name="trash-outline" size={24} color="white" />
          <Text className="text-white text-xs font-semibold mt-1">
            {isCreator ? "Видалити" : "Закрити"}
          </Text>
        </Animated.View>
      </TouchableOpacity>
      <GestureDetector gesture={pan} touchAction="pan-y">
        <Animated.View style={cardStyle}>
          <TouchableOpacity
            accessibilityRole="button"
            accessibilityLabel={room.title}
            activeOpacity={0.9}
            onPress={() => {
              if (swiping.get()) return;
              if (translateX.get() !== 0) close(); else onPress();
            }}
            className="rounded-2xl bg-surface border border-surfaceLight p-4 flex-row items-center"
          >
            <View className="w-12 h-12 rounded-xl bg-surfaceLight items-center justify-center mr-4">
              <Ionicons name="chatbubbles" size={22} color={COLORS.primary} />
            </View>
            <View className="flex-1">
            <View className="flex-row items-center gap-2">
              <Text className="text-white text-lg font-semibold flex-shrink" numberOfLines={1}>
                {room.title}
              </Text>
              {isCreator ? (
                <View className="bg-primary/20 rounded px-2 py-1">
                  <Text className="text-primary text-xs font-semibold">автор</Text>
                </View>
              ) : null}
            </View>
            {room.description ? (
              <Text className="text-grey text-sm mt-1" numberOfLines={1}>{room.description}</Text>
            ) : null}
            <Text className="text-grey text-sm mt-3" numberOfLines={1}>
              {room.lastMessage ?? "Повідомлень немає"}
            </Text>
            <View className="flex-row items-center justify-between mt-2">
              <Text className="text-grey text-xs">
                {room.lastMessageAt ? new Date(room.lastMessageAt).toLocaleTimeString([], {
                  hour: "2-digit", minute: "2-digit",
                }) : ""}
              </Text>
              <Ionicons name="chevron-forward" size={16} color={COLORS.grey} />
            </View>
            </View>
          </TouchableOpacity>
        </Animated.View>
      </GestureDetector>
    </View>
  );
}
