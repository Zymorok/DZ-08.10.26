import { useEvent } from "expo";
import { useEffect } from "react";
import { Text, TouchableOpacity, View } from "react-native";
import { useVideoPlayer, VideoPlayer, VideoView } from "expo-video";
import Svg, { Circle } from "react-native-svg";
import Ionicons from "@expo/vector-icons/Ionicons";
import { COLORS } from "@/constants/theme";

function setVideoMuted(player: VideoPlayer, muted: boolean) {
  player.muted = muted;
}

export function VideoNotePlayer({ url, duration, active }: { url: string; duration: number; active: boolean }) {
  "use no memo";
  const player = useVideoPlayer(url, video => {
    video.loop = true;
    video.muted = true;
    video.timeUpdateEventInterval = 0.2;
  });
  const { muted } = useEvent(player, "mutedChange", { muted: true });
  const time = useEvent(player, "timeUpdate");
  const currentTime = time?.currentTime ?? 0;
  const { status } = useEvent(player, "statusChange", { status: player.status });
  const circumference = 2 * Math.PI * 98;
  const progress = Math.min(currentTime / (player.duration || duration || 1), 1);

  useEffect(() => {
    if (active) player.play();
    else { player.pause(); setVideoMuted(player, true); }
  }, [active, player]);

  function toggleSound() {
    const next = !player.muted;
    setVideoMuted(player, next);
    player.play();
  }

  return (
    <View style={{ width: 206, maxWidth: "100%", gap: 4 }}>
      <TouchableOpacity accessibilityRole="button" accessibilityLabel={muted ? "Увімкнути звук відео" : "Вимкнути звук відео"} onPress={toggleSound} style={{ width: 206, height: 206 }}>
        <View style={{ width: 196, height: 196, margin: 5, borderRadius: 98, overflow: "hidden", backgroundColor: COLORS.surfaceLight }}>
          <VideoView pointerEvents="none" player={player} style={{ width: 196, height: 196 }} nativeControls={false} contentFit="cover" surfaceType="textureView" />
        </View>
        <Svg width={206} height={206} pointerEvents="none" style={{ position: "absolute" }}>
          <Circle cx={103} cy={103} r={98} stroke={COLORS.grey} strokeWidth={3} fill="none" />
          <Circle cx={103} cy={103} r={98} stroke="white" strokeWidth={3} fill="none" strokeDasharray={circumference} strokeDashoffset={circumference * (1 - progress)} rotation={-90} origin="103, 103" />
        </Svg>
        <View pointerEvents="none" style={{ position: "absolute", right: 12, bottom: 12, padding: 5, borderRadius: 20, backgroundColor: "#0009" }}>
          <Ionicons name={muted ? "volume-mute" : "volume-high"} size={17} color="white" />
        </View>
      </TouchableOpacity>
      <Text className="text-white/80 text-xs text-center">{status === "error" ? "Не вдалося відтворити відео" : `${Math.floor(currentTime)} / ${Math.ceil(duration)} с`}</Text>
    </View>
  );
}
