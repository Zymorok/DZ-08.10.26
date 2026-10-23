import {
  ActivityIndicator,
  FlatList,
  Image,
  Keyboard,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Text,
  TextInput,
  TouchableOpacity,
  View,
  ViewToken,
} from "react-native";
import { useCallback, useEffect, useRef, useState } from "react";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useMutation, usePaginatedQuery, useQuery } from "convex/react";
import { ConvexError } from "convex/values";
import Ionicons from "@expo/vector-icons/Ionicons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import * as ImagePicker from "expo-image-picker";
import { File } from "expo-file-system";
import { fetch } from "expo/fetch";
import { api } from "@/convex/_generated/api";
import { Doc, Id } from "@/convex/_generated/dataModel";
import { COLORS } from "@/constants/theme";
import { ImageViewerModal } from "@/components/ImageViewerModal";
import { TypingDots } from "@/components/TypingDots";

import { SwipeableMessageItem } from "@/components/SwipeableMessageItem";
import { ReplyPreviewBar } from "@/components/ReplyPreviewBar";
import { ChatInput } from "@/components/ChatInput";
import { ReactionPickerModal } from "@/components/ReactionPickerModal";

const viewabilityConfig = { itemVisiblePercentThreshold: 50 };

export default function ChatRoomScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const chatRoomId = id as Id<"chatRooms">;
  const room = useQuery(api.rooms.getRoom, { roomId: id });
  const { results: messages, status, loadMore } = usePaginatedQuery(api.messages.getPaginatedMessages, { chatRoomId: id }, { initialNumItems: 25 });
  const user = useQuery(api.users.currentUser);
  const typingUsers = useQuery(api.typing.getTypingUsers, { chatRoomId: id });
  const sendMessage = useMutation(api.messages.sendMessage);
  const sendMediaMessage = useMutation(api.messages.sendMediaMessage);
  const sendAudioMessage = useMutation(api.messages.sendAudioMessage);
  const sendVideoMessage = useMutation(api.messages.sendVideoNoteMessage);
  const toggleReaction = useMutation(api.reactions.toggleReaction);
  const generateUploadUrl = useMutation(api.messages.generateUploadUrl);
  const editMessage = useMutation(api.messages.editMessage);
  const deleteMessage = useMutation(api.messages.deleteMessage);
  const setTyping = useMutation(api.typing.setTyping);
  const [text, setText] = useState("");
  const [replyTarget, setReplyTarget] = useState<Doc<"messages"> | null>(null);
  const [editing, setEditing] = useState<Doc<"messages"> | null>(null);
  const [selectedImage, setSelectedImage] =
    useState<ImagePicker.ImagePickerAsset | null>(null);
  const [fullscreenImage, setFullscreenImage] = useState<string | null>(null);
  const [actionMessage, setActionMessage] = useState<Doc<"messages"> | null>(
    null,
  );
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const listRef = useRef<FlatList<Doc<"messages">>>(null);
  const inputRef = useRef<TextInput>(null);
  const lastTypingSent = useRef(0);
  const nearBottom = useRef(true);
  const [visibleMessages, setVisibleMessages] = useState<string[]>([]);
  const viewability = useCallback(({ viewableItems }: { viewableItems: ViewToken[] }) => {
    setVisibleMessages(viewableItems.map(item => item.key));
  }, []);
  const newestId = messages[0]?._id;

  useEffect(() => {
    if (nearBottom.current) listRef.current?.scrollToOffset({ offset: 0, animated: true });
  }, [newestId]);

  useEffect(
    () => () => {
      setTyping({ chatRoomId, isTyping: false }).catch(() => {});
    },
    [chatRoomId, setTyping],
  );

  function stopTyping() {
    lastTypingSent.current = 0;
    setTyping({ chatRoomId, isTyping: false }).catch(() => {});
  }

  function changeText(value: string) {
    setText(value);
    if (!value.trim()) {
      stopTyping();
    } else if (Date.now() - lastTypingSent.current >= 1500) {
      lastTypingSent.current = Date.now();
      setTyping({ chatRoomId }).catch(() => {});
    }
  }

  async function pickImage() {
    if (editing || submitting) return;
    setError("");
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ["images"],
        quality: 0.8,
      });
      if (!result.canceled && result.assets[0]) {
        if ((result.assets[0].fileSize ?? 0) > 10 * 1024 * 1024) {
          setError("Оберіть зображення розміром до 10 МБ.");
          return;
        }
        setSelectedImage(result.assets[0]);
      }
    } catch {
      setError(
        "Не вдалося відкрити фотографії. Перевірте доступ до медіатеки.",
      );
    }
  }

  async function send() {
    const content = text.trim();
    if (submitting || (!content && !selectedImage && !editing?.imageUrl))
      return;
    setSubmitting(true);
    setError("");
    try {
      if (editing) {
        await editMessage({ messageId: editing._id, content });
        setEditing(null);
      } else if (selectedImage) {
        const uploadUrl = await generateUploadUrl();
        const file =
          Platform.OS === "web"
            ? (selectedImage.file ??
              (await (await fetch(selectedImage.uri)).blob()))
            : new File(selectedImage.uri);
        const response = await fetch(uploadUrl, {
          method: "POST",
          headers: {
            "Content-Type": selectedImage.mimeType || file.type || "image/jpeg",
          },
          body: file,
        });
        if (!response.ok) throw new Error("Upload failed");
        const result = await response.json();
        await sendMediaMessage({
          chatRoomId,
          storageId: result.storageId,
          caption: content || undefined,
          replyToId: replyTarget?._id,
        });
        setSelectedImage(null);
      } else {
        await sendMessage({ chatRoomId, content, replyToId: replyTarget?._id });
      }
      setReplyTarget(null);
      setText("");
      stopTyping();
      Keyboard.dismiss();
      listRef.current?.scrollToOffset({ offset: 0, animated: false });
    } catch {
      setError(
        "Не вдалося зберегти повідомлення. Перевірте з’єднання та спробуйте ще раз.",
      );
    } finally {
      setSubmitting(false);
    }
  }

  async function sendRecording(uri: string, type: "audio" | "video", duration: number) {
    setSubmitting(true);
    setError("");
    try {
      const uploadUrl = await generateUploadUrl();
      const file = Platform.OS === "web" ? await (await fetch(uri)).blob() : new File(uri);
      const response = await fetch(uploadUrl, {
        method: "POST",
        headers: { "Content-Type": Platform.OS === "web" ? file.type.split(";")[0] : type === "audio" ? "audio/mp4" : "video/mp4" },
        body: file,
      });
      if (!response.ok) throw new Error("Upload failed");
      const { storageId } = await response.json();
      const args = { chatRoomId, storageId, duration, replyToId: replyTarget?._id };
      if (type === "audio") await sendAudioMessage(args);
      else await sendVideoMessage(args);
      setReplyTarget(null);
      stopTyping();
      listRef.current?.scrollToOffset({ offset: 0, animated: false });
    } catch (error) {
      setError(error instanceof ConvexError ? String(error.data) : "Не вдалося надіслати запис. Спробуйте ще раз.");
      throw error;
    } finally { setSubmitting(false); }
  }

  async function react(emoji: string) {
    if (!actionMessage || submitting) return;
    setSubmitting(true);
    try {
      await toggleReaction({ messageId: actionMessage._id, emoji });
      setActionMessage(null);
    } catch { setError("Не вдалося змінити реакцію. Спробуйте ще раз."); }
    finally { setSubmitting(false); }
  }

  function openActions(message: Doc<"messages">) {
    if (submitting) return;
    Keyboard.dismiss();
    setActionMessage(message);
    setConfirmDelete(false);
    setError("");
  }

  function beginReply(message: Doc<"messages">) {
    if (submitting) return;
    if (editing) setText("");
    setEditing(null);
    setReplyTarget(message);
    setActionMessage(null);
    inputRef.current?.focus();
  }

  function beginEditing() {
    if (!actionMessage) return;
    setReplyTarget(null);
    setEditing(actionMessage);
    setText(actionMessage.content ?? "");
    setSelectedImage(null);
    setActionMessage(null);
    inputRef.current?.focus();
  }

  function cancelEditing() {
    setEditing(null);
    setText("");
    stopTyping();
  }

  async function removeMessage() {
    if (!actionMessage || submitting) return;
    setSubmitting(true);
    try {
      await deleteMessage({ messageId: actionMessage._id });
      if (editing?._id === actionMessage._id) cancelEditing();
      setActionMessage(null);
      setConfirmDelete(false);
    } catch {
      setActionMessage(null);
      setError("Не вдалося видалити повідомлення. Спробуйте ще раз.");
    } finally {
      setSubmitting(false);
    }
  }

  if (room === undefined || status === "LoadingFirstPage" || user === undefined) {
    return (
      <View className="flex-1 bg-black justify-center items-center">
        <ActivityIndicator color={COLORS.primary} />
      </View>
    );
  }
  if (!room) {
    return (
      <View className="flex-1 bg-black p-5 justify-center gap-5">
        <Text className="text-white text-center">
          Кімнату видалено або не знайдено.
        </Text>
        <TouchableOpacity
          accessibilityRole="button"
          onPress={() => router.replace("/(tabs)/chat")}
        >
          <Text className="text-primary text-center">До списку кімнат</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === "ios" ? "padding" : "height"}
      keyboardVerticalOffset={insets.top}
      style={{ flex: 1, backgroundColor: COLORS.background }}
    >
      <View className="flex-row items-center px-3 py-3 border-b border-surfaceLight gap-3">
        <TouchableOpacity
          accessibilityRole="button"
          accessibilityLabel="Назад до чатів"
          onPress={() => router.replace("/(tabs)/chat")}
          className="p-2"
        >
          <Ionicons name="arrow-back" size={26} color="white" />
        </TouchableOpacity>
        <View className="flex-1">
          <Text className="text-white font-semibold text-lg" numberOfLines={1}>
            {room.title}
          </Text>
          <Text className="text-grey text-xs" numberOfLines={1}>
            {room.description ?? "Повідомлення в реальному часі"}
          </Text>
        </View>
        <TouchableOpacity
          accessibilityRole="button"
          accessibilityLabel="Інформація про кімнату"
          onPress={() => router.push(`/settings/${chatRoomId}`)}
          className="p-2"
        >
          <Ionicons
            name="information-circle-outline"
            size={26}
            color={COLORS.primary}
          />
        </TouchableOpacity>
      </View>
      <FlatList
        ref={listRef}
        data={messages}
        inverted
        initialNumToRender={12}
        maxToRenderPerBatch={10}
        windowSize={7}
        maintainVisibleContentPosition={{ minIndexForVisible: 1, autoscrollToTopThreshold: 100 }}
        onViewableItemsChanged={viewability}
        viewabilityConfig={viewabilityConfig}
        keyExtractor={(item) => item._id}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={{ padding: 16 }}
        onScroll={event => { nearBottom.current = event.nativeEvent.contentOffset.y < 100; }}
        scrollEventThrottle={100}
        onEndReached={() => { if (status === "CanLoadMore") loadMore(25); }}
        onEndReachedThreshold={0.3}
        ListFooterComponent={status === "LoadingMore" ? <View className="items-center p-3"><ActivityIndicator color={COLORS.primary} /><Text className="text-grey text-xs mt-2">Завантаження історії...</Text></View> : null}
        ListEmptyComponent={
          <Text className="text-grey text-center mt-8">
            Повідомлень ще немає. Напишіть першим.
          </Text>
        }
        renderItem={({ item }) => (
          <SwipeableMessageItem item={item} own={item.senderId === user?._id} active={visibleMessages.includes(item._id)}
            onReply={beginReply} onActions={openActions} onImage={setFullscreenImage}
            onAuthor={authorId => router.push({ pathname: '/user/[id]', params: { id: authorId } })} />
        )}
      />
      <TypingDots typingUsers={typingUsers ?? []} />
      {replyTarget ? <ReplyPreviewBar message={replyTarget} onCancel={() => setReplyTarget(null)} /> : null}
      {editing ? (
        <View className="bg-surface flex-row items-center justify-between px-4 py-2">
          <Text className="text-grey text-sm">Редагування повідомлення</Text>
          <TouchableOpacity
            accessibilityRole="button"
            accessibilityLabel="Скасувати редагування"
            onPress={cancelEditing}
            disabled={submitting}
            className="p-2"
          >
            <Ionicons
              name="close-circle-outline"
              size={23}
              color={COLORS.grey}
            />
          </TouchableOpacity>
        </View>
      ) : null}
      {selectedImage ? (
        <View className="bg-surface flex-row items-center px-4 py-2 gap-3">
          <Image
            accessibilityLabel="Прев’ю фото"
            source={{ uri: selectedImage.uri }}
            style={{ width: 50, height: 50, borderRadius: 8 }}
          />
          <Text className="text-grey flex-1 text-sm">Фото прикріплено</Text>
          <TouchableOpacity
            accessibilityRole="button"
            accessibilityLabel="Скасувати фото"
            onPress={() => setSelectedImage(null)}
            disabled={submitting}
            className="p-2"
          >
            <Ionicons
              name="close-circle-outline"
              size={23}
              color={COLORS.grey}
            />
          </TouchableOpacity>
        </View>
      ) : null}
      {error ? (
        <Text
          accessibilityLiveRegion="polite"
          className="text-red-400 text-sm px-4 py-2"
        >
          {error}
        </Text>
      ) : null}
      <ChatInput text={text} onChangeText={changeText} onBlur={stopTyping} onSend={send} onPickImage={pickImage} onRecording={sendRecording} onError={setError} submitting={submitting} editing={!!editing} hasImage={!!selectedImage} inputRef={inputRef} />
      <Modal
        visible={!!actionMessage}
        transparent
        animationType="fade"
        onRequestClose={() => !submitting && setActionMessage(null)}
      >
        <View className="flex-1 justify-center items-center bg-black/70 p-5">
          <View
            className="bg-surface rounded-2xl p-5 w-full"
            style={{ maxWidth: 360 }}
          >
            <Text className="text-white text-lg font-semibold mb-3">
              {confirmDelete ? "Видалити повідомлення?" : "Дії з повідомленням"}
            </Text>
            {confirmDelete ? (
              <>
                <Text className="text-grey mb-3">
                  Повідомлення зникне для всіх учасників.
                </Text>
                <TouchableOpacity
                  accessibilityRole="button"
                  onPress={removeMessage}
                  disabled={submitting}
                  className="py-3"
                >
                  <Text className="text-red-400">
                    {submitting ? "Видалення..." : "Так, видалити"}
                  </Text>
                </TouchableOpacity>
              </>
            ) : (
              <>
                <ReactionPickerModal onSelect={react} disabled={submitting} />
                <TouchableOpacity accessibilityRole="button" onPress={() => actionMessage && beginReply(actionMessage)} className="py-3">
                  <Text className="text-white">Відповісти</Text>
                </TouchableOpacity>
                {actionMessage?.senderId === user?._id ? <>
                {!actionMessage?.audioUrl && !actionMessage?.videoUrl ? <TouchableOpacity
                  accessibilityRole="button"
                  onPress={beginEditing}
                  className="py-3"
                >
                  <Text className="text-white">Редагувати</Text>
                </TouchableOpacity> : null}
                <TouchableOpacity
                  accessibilityRole="button"
                  onPress={() => setConfirmDelete(true)}
                  className="py-3"
                >
                  <Text className="text-red-400">Видалити</Text>
                </TouchableOpacity>
                </> : null}
              </>
            )}
            <TouchableOpacity
              accessibilityRole="button"
              onPress={() => setActionMessage(null)}
              disabled={submitting}
              className="py-3"
            >
              <Text className="text-grey">Скасувати</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
      <ImageViewerModal
        imageUrl={fullscreenImage}
        onClose={() => setFullscreenImage(null)}
      />
    </KeyboardAvoidingView>
  );
}
