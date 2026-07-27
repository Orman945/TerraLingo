import React, { useCallback, useEffect, useRef, useState } from "react";
import { Alert, Animated, Easing, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import {
  AudioModule,
  RecordingPresets,
  setAudioModeAsync,
  useAudioRecorder,
} from "expo-audio";

import { sendChatAudio, type ChatResponse } from "../services/api";

export type PushToTalkState = "idle" | "recording" | "processing";

interface PushToTalkButtonProps {
  userId?: string;
  npcId?: string;
  onResult?: (result: ChatResponse) => void;
  onError?: (error: unknown) => void;
  disabled?: boolean;
}

const STATE_LABEL: Record<PushToTalkState, string> = {
  idle: "Hold to Talk",
  recording: "Listening...",
  processing: "Thinking...",
};

const STATE_COLOR: Record<PushToTalkState, string> = {
  idle: "#FFD700",
  recording: "#E53935",
  processing: "#9E9E9E",
};

export default function PushToTalkButton({
  userId = "00000000-0000-0000-0000-000000000000",
  npcId = "mickey",
  onResult,
  onError,
  disabled = false,
}: PushToTalkButtonProps) {
  const [state, setState] = useState<PushToTalkState>("idle");
  const recorder = useAudioRecorder(RecordingPresets.HIGH_QUALITY);
  const pulseAnim = useRef(new Animated.Value(0)).current;
  const pulseLoopRef = useRef<Animated.CompositeAnimation | null>(null);

  // Driven imperatively (rather than tied to `state` in the render tree) so
  // the loop is guaranteed to stop/reset exactly once per state transition,
  // instead of racing a re-render that leaves a stray loop running.
  useEffect(() => {
    if (state === "processing") {
      pulseAnim.setValue(0);
      const loop = Animated.loop(
        Animated.timing(pulseAnim, {
          toValue: 1,
          duration: 1200,
          easing: Easing.out(Easing.ease),
          useNativeDriver: true,
        })
      );
      pulseLoopRef.current = loop;
      loop.start();
    } else {
      pulseLoopRef.current?.stop();
      pulseLoopRef.current = null;
      pulseAnim.setValue(0);
    }

    return () => {
      pulseLoopRef.current?.stop();
      pulseLoopRef.current = null;
    };
  }, [state, pulseAnim]);

  const pulseScale = pulseAnim.interpolate({ inputRange: [0, 1], outputRange: [1, 1.6] });
  const pulseOpacity = pulseAnim.interpolate({ inputRange: [0, 1], outputRange: [0.6, 0] });

  // Tracks whether the button is physically held, independent of `state`,
  // so an async permission/prepare step can be aborted if the finger lifts
  // before recording actually starts (otherwise the mic would stay hot).
  const isHeldRef = useRef(false);

  const handlePressIn = useCallback(async () => {
    if (disabled || state !== "idle") return;
    isHeldRef.current = true;

    try {
      const permission = await AudioModule.requestRecordingPermissionsAsync();
      if (!isHeldRef.current) return;

      if (!permission.granted) {
        Alert.alert(
          "Microphone access needed",
          "Enable microphone permissions to talk to Mickey."
        );
        return;
      }

      // Re-claim the recording session every time: Mickey's playback moves
      // the OS audio session into a playback-only category, so this must be
      // re-asserted before each new recording, not just once at mount.
      await setAudioModeAsync({ allowsRecording: true, playsInSilentMode: true });

      // Passing the preset explicitly (rather than calling
      // prepareToRecordAsync() with no arguments) forces expo-audio to
      // rebuild the underlying native recorder and reactivate the audio
      // session on every press. Without it, the same native recorder
      // object is reused across Mickey's playback, which can leave it
      // silently unable to capture audio even though nothing throws.
      await recorder.prepareToRecordAsync(RecordingPresets.HIGH_QUALITY);
      if (!isHeldRef.current) {
        // Finger lifted mid-prepare: on Android, a prepared-but-never-
        // started recorder blocks the next prepare call unless stopped.
        recorder.stop().catch(() => {});
        return;
      }

      recorder.record();
      setState("recording");
    } catch (error) {
      isHeldRef.current = false;
      onError?.(error);
    }
  }, [disabled, onError, recorder, state]);

  const handlePressOut = useCallback(async () => {
    isHeldRef.current = false;
    if (state !== "recording") return;

    setState("processing");
    try {
      await recorder.stop();
      const uri = recorder.uri;
      if (!uri) {
        throw new Error("Recording finished with no audio file.");
      }

      const audioBlob = await (await fetch(uri)).blob();
      const fileName = uri.split("/").pop() || "recording.m4a";
      const result = await sendChatAudio(userId, npcId, audioBlob, fileName);
      onResult?.(result);
    } catch (error) {
      onError?.(error);
    } finally {
      setState("idle");
    }
  }, [npcId, onError, onResult, recorder, state, userId]);

  return (
    <View style={styles.container}>
      {state === "processing" && (
        <Text style={styles.thinkingLabel}>Mickey is thinking...</Text>
      )}
      <View style={styles.buttonWrapper}>
        {state === "processing" && (
          <Animated.View
            pointerEvents="none"
            style={[
              styles.pulseRing,
              {
                opacity: pulseOpacity,
                transform: [{ scale: pulseScale }],
              },
            ]}
          />
        )}
        <TouchableOpacity
          activeOpacity={0.8}
          disabled={disabled || state === "processing"}
          onPressIn={handlePressIn}
          onPressOut={handlePressOut}
          style={[
            styles.button,
            { backgroundColor: disabled ? "#5A5A5A" : STATE_COLOR[state] },
            disabled && styles.buttonDisabled,
          ]}
        >
          <Text style={styles.buttonLabel}>
            {disabled ? "Mickey is talking..." : STATE_LABEL[state]}
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: "center",
  },
  buttonWrapper: {
    width: 120,
    height: 120,
    alignItems: "center",
    justifyContent: "center",
  },
  button: {
    width: 120,
    height: 120,
    borderRadius: 60,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.4,
    shadowRadius: 4,
    elevation: 6,
  },
  buttonDisabled: {
    opacity: 0.5,
  },
  buttonLabel: {
    color: "#1a1a1a",
    fontWeight: "700",
    fontSize: 14,
    textAlign: "center",
    paddingHorizontal: 8,
  },
  pulseRing: {
    position: "absolute",
    width: 120,
    height: 120,
    borderRadius: 60,
    borderWidth: 3,
    borderColor: "#9E9E9E",
  },
  thinkingLabel: {
    color: "#FFFFFF",
    fontSize: 13,
    fontWeight: "600",
    fontStyle: "italic",
    marginBottom: 8,
    textShadowColor: "rgba(0,0,0,0.6)",
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
  },
});
