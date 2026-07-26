import { StatusBar } from 'expo-status-bar';
import { StyleSheet } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import GameScreen from './src/screens/GameScreen';

// GestureHandlerRootView must sit at the root for the 360 viewer's pan handler
// to win against any ancestor scroll container.
export default function App() {
  return (
    <GestureHandlerRootView style={styles.root}>
      <GameScreen />
      <StatusBar style="light" />
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
});
