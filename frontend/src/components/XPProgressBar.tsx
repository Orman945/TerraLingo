import React, { useEffect, useRef } from "react";
import { Animated, StyleSheet, Text, View } from "react-native";

interface XPProgressBarProps {
  currentXP: number;
  maxXP: number;
}

/** Pill-shaped, animated XP meter. Fills via spring physics for a "juicy" gamified feel. */
export default function XPProgressBar({ currentXP, maxXP }: XPProgressBarProps) {
  const safeMaxXP = Math.max(maxXP, 1);
  const percentage = Math.min(100, Math.max(0, (currentXP / safeMaxXP) * 100));

  const animatedPercent = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    // useNativeDriver: false because width can't run on the native (UI) thread.
    Animated.spring(animatedPercent, {
      toValue: percentage,
      friction: 8,
      tension: 40,
      useNativeDriver: false,
    }).start();
  }, [percentage, animatedPercent]);

  const fillWidth = animatedPercent.interpolate({
    inputRange: [0, 100],
    outputRange: ["0%", "100%"],
    extrapolate: "clamp",
  });

  return (
    <View style={styles.container}>
      <View style={styles.track}>
        <Animated.View style={[styles.fill, { width: fillWidth }]}>
          <View style={styles.sheen} />
        </Animated.View>
        <View style={[StyleSheet.absoluteFill, styles.labelWrap]} pointerEvents="none">
          <Text style={styles.label}>
            {Math.round(currentXP)} / {Math.round(maxXP)} XP
          </Text>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    width: "100%",
  },
  track: {
    height: 30,
    borderRadius: 999,
    backgroundColor: "rgba(0,0,0,0.4)",
    borderWidth: 1.5,
    borderColor: "rgba(255,255,255,0.3)",
    overflow: "hidden",
    justifyContent: "center",
  },
  fill: {
    position: "absolute",
    left: 0,
    top: 0,
    bottom: 0,
    backgroundColor: "#00E676",
    borderRadius: 999,
    shadowColor: "#00E676",
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.8,
    shadowRadius: 6,
  },
  sheen: {
    position: "absolute",
    top: 2,
    left: 4,
    right: 4,
    height: 6,
    borderRadius: 999,
    backgroundColor: "rgba(255,255,255,0.35)",
  },
  labelWrap: {
    alignItems: "center",
    justifyContent: "center",
  },
  label: {
    color: "#fff",
    fontSize: 12,
    fontWeight: "700",
    letterSpacing: 0.5,
    textShadowColor: "rgba(0,0,0,0.65)",
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
  },
});
