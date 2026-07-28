import React, { useCallback, useEffect, useRef, useState } from "react";
import { Alert, SafeAreaView, StyleSheet, View } from "react-native";
import { createAudioPlayer, setAudioModeAsync, type AudioPlayer } from "expo-audio";
import Environment360Viewer from "../components/Environment360Viewer";
import NPCAvatar from "../components/NPCAvatar";
import PushToTalkButton from "../components/PushToTalkButton";
import TranscriptOverlay, { type TranscriptLine } from "../components/TranscriptOverlay";
import XPProgressBar from "../components/XPProgressBar";
import { fetchUserXp, type ChatResponse } from "../services/api";

/** Phase 1 placeholder level threshold until a real leveling system exists. */
const MAX_XP = 500;

/** No auth/onboarding yet — every session acts as this fixed demo user. */
const DEMO_USER_ID = "00000000-0000-0000-0000-000000000000";

/**
 * Stand-in equirectangular panorama until the Hollywood Boulevard tiles are
 * authored. Swap for the real asset (or a `require(...)`) when it lands.
 */
const PLACEHOLDER_PANORAMA = "https://mpyxitycdnblwbhrdmue.supabase.co/storage/v1/object/public/360-environments/Ascheberg_Kirchplatz_Panorama.jpg";

/** Phase 1 game screen: interactive 360 environment with Mickey on top. */
export default function GameScreen() {
  const [transcriptLines, setTranscriptLines] = useState<TranscriptLine[]>([]);
  const [isNpcSpeaking, setIsNpcSpeaking] = useState(false);
  const [xp, setXp] = useState(0);
  const playerRef = useRef<AudioPlayer | null>(null);

  // Playback status updates fire from native, so the "just finished" check
  // has to happen inside the listener rather than a setTimeout/duration guess.
  const releasePlayer = useCallback(() => {
    playerRef.current?.remove();
    playerRef.current = null;
  }, []);

  useEffect(() => releasePlayer, [releasePlayer]);

  // Backend is the source of truth for XP; hydrate the bar with the user's
  // persisted total instead of starting every session back at zero.
  useEffect(() => {
    let cancelled = false;

    fetchUserXp(DEMO_USER_ID)
      .then((total) => {
        if (!cancelled) setXp(total);
      })
      .catch((error) => {
        console.warn("Failed to fetch initial XP:", error);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  const handleChatResult = useCallback(
    async (result: ChatResponse) => {
      setTranscriptLines((lines) => [
        ...lines,
        { speaker: "user", text: result.transcript },
        { speaker: "npc", text: result.npc_reply_text },
      ]);
      // The backend already persisted +50 XP for this turn as a side effect
      // of /api/chat; re-fetch the total rather than guessing the delta
      // client-side, so the bar always reflects the real database value.
      fetchUserXp(DEMO_USER_ID).then(setXp).catch((error) => {
        console.warn("Failed to refresh XP:", error);
      });

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
        <View style={styles.headerArea} pointerEvents="box-none">
          <XPProgressBar currentXP={xp} maxXP={MAX_XP} />
          <View style={styles.topArea} pointerEvents="box-none">
            <NPCAvatar name="Mickey" />
          </View>
        </View>

        <View style={styles.bottomArea} pointerEvents="box-none">
          <TranscriptOverlay lines={transcriptLines} isNpcSpeaking={isNpcSpeaking} />
          <View style={styles.controlsRow} pointerEvents="box-none">
            <PushToTalkButton
              userId={DEMO_USER_ID}
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
  headerArea: {
    width: "100%",
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
