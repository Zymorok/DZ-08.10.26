import { RefObject, useEffect, useRef, useState } from "react";
import { ActivityIndicator, AppState, Text, TextInput, TouchableOpacity, View } from "react-native";
import { AudioModule, RecordingPresets, setAudioModeAsync, useAudioRecorder, useAudioRecorderState } from "expo-audio";
import Ionicons from "@expo/vector-icons/Ionicons";
import { COLORS } from "@/constants/theme";
import { VideoNoteRecorder } from "./VideoNoteRecorder";

export function ChatInput({ text, onChangeText, onBlur, onSend, onPickImage, onRecording, onError, submitting, editing, hasImage, inputRef }: {
  text: string;
  onChangeText: (text: string) => void;
  onBlur: () => void;
  onSend: () => void;
  onPickImage: () => void;
  onRecording: (uri: string, type: "audio" | "video", duration: number) => Promise<void>;
  onError: (message: string) => void;
  submitting: boolean;
  editing: boolean;
  hasImage: boolean;
  inputRef: RefObject<TextInput | null>;
}) {
  const [video, setVideo] = useState(false);
  const [busy, setBusy] = useState(false);
  const [recording, setRecording] = useState(false);
  const [draft, setDraft] = useState<{ uri: string; duration: number } | null>(null);
  const cancelled = useRef(false);
  const started = useRef(0);
  const recorder = useAudioRecorder(RecordingPresets.HIGH_QUALITY, status => {
    if (status.hasError) { setRecording(false); onError("Запис перервано. Спробуйте ще раз."); }
    if (status.isFinished && status.url && !cancelled.current) {
      setRecording(false);
      setDraft({ uri: status.url, duration: Math.min(120, (Date.now() - started.current) / 1000) });
    }
  });
  const state = useAudioRecorderState(recorder, 200);

  useEffect(() => {
    const listener = AppState.addEventListener("change", next => {
      if (next !== "active" && recorder.isRecording) {
        cancelled.current = true;
        recorder.stop().catch(() => {});
        setRecording(false);
      }
    });
    return () => listener.remove();
  }, [recorder]);

  async function start() {
    if (busy || submitting) return;
    setBusy(true);
    onError("");
    try {
      const permission = await AudioModule.requestRecordingPermissionsAsync();
      if (!permission.granted) { onError("Дозвольте доступ до мікрофона в налаштуваннях пристрою або браузера."); return; }
      await setAudioModeAsync({ allowsRecording: true, playsInSilentMode: true });
      await recorder.prepareToRecordAsync();
      cancelled.current = false;
      started.current = Date.now();
      recorder.record({ forDuration: 120 });
      setRecording(true);
    } catch { onError("Не вдалося розпочати запис. Перевірте мікрофон."); }
    finally { setBusy(false); }
  }

  async function finish(send: boolean) {
    if (busy || submitting) return;
    setBusy(true);
    try {
      cancelled.current = !send;
      let audio = draft;
      if (recorder.isRecording) {
        const duration = Math.min(120, (Date.now() - started.current) / 1000);
        await recorder.stop();
        audio = recorder.uri ? { uri: recorder.uri, duration } : null;
      }
      setRecording(false);
      await setAudioModeAsync({ allowsRecording: false, playsInSilentMode: true });
      if (!send) { setDraft(null); return; }
      if (!audio || audio.duration < 0.5) { setDraft(null); onError("Запишіть щонайменше одну секунду."); return; }
      setDraft(audio);
      await onRecording(audio.uri, "audio", audio.duration);
      setDraft(null);
    } catch { onError("Не вдалося надіслати аудіо. Спробуйте ще раз."); }
    finally { setBusy(false); }
  }

  if (recording || draft) return (
    <View className="flex-row items-center gap-3 p-3 border-t border-surfaceLight">
      <TouchableOpacity accessibilityRole="button" accessibilityLabel="Скасувати аудіо" onPress={() => finish(false)} disabled={busy || submitting} className="p-2">
        <Ionicons name="trash-outline" size={25} color="#f87171" />
      </TouchableOpacity>
      <View className="flex-1">
        <Text className="text-red-400 font-semibold">{recording ? `● Запис: ${Math.floor(state.durationMillis / 1000)} с` : "Аудіо готове до надсилання"}</Text>
        <Text className="text-grey text-xs">До 120 секунд</Text>
      </View>
      <TouchableOpacity accessibilityRole="button" accessibilityLabel="Надіслати аудіо" onPress={() => finish(true)} disabled={busy || submitting} className="p-3 bg-primary rounded-full">
        {busy || submitting ? <ActivityIndicator color="white" /> : <Ionicons name="send" size={23} color="white" />}
      </TouchableOpacity>
    </View>
  );

  return (
    <>
      <View className="flex-row items-end gap-1 p-3 border-t border-surfaceLight">
        <TouchableOpacity accessibilityRole="button" accessibilityLabel="Обрати фото" onPress={onPickImage} disabled={submitting || editing || busy} style={{ padding: 8, opacity: editing ? 0.3 : 1 }}>
          <Ionicons name="image-outline" size={24} color={COLORS.primary} />
        </TouchableOpacity>
        <TextInput ref={inputRef} accessibilityLabel="Повідомлення" value={text} onChangeText={onChangeText} onBlur={onBlur} editable={!submitting && !busy} maxLength={2000} multiline placeholder={editing ? "Змініть текст..." : hasImage ? "Підпис до фото..." : "Повідомлення..."} placeholderTextColor={COLORS.grey} className="flex-1 bg-surface border border-surfaceLight rounded-2xl text-white px-3 py-3" style={{ minHeight: 44, maxHeight: 120 }} />
        {!editing && !hasImage && !text.trim() ? (
          <>
            <TouchableOpacity accessibilityRole="button" accessibilityLabel="Записати відео" onPress={() => { onError(""); setVideo(true); }} disabled={submitting || busy} style={{ padding: 8 }}>
              <Ionicons name="videocam-outline" size={24} color={COLORS.primary} />
            </TouchableOpacity>
            <TouchableOpacity accessibilityRole="button" accessibilityLabel="Записати аудіо" onPress={start} disabled={submitting || busy} className="p-3 bg-primary rounded-full">
              {busy ? <ActivityIndicator color="white" /> : <Ionicons name="mic" size={23} color="white" />}
            </TouchableOpacity>
          </>
        ) : (
          <TouchableOpacity accessibilityRole="button" accessibilityLabel={editing ? "Зберегти зміни" : "Надіслати"} onPress={onSend} disabled={submitting || busy} className="p-3 bg-primary rounded-full">
            {submitting ? <ActivityIndicator color="white" /> : <Ionicons name={editing ? "checkmark" : "send"} size={23} color="white" />}
          </TouchableOpacity>
        )}
      </View>
      {video ? <VideoNoteRecorder onClose={() => setVideo(false)} onSendVideo={(uri, duration) => onRecording(uri, "video", duration)} /> : null}
    </>
  );
}
