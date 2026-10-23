import { useEffect, useRef, useState } from "react";
import { Text, TouchableOpacity, View } from "react-native";
import Svg, { Circle } from "react-native-svg";
import Ionicons from "@expo/vector-icons/Ionicons";
import { COLORS } from "@/constants/theme";

export function VideoNotePlayer({ url, duration, active }: { url: string; duration: number; active: boolean }) {
  const video = useRef<HTMLVideoElement>(null);
  const [currentTime, setCurrentTime] = useState(0);
  const [muted, setMuted] = useState(true);
  const [error, setError] = useState(false);
  const circumference = 2 * Math.PI * 98;
  const progress = Math.min(currentTime / (duration || 1), 1);

  useEffect(() => {
    const element = video.current;
    if (!element) return;
    if (active) {
      element.play().catch(reason => {
        if (element.isConnected && reason.name !== "AbortError") setError(true);
      });
    } else {
      element.pause();
      element.muted = true;
    }
    return () => element.pause();
  }, [active, url]);

  function toggleSound() {
    const element = video.current;
    if (!element) return;
    setError(false);
    element.muted = !element.muted;
    element.play().catch(() => { if (element.isConnected) setError(true); });
  }

  return (
    <View style={{ width: 206, maxWidth: "100%", gap: 4 }}>
      <TouchableOpacity accessibilityRole="button" accessibilityLabel={muted ? "Увімкнути звук відео" : "Вимкнути звук відео"} onPress={toggleSound} style={{ width: 206, height: 206 }}>
        <video ref={video} src={url} loop muted={muted} playsInline onTimeUpdate={event => setCurrentTime(event.currentTarget.currentTime)} onVolumeChange={event => setMuted(event.currentTarget.muted)} onError={() => setError(true)} style={{ width: 196, height: 196, margin: 5, borderRadius: "50%", objectFit: "cover", pointerEvents: "none", backgroundColor: COLORS.surfaceLight }} />
        <Svg width={206} height={206} pointerEvents="none" style={{ position: "absolute" }}>
          <Circle cx={103} cy={103} r={98} stroke={COLORS.grey} strokeWidth={3} fill="none" />
          <Circle cx={103} cy={103} r={98} stroke="white" strokeWidth={3} fill="none" strokeDasharray={circumference} strokeDashoffset={circumference * (1 - progress)} rotation={-90} origin="103, 103" />
        </Svg>
        <View pointerEvents="none" style={{ position: "absolute", right: 12, bottom: 12, padding: 5, borderRadius: 20, backgroundColor: "#0009" }}>
          <Ionicons name={muted ? "volume-mute" : "volume-high"} size={17} color="white" />
        </View>
      </TouchableOpacity>
      <Text className="text-white/80 text-xs text-center">{error ? "Не вдалося відтворити відео" : `${Math.floor(currentTime)} / ${Math.ceil(duration)} с`}</Text>
    </View>
  );
}
