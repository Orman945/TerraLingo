import React, { useCallback, useEffect, useRef, useState } from "react";
import { Alert, SafeAreaView, StyleSheet, View } from "react-native";
import { createAudioPlayer, setAudioModeAsync, type AudioPlayer } from "expo-audio";
import Environment360Viewer from "../components/Environment360Viewer";
import NPCAvatar from "../components/NPCAvatar";
import ObjectiveHUD from "../components/ObjectiveHUD";
import PushToTalkButton from "../components/PushToTalkButton";
import TranscriptOverlay, { type TranscriptLine } from "../components/TranscriptOverlay";
import XPProgressBar from "../components/XPProgressBar";
import { fetchUserXp, type ChatResponse } from "../services/api";

/** Phase 1 placeholder level threshold until a real leveling system exists. */
const MAX_XP = 500;

/** No auth/onboarding yet — every session acts as this fixed demo user. */
const DEMO_USER_ID = "00000000-0000-0000-0000-000000000000";

/** Shown until the user's real `current_task` is fetched from the backend. */
const PLACEHOLDER_TASK = "Task: Introduce yourself to Mickey!";

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
  const [currentTask, setCurrentTask] = useState(PLACEHOLDER_TASK);
  const playerRef = useRef<AudioPlayer | null>(null);

  // Fluency stopwatch: stamped when Mickey's TTS finishes, read back when the
  // user starts recording their reply. A ref (not state) because neither side
  // of this needs to trigger a re-render.
  const audioFinishedTimeRef = useRef<number | null>(null);
  // Holds the most recently computed delay so PushToTalkButton can read the
  // latest value at submit time without waiting on a prop update round-trip.
  const fluencyDelaySecondsRef = useRef(0);

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
      console.log("[GameScreen] /api/chat response:", result);

      setTranscriptLines((lines) => [
        ...lines,
        { speaker: "user", text: result.transcript },
        { speaker: "npc", text: result.npc_reply_text },
      ]);
      setCurrentTask(result.next_task_text);
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
          audioFinishedTimeRef.current = Date.now();
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
        audioFinishedTimeRef.current = Date.now();
        releasePlayer();
      }
    },
    [releasePlayer]
  );

  // Fires the instant the mic actually starts recording (after permission +
  // prepare succeed), so the delay reflects real "how long did the user
  // pause" time rather than including async setup overhead.
  const handleRecordingStart = useCallback(() => {
    const finishedAt = audioFinishedTimeRef.current;
    const delaySeconds = finishedAt !== null ? (Date.now() - finishedAt) / 1000 : 0;
    fluencyDelaySecondsRef.current = delaySeconds;
    console.log("[GameScreen] fluencyDelaySeconds:", delaySeconds);
  }, []);

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
            <NPCAvatar name="Mickey" isSpeaking={isNpcSpeaking} />
            <ObjectiveHUD taskText={currentTask} />
          </View>
        </View>

        <View style={styles.bottomArea} pointerEvents="box-none">
          <TranscriptOverlay lines={transcriptLines} isNpcSpeaking={isNpcSpeaking} />
          <View style={styles.controlsRow} pointerEvents="box-none">
            <PushToTalkButton
              userId={DEMO_USER_ID}
              onResult={handleChatResult}
              onError={handleVoiceError}
              onRecordingStart={handleRecordingStart}
              fluencyDelaySecondsRef={fluencyDelaySecondsRef}
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
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    marginTop: 16,
  },
  bottomArea: {
    gap: 16,
  },
  controlsRow: {
    alignItems: "center",
  },
});
