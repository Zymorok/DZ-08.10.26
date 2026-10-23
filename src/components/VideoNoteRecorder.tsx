import { useEffect, useRef, useState } from "react";
import { AppState, Linking, Modal, Text, TouchableOpacity, View } from "react-native";
import { CameraType, CameraView, useCameraPermissions, useMicrophonePermissions } from "expo-camera";
import Ionicons from "@expo/vector-icons/Ionicons";
import { COLORS } from "@/constants/theme";

export function VideoNoteRecorder({ onClose, onSendVideo }: {
  onClose: () => void;
  onSendVideo: (uri: string, duration: number) => Promise<void>;
}) {
  const camera = useRef<CameraView>(null);
  const [permission, requestCamera] = useCameraPermissions();
  const [microphone, requestMicrophone] = useMicrophonePermissions();
  const [facing, setFacing] = useState<CameraType>("front");
  const [ready, setReady] = useState(false);
  const [recording, setRecording] = useState(false);
  const [sending, setSending] = useState(false);
  const [seconds, setSeconds] = useState(0);
  const [error, setError] = useState("");
  const cancelled = useRef(false);
  const started = useRef(0);

  useEffect(() => {
    const instance = camera.current;
    return () => { cancelled.current = true; instance?.stopRecording(); };
  }, []);

  useEffect(() => {
    if (!recording) return;
    const timer = setInterval(() => setSeconds(Math.min(60, Math.floor((Date.now() - started.current) / 1000))), 200);
    const listener = AppState.addEventListener("change", state => {
      if (state !== "active") { cancelled.current = true; camera.current?.stopRecording(); onClose(); }
    });
    return () => { clearInterval(timer); listener.remove(); };
  }, [recording, onClose]);

  async function permissions() {
    try {
      const video = await requestCamera();
      const audio = await requestMicrophone();
      if (!video.granted || !audio.granted) setError("Потрібен доступ до камери та мікрофона.");
    } catch { setError("Не вдалося отримати доступ до камери."); }
  }

  async function start() {
    if (!ready || recording || sending) return;
    setError("");
    cancelled.current = false;
    started.current = Date.now();
    setSeconds(0);
    setRecording(true);
    try {
      const result = await camera.current?.recordAsync({ maxDuration: 60, maxFileSize: 25 * 1024 * 1024 });
      setRecording(false);
      if (!result?.uri || cancelled.current) return;
      const duration = Math.min(60, (Date.now() - started.current) / 1000);
      if (duration < 0.5) { setError("Запишіть щонайменше одну секунду."); return; }
      setSending(true);
      await onSendVideo(result.uri, duration);
      onClose();
    } catch { if (!cancelled.current) setError("Не вдалося записати або надіслати відео. Спробуйте ще раз."); }
    finally { setRecording(false); setSending(false); }
  }

  function cancel() {
    if (sending) return;
    cancelled.current = true;
    if (recording) camera.current?.stopRecording();
    onClose();
  }

  return (
    <Modal visible animationType="slide" onRequestClose={cancel}>
      <View style={{ flex: 1, backgroundColor: COLORS.background, justifyContent: "center", alignItems: "center", gap: 24, padding: 24 }}>
        <Text className="text-white text-xl font-semibold">Відеоповідомлення</Text>
        {permission?.granted && microphone?.granted ? (
          <View style={{ width: 280, height: 280, maxWidth: "100%", borderRadius: 140, overflow: "hidden", borderWidth: 3, borderColor: recording ? "#ef4444" : COLORS.primary }}>
            <CameraView ref={camera} facing={facing} mode="video" videoQuality="480p" style={{ flex: 1 }} onCameraReady={() => setReady(true)} onMountError={() => setError("Камера недоступна.")} />
          </View>
        ) : (
          <>
            <Text className="text-grey text-center">Дозвольте доступ до камери та мікрофона для запису.</Text>
            <TouchableOpacity accessibilityRole="button" onPress={permission?.canAskAgain === false || microphone?.canAskAgain === false ? () => Linking.openSettings() : permissions} className="p-4 bg-primary rounded-xl">
              <Text className="text-white">{permission?.canAskAgain === false || microphone?.canAskAgain === false ? "Відкрити налаштування" : "Надати доступ"}</Text>
            </TouchableOpacity>
          </>
        )}
        <Text className="text-white text-lg">{sending ? "Надсилання..." : `${seconds} / 60 с`}</Text>
        {error ? <Text className="text-red-400 text-center">{error}</Text> : null}
        <View className="flex-row items-center gap-6">
          <TouchableOpacity accessibilityRole="button" accessibilityLabel="Скасувати відео" onPress={cancel} disabled={sending} className="p-3">
            <Ionicons name="close" size={30} color="white" />
          </TouchableOpacity>
          <TouchableOpacity accessibilityRole="button" accessibilityLabel={recording ? "Надіслати відео" : "Почати запис відео"} onPress={recording ? () => camera.current?.stopRecording() : start} disabled={!ready || sending} style={{ padding: 20, borderRadius: 40, backgroundColor: recording ? "#ef4444" : COLORS.primary, opacity: ready && !sending ? 1 : 0.4 }}>
            <Ionicons name={recording ? "send" : "videocam"} size={30} color="white" />
          </TouchableOpacity>
          <TouchableOpacity accessibilityRole="button" accessibilityLabel="Перемкнути камеру" onPress={() => { setReady(false); setFacing(facing === "front" ? "back" : "front"); }} disabled={recording || sending || !ready} className="p-3">
            <Ionicons name="camera-reverse" size={30} color="white" />
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}
