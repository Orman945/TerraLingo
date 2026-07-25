import React from "react";
import { Image, StyleSheet, Text, View } from "react-native";

interface NPCAvatarProps {
  name?: string;
}

export default function NPCAvatar({ name = "Mickey" }: NPCAvatarProps) {
  return (
    <View style={styles.container}>
      <View style={styles.avatarCircle}>
        <Image
          source={{ uri: "https://placehold.co/200x200/png?text=NPC" }}
          style={styles.avatarImage}
        />
      </View>
      <Text style={styles.nameLabel}>{name}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: "center",
  },
  avatarCircle: {
    width: 140,
    height: 140,
    borderRadius: 70,
    overflow: "hidden",
    borderWidth: 3,
    borderColor: "#FFD700",
    backgroundColor: "#333",
  },
  avatarImage: {
    width: "100%",
    height: "100%",
  },
  nameLabel: {
    marginTop: 8,
    color: "#fff",
    fontSize: 16,
    fontWeight: "600",
    textShadowColor: "rgba(0,0,0,0.75)",
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 3,
  },
});
