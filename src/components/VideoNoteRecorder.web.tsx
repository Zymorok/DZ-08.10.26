import { useEffect, useRef, useState } from "react";
import { Modal, Text, TouchableOpacity, View } from "react-native";
import { COLORS } from "@/constants/theme";

export function VideoNoteRecorder({ onClose, onSendVideo }: {
  onClose: () => void;
  onSendVideo: (uri: string, duration: number) => Promise<void>;
}) {
  const video = useRef<HTMLVideoElement>(null);
  const stream = useRef<MediaStream | null>(null);
  const recorder = useRef<MediaRecorder | null>(null);
  const cancelled = useRef(false);
  const started = useRef(0);
  const [ready, setReady] = useState(false);
  const [recording, setRecording] = useState(false);
  const [sending, setSending] = useState(false);
  const [seconds, setSeconds] = useState(0);
  const [error, setError] = useState("");

  useEffect(() => () => {
    cancelled.current = true;
    if (recorder.current?.state === "recording") recorder.current.stop();
    stream.current?.getTracks().forEach(track => track.stop());
  }, []);

  useEffect(() => {
    if (!recording) return;
    const timer = setInterval(() => {
      const elapsed = Math.floor((Date.now() - started.current) / 1000);
      setSeconds(Math.min(60, elapsed));
      if (elapsed >= 60 && recorder.current?.state === "recording") recorder.current.stop();
    }, 200);
    return () => clearInterval(timer);
  }, [recording]);

  async function permissions() {
    try {
      setError("");
      const media = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "user", width: 480, height: 480 }, audio: true });
      stream.current = media;
      if (video.current) { video.current.srcObject = media; await video.current.play(); }
      setReady(true);
    } catch { setError("Перевірте доступ браузера до камери та мікрофона."); }
  }

  function start() {
    if (!stream.current || recording || sending) return;
    try {
      const chunks: Blob[] = [];
      const mimeType = MediaRecorder.isTypeSupported("video/webm;codecs=vp8,opus") ? "video/webm;codecs=vp8,opus" : "video/mp4";
      const instance = new MediaRecorder(stream.current, { mimeType, videoBitsPerSecond: 1_000_000 });
      recorder.current = instance;
      cancelled.current = false;
      instance.ondataavailable = event => { if (event.data.size) chunks.push(event.data); };
      instance.onstop = async () => {
        setRecording(false);
        if (cancelled.current) return;
        const blob = new Blob(chunks, { type: mimeType });
        if (!blob.size) { setError("Запис порожній. Спробуйте ще раз."); return; }
        const url = URL.createObjectURL(blob);
        setSending(true);
        try { await onSendVideo(url, Math.min(60, (Date.now() - started.current) / 1000)); onClose(); }
        catch { setError("Не вдалося надіслати відео. Спробуйте ще раз."); }
        finally { URL.revokeObjectURL(url); setSending(false); }
      };
      started.current = Date.now();
      setSeconds(0);
      instance.start();
      setRecording(true);
    } catch { setError("Цей браузер не підтримує запис відео."); }
  }

  function close() {
    if (sending) return;
    cancelled.current = true;
    if (recorder.current?.state === "recording") recorder.current.stop();
    onClose();
  }

  return (
    <Modal visible transparent animationType="fade" onRequestClose={close}>
      <View style={{ flex: 1, backgroundColor: "#000e", alignItems: "center", justifyContent: "center", gap: 20, padding: 24 }}>
        <Text className="text-white text-xl">Відеоповідомлення</Text>
        <video ref={video} muted autoPlay playsInline style={{ width: 260, height: 260, borderRadius: "50%", objectFit: "cover", border: `3px solid ${recording ? "#ef4444" : COLORS.primary}` }} />
        {!ready ? <TouchableOpacity accessibilityRole="button" onPress={permissions} className="bg-primary p-3 rounded-xl"><Text className="text-white">Надати доступ</Text></TouchableOpacity> : null}
        <Text className="text-white">{sending ? "Надсилання..." : `${seconds} / 60 с`}</Text>
        {error ? <Text className="text-red-400 text-center">{error}</Text> : null}
        <View className="flex-row gap-4">
          <TouchableOpacity accessibilityRole="button" onPress={close} disabled={sending} className="p-3"><Text className="text-white">Скасувати відео</Text></TouchableOpacity>
          <TouchableOpacity accessibilityRole="button" accessibilityLabel={recording ? "Надіслати відео" : "Почати запис відео"} onPress={recording ? () => recorder.current?.stop() : start} disabled={!ready || sending} className="bg-primary p-3 rounded-xl" style={{ opacity: ready && !sending ? 1 : 0.4 }}><Text className="text-white">{recording ? "Надіслати відео" : "Почати запис"}</Text></TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}
