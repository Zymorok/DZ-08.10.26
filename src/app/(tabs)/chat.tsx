import { useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Modal,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { useRouter } from "expo-router";
import { useMutation, useQuery } from "convex/react";
import Ionicons from "@expo/vector-icons/Ionicons";
import { api } from "@/convex/_generated/api";
import { COLORS } from "@/constants/theme";
import { Doc } from "@/convex/_generated/dataModel";
import { SwipeableRoomItem } from "@/components/SwipeableRoomItem";

export default function ChatRoomsScreen() {
  const router = useRouter();
  const rooms = useQuery(api.rooms.listRooms);
  const user = useQuery(api.users.currentUser);
  const deleteRoom = useMutation(api.rooms.deleteRoom);
  const [selectedRoom, setSelectedRoom] = useState<Doc<"chatRooms"> | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState("");
  const isCreator = selectedRoom?.creatorId === user?._id;

  async function confirmDelete() {
    if (!selectedRoom || !isCreator || deleting) return;
    setDeleting(true);
    setError("");
    try {
      await deleteRoom({ roomId: selectedRoom._id });
      setSelectedRoom(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Не вдалося видалити кімнату");
    } finally {
      setDeleting(false);
    }
  }

  function closeDialog() {
    if (!deleting) setSelectedRoom(null);
  }

  return (
    <View className="flex-1 bg-black">
      <View className="flex-row justify-between items-center p-5 border-b border-surfaceLight">
        <View>
          <Text className="text-white text-2xl font-bold">Чати Prostir</Text>
          <Text className="text-grey text-sm mt-1">
            Спілкуйтеся та діліться фотографіями
          </Text>
        </View>
        <TouchableOpacity
          accessibilityRole="button"
          accessibilityLabel="Нова кімната"
          onPress={() => router.push("/new-room")}
          className="p-2"
        >
          <Ionicons
            name="add-circle-outline"
            size={32}
            color={COLORS.primary}
          />
        </TouchableOpacity>
      </View>
      {rooms === undefined ? (
        <ActivityIndicator className="mt-10" color={COLORS.primary} />
      ) : (
        <FlatList
          data={rooms}
          keyExtractor={(room) => room._id}
          contentContainerStyle={{ padding: 16, paddingBottom: 90 }}
          ListEmptyComponent={
            <Text className="text-grey text-center mt-10">
              Кімнат поки немає. Створіть першу.
            </Text>
          }
          renderItem={({ item }) => (
            <SwipeableRoomItem
              room={item}
              isCreator={item.creatorId === user?._id}
              onPress={() => router.push(`/chat/${item._id}`)}
              onDelete={() => { setError(""); setSelectedRoom(item); }}
            />
          )}
        />
      )}
      <Modal visible={selectedRoom !== null} transparent animationType="fade" onRequestClose={closeDialog}>
        <View style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.75)", justifyContent: "center", padding: 24 }}>
          <View className="bg-surface border border-surfaceLight rounded-2xl p-5" style={{ width: "100%", maxWidth: 420, alignSelf: "center" }}>
            <Text className="text-white text-xl font-bold">
              {isCreator ? "Видалити кімнату?" : "Обмеження доступу"}
            </Text>
            <Text className="text-grey text-base mt-3">
              {isCreator
                ? `Кімнату «${selectedRoom?.title}» та всі її повідомлення буде видалено. Цю дію неможливо скасувати.`
                : "Лише автор кімнати може видалити її для всіх учасників."}
            </Text>
            {error ? <Text className="text-red-400 mt-3">{error}</Text> : null}
            <View className="flex-row justify-end gap-3 mt-5">
              <TouchableOpacity accessibilityRole="button" accessibilityLabel={isCreator ? "Скасувати видалення" : "Зрозуміло"} onPress={closeDialog} disabled={deleting} className="bg-surfaceLight rounded-xl px-4 py-3">
                <Text className="text-white font-semibold">{isCreator ? "Скасувати" : "Зрозуміло"}</Text>
              </TouchableOpacity>
              {isCreator ? (
                <TouchableOpacity accessibilityRole="button" accessibilityLabel="Підтвердити видалення кімнати" onPress={confirmDelete} disabled={deleting} style={{ backgroundColor: "#DC2626", opacity: deleting ? 0.6 : 1 }} className="rounded-xl px-4 py-3">
                  <Text className="text-white font-semibold">{deleting ? "Видалення..." : "Видалити"}</Text>
                </TouchableOpacity>
              ) : null}
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}
