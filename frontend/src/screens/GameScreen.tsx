import React, { useCallback, useEffect, useRef, useState } from "react";
import { Alert, SafeAreaView, StyleSheet, View } from "react-native";
import { createAudioPlayer, setAudioModeAsync, type AudioPlayer } from "expo-audio";
import Environment360Viewer from "../components/Environment360Viewer";
import NPCAvatar from "../components/NPCAvatar";
import PushToTalkButton from "../components/PushToTalkButton";
import TranscriptOverlay, { type TranscriptLine } from "../components/TranscriptOverlay";
import type { ChatResponse } from "../services/api";

/**
 * Stand-in equirectangular panorama until the Hollywood Boulevard tiles are
 * authored. Swap for the real asset (or a `require(...)`) when it lands.
 */
const PLACEHOLDER_PANORAMA = "https://mpyxitycdnblwbhrdmue.supabase.co/storage/v1/object/public/360-environments/Ascheberg_Kirchplatz_Panorama.jpg";

/** Phase 1 game screen: interactive 360 environment with Mickey on top. */
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

      try {
        // The phone's physical silent switch would otherwise mute Mickey.
        await setAudioModeAsync({ playsInSilentMode: true });

        const player = createAudioPlayer(result.npc_audio_url);
        playerRef.current = player;
        setIsNpcSpeaking(true);

        const stopSpeaking = () => {
          subscription.remove();
          setIsNpcSpeaking(false);
          if (playerRef.current === player) {
            player.remove();
            playerRef.current = null;
          }
        };

        const subscription = player.addListener("playbackStatusUpdate", (status) => {
          if (status.error) {
            console.warn("Mickey's voice failed to play:", status.error);
            stopSpeaking();
            return;
          }
          if (!status.didJustFinish) return;
          stopSpeaking();
        });

        player.play();
      } catch (error) {
        console.warn("Mickey's voice failed to play:", error);
        setIsNpcSpeaking(false);
        releasePlayer();
      }
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
    <Environment360Viewer imageUrl={PLACEHOLDER_PANORAMA} style={styles.background}>
      {/* box-none so drags between the HUD elements still pan the panorama. */}
      <SafeAreaView style={styles.overlay} pointerEvents="box-none">
        <View style={styles.topArea} pointerEvents="box-none">
          <NPCAvatar name="Mickey" />
        </View>

        <View style={styles.bottomArea} pointerEvents="box-none">
          <TranscriptOverlay lines={transcriptLines} isNpcSpeaking={isNpcSpeaking} />
          <View style={styles.controlsRow} pointerEvents="box-none">
            <PushToTalkButton
              userId="00000000-0000-0000-0000-000000000000"
              onResult={handleChatResult}
              onError={handleVoiceError}
              disabled={isNpcSpeaking}
            />
          </View>
        </View>
      </SafeAreaView>
    </Environment360Viewer>
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
