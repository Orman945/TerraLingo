import React, { useEffect, useRef } from "react";
import { Animated, StyleSheet, Text, View } from "react-native";
import Svg, { Circle } from "react-native-svg";

interface XPProgressBarProps {
  currentXP: number;
  maxXP: number;
  level: number;
}

const AnimatedCircle = Animated.createAnimatedComponent(Circle);

// Level badge geometry — the halo ring rides just inside the badge's outer
// edge so its stroke never gets clipped by the circular background behind it.
const BADGE_SIZE = 64;
const RING_STROKE_WIDTH = 5;
const RING_RADIUS = (BADGE_SIZE - RING_STROKE_WIDTH) / 2;
const RING_CIRCUMFERENCE = 2 * Math.PI * RING_RADIUS;

/**
 * Pill-shaped, animated XP meter with a centered level badge. The badge's
 * ring doubles as a radial progress halo — it fills via the same 0-100
 * percentage driving the horizontal bar, so both stay perfectly in sync.
 */
export default function XPProgressBar({ currentXP, maxXP, level }: XPProgressBarProps) {
  const safeMaxXP = Math.max(maxXP, 1);
  const percentage = Math.min(100, Math.max(0, (currentXP / safeMaxXP) * 100));

  const animatedPercent = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    // useNativeDriver: false because width/strokeDashoffset can't run on the
    // native (UI) thread.
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

  const haloDashoffset = animatedPercent.interpolate({
    inputRange: [0, 100],
    outputRange: [RING_CIRCUMFERENCE, 0],
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

      <View style={styles.badgeWrap} pointerEvents="none">
        <Svg width={BADGE_SIZE} height={BADGE_SIZE} style={styles.badgeRing}>
          <Circle
            cx={BADGE_SIZE / 2}
            cy={BADGE_SIZE / 2}
            r={RING_RADIUS}
            stroke="rgba(255,215,0,0.22)"
            strokeWidth={RING_STROKE_WIDTH}
            fill="none"
          />
          <AnimatedCircle
            cx={BADGE_SIZE / 2}
            cy={BADGE_SIZE / 2}
            r={RING_RADIUS}
            stroke="#FFD54A"
            strokeWidth={RING_STROKE_WIDTH}
            strokeLinecap="round"
            fill="none"
            strokeDasharray={`${RING_CIRCUMFERENCE}, ${RING_CIRCUMFERENCE}`}
            strokeDashoffset={haloDashoffset}
          />
        </Svg>
        <View style={styles.badgeCore}>
          <Text style={styles.badgeLevel}>{Math.round(level)}</Text>
          <Text style={styles.badgeCaption}>LVL</Text>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    width: "100%",
    paddingTop: (BADGE_SIZE - 30) / 2,
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
    alignItems: "flex-end",
    justifyContent: "center",
    paddingRight: 14,
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
  badgeWrap: {
    position: "absolute",
    top: 0,
    left: "50%",
    marginLeft: -BADGE_SIZE / 2,
    width: BADGE_SIZE,
    height: BADGE_SIZE,
    alignItems: "center",
    justifyContent: "center",
    // Drop shadow so the badge pops off the bar behind it.
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.5,
    shadowRadius: 5,
    elevation: 8,
  },
  badgeRing: {
    position: "absolute",
    // Rotates the ring's start point from 3 o'clock to 12 o'clock so the
    // halo fills clockwise starting from the top, matching the strokeDashoffset math.
    transform: [{ rotate: "-90deg" }],
  },
  badgeCore: {
    width: BADGE_SIZE - RING_STROKE_WIDTH * 2 - 4,
    height: BADGE_SIZE - RING_STROKE_WIDTH * 2 - 4,
    borderRadius: 999,
    backgroundColor: "#2B1055",
    borderWidth: 1,
    borderColor: "rgba(255,215,84,0.5)",
    alignItems: "center",
    justifyContent: "center",
  },
  badgeLevel: {
    color: "#FFD54A",
    fontSize: 20,
    fontWeight: "800",
    lineHeight: 22,
    textShadowColor: "rgba(0,0,0,0.6)",
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
  },
  badgeCaption: {
    color: "rgba(255,255,255,0.75)",
    fontSize: 8,
    fontWeight: "700",
    letterSpacing: 1,
    marginTop: -2,
  },
});
