import React, { useCallback, useEffect, useRef, useState } from "react";
import { Alert, ImageBackground, SafeAreaView, StyleSheet, View } from "react-native";
import { createAudioPlayer, setAudioModeAsync, type AudioPlayer } from "expo-audio";
import NPCAvatar from "../components/NPCAvatar";
import PushToTalkButton from "../components/PushToTalkButton";
import TranscriptOverlay, { type TranscriptLine } from "../components/TranscriptOverlay";
import type { ChatResponse } from "../services/api";

/**
 * Phase 1 game screen: static 360 panorama placeholder for Hollywood
 * Boulevard. A real 360 viewer (e.g. panorama sphere) will replace this
 * ImageBackground once the asset pipeline is in place.
 */
export default function GameScreen() {
  const [transcriptLines, setTranscriptLines] = useState<TranscriptLine[]>([]);
  const [isNpcSpeaking, setIsNpcSpeaking] = useState(false);
  const playerRef = useRef<AudioPlayer | null>(null);

  // Playback status updates fire from native, so the "just finished" check
  // has to happen inside the listener rather than a setTimeout/duration guess.
  const releasePlayer = useCallback(() => {
    playerRef.current?.remove();
    playerRef.current = null;
  }, []);

  useEffect(() => releasePlayer, [releasePlayer]);

  const handleChatResult = useCallback(
    async (result: ChatResponse) => {
      setTranscriptLines((lines) => [
        ...lines,
        { speaker: "user", text: result.transcript },
        { speaker: "npc", text: result.npc_reply_text },
      ]);

      releasePlayer();

      // The phone's physical silent switch would otherwise mute Mickey.
      await setAudioModeAsync({ playsInSilentMode: true });

      const player = createAudioPlayer(result.npc_audio_url);
      playerRef.current = player;
      setIsNpcSpeaking(true);

      const subscription = player.addListener("playbackStatusUpdate", (status) => {
        if (!status.didJustFinish) return;
        subscription.remove();
        setIsNpcSpeaking(false);
        if (playerRef.current === player) {
          player.remove();
          playerRef.current = null;
        }
      });

      player.play();
    },
    [releasePlayer]
  );

  const handleVoiceError = useCallback((error: unknown) => {
    console.warn("PushToTalkButton error:", error);
    Alert.alert(
      "Couldn't talk to Mickey",
      "Something went wrong recording or sending your voice. Please try again."
    );
  }, []);

  return (
    <ImageBackground
      source={{
        uri: "https://placehold.co/1600x900/4a3a2a/FFD700?text=Hollywood+Boulevard+360+Placeholder",
      }}
      style={styles.background}
      resizeMode="cover"
    >
      <SafeAreaView style={styles.overlay}>
        <View style={styles.topArea}>
          <NPCAvatar name="Mickey" />
        </View>

        <View style={styles.bottomArea}>
          <TranscriptOverlay lines={transcriptLines} isNpcSpeaking={isNpcSpeaking} />
          <View style={styles.controlsRow}>
            <PushToTalkButton
              userId="00000000-0000-0000-0000-000000000000"
              onResult={handleChatResult}
              onError={handleVoiceError}
              disabled={isNpcSpeaking}
            />
          </View>
        </View>
      </SafeAreaView>
    </ImageBackground>
  );
}

const styles = StyleSheet.create({
  background: {
    flex: 1,
    width: "100%",
    height: "100%",
  },
  overlay: {
    flex: 1,
    justifyContent: "space-between",
    padding: 16,
  },
  topArea: {
    alignItems: "center",
    marginTop: 24,
  },
  bottomArea: {
    gap: 16,
  },
  controlsRow: {
    alignItems: "center",
  },
});
