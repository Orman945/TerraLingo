import React from "react";
import { ScrollView, StyleSheet, Text, View } from "react-native";

export interface TranscriptLine {
  speaker: "user" | "npc";
  text: string;
}

interface TranscriptOverlayProps {
  lines?: TranscriptLine[];
  isNpcSpeaking?: boolean;
}

const PLACEHOLDER_LINES: TranscriptLine[] = [
  { speaker: "npc", text: "Hey kid, you got the look! What's your name?" },
  { speaker: "user", text: "My name is... uh, Alex." },
];

export default function TranscriptOverlay({
  lines = PLACEHOLDER_LINES,
  isNpcSpeaking = false,
}: TranscriptOverlayProps) {
  return (
    <View style={styles.container}>
      {isNpcSpeaking && (
        <View style={styles.speakingRow}>
          <Text style={styles.speakingIcon}>🔊</Text>
          <Text style={styles.speakingText}>Mickey is speaking...</Text>
        </View>
      )}
      <ScrollView contentContainerStyle={styles.scrollContent}>
        {lines.map((line, index) => (
          <View
            key={index}
            style={[
              styles.bubble,
              line.speaker === "npc" ? styles.npcBubble : styles.userBubble,
            ]}
          >
            <Text style={styles.bubbleText}>{line.text}</Text>
          </View>
        ))}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    maxHeight: 160,
    width: "100%",
    backgroundColor: "rgba(0,0,0,0.55)",
    borderRadius: 12,
    padding: 10,
  },
  scrollContent: {
    gap: 6,
  },
  speakingRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginBottom: 6,
  },
  speakingIcon: {
    fontSize: 14,
  },
  speakingText: {
    fontSize: 12,
    fontStyle: "italic",
    color: "#FFD700",
  },
  bubble: {
    maxWidth: "85%",
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 10,
    marginBottom: 6,
  },
  npcBubble: {
    alignSelf: "flex-start",
    backgroundColor: "#FFD700",
  },
  userBubble: {
    alignSelf: "flex-end",
    backgroundColor: "#4A90D9",
  },
  bubbleText: {
    fontSize: 13,
    color: "#1a1a1a",
  },
});
