import React, { useEffect, useRef } from "react";
import { Animated, Easing, Image, StyleSheet, Text, View } from "react-native";

interface NPCAvatarProps {
  name?: string;
  /** True while Mickey's reply audio is playing — drives the pulsate + speech bubble. */
  isSpeaking?: boolean;
}

export default function NPCAvatar({ name = "Mickey", isSpeaking = false }: NPCAvatarProps) {
  const pulseAnim = useRef(new Animated.Value(0)).current;
  const pulseLoopRef = useRef<Animated.CompositeAnimation | null>(null);

  useEffect(() => {
    if (isSpeaking) {
      pulseAnim.setValue(0);
      const loop = Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, {
            toValue: 1,
            duration: 450,
            easing: Easing.inOut(Easing.ease),
            useNativeDriver: true,
          }),
          Animated.timing(pulseAnim, {
            toValue: 0,
            duration: 450,
            easing: Easing.inOut(Easing.ease),
            useNativeDriver: true,
          }),
        ])
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
  }, [isSpeaking, pulseAnim]);

  const pulseScale = pulseAnim.interpolate({ inputRange: [0, 1], outputRange: [1, 1.07] });

  return (
    <View style={styles.container}>
      {isSpeaking && (
        <View style={styles.speechBubble}>
          <Text style={styles.speechBubbleText}>•••</Text>
          <View style={styles.speechBubbleTail} />
        </View>
      )}
      <Animated.View
        style={[
          styles.avatarCircle,
          isSpeaking && styles.avatarCircleSpeaking,
          { transform: [{ scale: pulseScale }] },
        ]}
      >
        <Image source={require("../../assets/mickey.png")} style={styles.avatarImage} />
      </Animated.View>
      <Text style={styles.nameLabel}>{name}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: "center",
  },
  avatarCircle: {
    width: 90,
    height: 90,
    borderRadius: 45,
    overflow: "hidden",
    borderWidth: 3,
    borderColor: "#FFD700",
    backgroundColor: "#333",
  },
  avatarCircleSpeaking: {
    borderColor: "#00E676",
  },
  avatarImage: {
    width: "100%",
    height: "100%",
  },
  nameLabel: {
    marginTop: 6,
    color: "#fff",
    fontSize: 13,
    fontWeight: "600",
    textShadowColor: "rgba(0,0,0,0.75)",
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 3,
  },
  speechBubble: {
    position: "absolute",
    top: -26,
    alignSelf: "center",
    backgroundColor: "#fff",
    borderRadius: 10,
    paddingVertical: 3,
    paddingHorizontal: 10,
    zIndex: 1,
  },
  speechBubbleText: {
    fontSize: 12,
    fontWeight: "700",
    color: "#1a1a1a",
    letterSpacing: 1,
  },
  speechBubbleTail: {
    position: "absolute",
    bottom: -5,
    alignSelf: "center",
    width: 0,
    height: 0,
    borderLeftWidth: 5,
    borderRightWidth: 5,
    borderTopWidth: 5,
    borderLeftColor: "transparent",
    borderRightColor: "transparent",
    borderTopColor: "#fff",
  },
});
