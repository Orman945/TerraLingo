import React, { useEffect, useRef } from "react";
import { Animated, Easing, Modal, StyleSheet, Text, TouchableOpacity, View } from "react-native";

interface LevelUpNotificationProps {
  /** The newly unlocked estimated_level (1-10) to display. */
  level: number;
  visible: boolean;
  onContinue: () => void;
}

/** Full-screen celebratory overlay shown when calibration unlocks a new level. */
export default function LevelUpNotification({ level, visible, onContinue }: LevelUpNotificationProps) {
  const backdropOpacity = useRef(new Animated.Value(0)).current;
  const cardScale = useRef(new Animated.Value(0.7)).current;
  const badgePulse = useRef(new Animated.Value(0)).current;
  const pulseLoopRef = useRef<Animated.CompositeAnimation | null>(null);

  useEffect(() => {
    if (visible) {
      Animated.parallel([
        Animated.timing(backdropOpacity, {
          toValue: 1,
          duration: 200,
          useNativeDriver: true,
        }),
        Animated.spring(cardScale, {
          toValue: 1,
          friction: 6,
          tension: 60,
          useNativeDriver: true,
        }),
      ]).start();

      const loop = Animated.loop(
        Animated.sequence([
          Animated.timing(badgePulse, {
            toValue: 1,
            duration: 700,
            easing: Easing.inOut(Easing.ease),
            useNativeDriver: true,
          }),
          Animated.timing(badgePulse, {
            toValue: 0,
            duration: 700,
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
      backdropOpacity.setValue(0);
      cardScale.setValue(0.7);
      badgePulse.setValue(0);
    }

    return () => {
      pulseLoopRef.current?.stop();
      pulseLoopRef.current = null;
    };
  }, [visible, backdropOpacity, cardScale, badgePulse]);

  const badgeScale = badgePulse.interpolate({ inputRange: [0, 1], outputRange: [1, 1.08] });

  return (
    <Modal visible={visible} transparent animationType="none" onRequestClose={onContinue}>
      <Animated.View style={[styles.backdrop, { opacity: backdropOpacity }]}>
        <Animated.View style={[styles.card, { transform: [{ scale: cardScale }] }]}>
          <Text style={styles.eyebrow}>EVALUATION COMPLETE!</Text>

          <Animated.View style={[styles.badge, { transform: [{ scale: badgeScale }] }]}>
            <Text style={styles.badgeLevel}>{level}</Text>
          </Animated.View>

          <Text style={styles.title}>You're playing at{"\n"}Level {level}!</Text>

          <TouchableOpacity activeOpacity={0.8} style={styles.continueButton} onPress={onContinue}>
            <Text style={styles.continueLabel}>Continue</Text>
          </TouchableOpacity>
        </Animated.View>
      </Animated.View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.8)",
    alignItems: "center",
    justifyContent: "center",
    padding: 24,
  },
  card: {
    width: "100%",
    maxWidth: 340,
    backgroundColor: "#1a1a1a",
    borderRadius: 20,
    borderWidth: 2.5,
    borderColor: "#FFD700",
    paddingVertical: 28,
    paddingHorizontal: 24,
    alignItems: "center",
    shadowColor: "#FFD700",
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.5,
    shadowRadius: 16,
    elevation: 12,
  },
  eyebrow: {
    color: "#FFD700",
    fontSize: 13,
    fontWeight: "700",
    letterSpacing: 1.5,
    marginBottom: 18,
  },
  badge: {
    width: 84,
    height: 84,
    borderRadius: 42,
    backgroundColor: "#00E676",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 3,
    borderColor: "#fff",
    marginBottom: 18,
    shadowColor: "#00E676",
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.9,
    shadowRadius: 12,
  },
  badgeLevel: {
    color: "#1a1a1a",
    fontSize: 36,
    fontWeight: "800",
  },
  title: {
    color: "#fff",
    fontSize: 20,
    fontWeight: "700",
    textAlign: "center",
    lineHeight: 26,
    marginBottom: 24,
  },
  continueButton: {
    width: "100%",
    backgroundColor: "#FFD700",
    borderRadius: 999,
    paddingVertical: 14,
    alignItems: "center",
  },
  continueLabel: {
    color: "#1a1a1a",
    fontSize: 16,
    fontWeight: "700",
  },
});
