import React from "react";
import { StyleSheet, Text, View } from "react-native";

interface ObjectiveHUDProps {
  /** current_task from user state — the LLM's next_task_text once wired to the API. */
  taskText: string;
}

/** Persistent card showing the player's active objective, as if Mickey were directing them. */
export default function ObjectiveHUD({ taskText }: ObjectiveHUDProps) {
  return (
    <View style={styles.card}>
      <Text style={styles.label}>DIRECTOR'S NOTE</Text>
      <Text style={styles.taskText}>{taskText}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.6)",
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: "#FFD700",
    paddingVertical: 10,
    paddingHorizontal: 14,
  },
  label: {
    color: "#FFD700",
    fontSize: 11,
    fontWeight: "700",
    letterSpacing: 1.2,
    marginBottom: 3,
  },
  taskText: {
    color: "#fff",
    fontSize: 15,
    fontWeight: "600",
  },
});
