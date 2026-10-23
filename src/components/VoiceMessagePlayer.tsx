import { useState } from "react";
import { Text, TouchableOpacity, View } from "react-native";
import { setAudioModeAsync, useAudioPlayer, useAudioPlayerStatus } from "expo-audio";
import Ionicons from "@expo/vector-icons/Ionicons";
import { COLORS } from "@/constants/theme";

export function VoiceMessagePlayer({ url, duration }: { url: string; duration: number }) {
  const player = useAudioPlayer(url);
  const status = useAudioPlayerStatus(player);
  const [error, setError] = useState(false);
  const progress = Math.min(status.currentTime / (status.duration || duration || 1), 1);

  async function toggle() {
    try {
      setError(false);
      await setAudioModeAsync({ allowsRecording: false, playsInSilentMode: true });
      if (status.playing) player.pause();
      else {
        if (status.didJustFinish || status.currentTime >= (status.duration || duration) - 0.1)
          await player.seekTo(0);
        player.play();
      }
    } catch { setError(true); }
  }

  return (
    <View style={{ width: 205, maxWidth: "100%", gap: 8 }}>
      <View className="flex-row items-center gap-3">
        <TouchableOpacity accessibilityRole="button" accessibilityLabel={status.playing ? "Призупинити аудіо" : "Відтворити аудіо"} onPress={toggle} className="p-2">
          <Ionicons name={status.playing ? "pause" : "play"} size={27} color="white" />
        </TouchableOpacity>
        <View style={{ flex: 1, gap: 8 }}>
          <Text className="text-white text-sm">Голосове повідомлення</Text>
          <View style={{ height: 4, backgroundColor: COLORS.grey, borderRadius: 2 }}>
            <View style={{ height: 4, width: `${progress * 100}%`, backgroundColor: "white", borderRadius: 2 }} />
          </View>
          <Text className="text-white/80 text-xs">{Math.floor(status.currentTime)} / {Math.ceil(duration)} с</Text>
        </View>
      </View>
      {error ? <Text className="text-red-300 text-xs">Не вдалося відтворити аудіо.</Text> : null}
    </View>
  );
}
