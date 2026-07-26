import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Image,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
  type ImageSourcePropType,
  type StyleProp,
  type ViewStyle,
} from "react-native";
import { WebView, type WebViewMessageEvent } from "react-native-webview";

/**
 * Interactive 360 panorama tile.
 *
 * Rendering happens inside a WebView running Photo Sphere Viewer (three.js).
 * We deliberately avoid `expo-gl` + `@react-three/fiber` here: r3f pins
 * `expo-gl@11` while SDK 57 ships `expo-gl@16`, and that mismatch surfaces as
 * a blank canvas on physical devices. The WebView route is bundled in Expo Go,
 * needs no native linking, and is insulated from React/RN version churn.
 */

/** Pinned so a CDN publishing a breaking release can never break the app. */
const PSV_VERSION = "5.14.3";
const THREE_VERSION = "0.184.0";

/** Panorama load is remote and large; give it room before declaring failure. */
const LOAD_TIMEOUT_MS = 25000;

export type Environment360Source = string | ImageSourcePropType;

interface Environment360ViewerProps {
  /** Remote equirectangular URL, or a local `require(...)` asset. */
  imageUrl: Environment360Source;
  /** Overlay UI drawn above the panorama. Gaps stay draggable. */
  children?: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  /** Starting camera angles in degrees. */
  initialYaw?: number;
  initialPitch?: number;
  onReady?: () => void;
  onError?: (message: string) => void;
}

type ViewerStatus = "loading" | "ready" | "error";

interface ViewerMessage {
  type: "ready" | "error";
  message?: string;
}

/**
 * `require(...)` assets arrive as opaque numbers, remote panoramas as strings.
 * resolveAssetSource normalises both without pulling in another dependency.
 */
function resolveUri(imageUrl: Environment360Source): string | null {
  if (typeof imageUrl === "string") return imageUrl;
  return Image.resolveAssetSource(imageUrl)?.uri ?? null;
}

function buildHtml(panorama: string, initialYaw: number, initialPitch: number): string {
  // Escaping `<` keeps a URL containing "</script>" from closing the tag early.
  const config = JSON.stringify({ panorama, initialYaw, initialPitch }).replace(/</g, "\\u003c");

  return `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no, viewport-fit=cover" />
<link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/@photo-sphere-viewer/core@${PSV_VERSION}/index.css" />
<script type="importmap">
{"imports":{"three":"https://cdn.jsdelivr.net/npm/three@${THREE_VERSION}/build/three.module.js","three/":"https://cdn.jsdelivr.net/npm/three@${THREE_VERSION}/"}}
</script>
<style>
  html, body {
    margin: 0; padding: 0; width: 100%; height: 100%;
    background: #000; overflow: hidden; overscroll-behavior: none;
  }
  #viewport {
    width: 100%; height: 100%;
    touch-action: none;
    user-select: none; -webkit-user-select: none;
    -webkit-touch-callout: none;
    -webkit-tap-highlight-color: transparent;
  }
  .psv-loader-container { display: none; }
</style>
</head>
<body>
<div id="viewport"></div>
<script type="module">
const CONFIG = ${config};

function post(payload) {
  var msg = JSON.stringify(payload);
  if (window.ReactNativeWebView) {
    window.ReactNativeWebView.postMessage(msg);
  } else if (window.parent) {
    // Plain <iframe> host (Expo Web) — react-native-webview has no web
    // implementation, so the web render path uses a real iframe instead.
    window.parent.postMessage(msg, '*');
  }
}

// Cancels rubber-banding and page scroll so a drag reads purely as a look-around.
// preventDefault does not stop propagation, so the viewer still gets every event.
document.addEventListener('touchmove', function (e) { e.preventDefault(); }, { passive: false });
document.addEventListener('gesturestart', function (e) { e.preventDefault(); });

var settled = false;
function fail(message) {
  if (settled) return;
  settled = true;
  post({ type: 'error', message: String(message) });
}

window.addEventListener('error', function (e) { fail(e.message || 'Script error'); });
window.addEventListener('unhandledrejection', function (e) {
  fail((e.reason && e.reason.message) || e.reason || 'Panorama failed to load');
});

(async function () {
  try {
    const { Viewer } = await import(
      'https://cdn.jsdelivr.net/npm/@photo-sphere-viewer/core@${PSV_VERSION}/index.module.js'
    );

    const viewer = new Viewer({
      container: document.getElementById('viewport'),
      panorama: CONFIG.panorama,
      defaultYaw: CONFIG.initialYaw + 'deg',
      defaultPitch: CONFIG.initialPitch + 'deg',
      navbar: false,
      loadingTxt: '',
      keyboard: false,
      // One finger looks around; two-finger drag stays free for the OS.
      touchmoveTwoFingers: false,
      moveInertia: true,
    });

    viewer.addEventListener('ready', function () {
      if (settled) return;
      settled = true;
      post({ type: 'ready' });
    }, { once: true });
  } catch (err) {
    fail((err && err.message) || err);
  }
})();
</script>
</body>
</html>`;
}

export default function Environment360Viewer({
  imageUrl,
  children,
  style,
  initialYaw = 0,
  initialPitch = 0,
  onReady,
  onError,
}: Environment360ViewerProps) {
  const [status, setStatus] = useState<ViewerStatus>("loading");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  // Remounting the WebView/iframe is the only reliable way to re-run the page.
  const [reloadKey, setReloadKey] = useState(0);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const iframeRef = useRef<any>(null);

  const uri = useMemo(() => resolveUri(imageUrl), [imageUrl]);
  const html = useMemo(
    () => (uri ? buildHtml(uri, initialYaw, initialPitch) : null),
    [uri, initialYaw, initialPitch]
  );

  // A mixed-content page silently refuses to load, so the shell's scheme has to
  // track the panorama's: http for Metro-served local assets, https otherwise.
  const baseUrl = uri?.startsWith("http://") ? "http://terralingo.local/" : "https://terralingo.local/";

  const clearTimer = useCallback(() => {
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    timeoutRef.current = null;
  }, []);

  const settle = useCallback(
    (next: ViewerStatus, message?: string) => {
      clearTimer();
      setStatus((current) => (current === "loading" ? next : current));
      if (next === "error") {
        setErrorMessage(message ?? "Unknown error");
        onError?.(message ?? "Unknown error");
      } else {
        onReady?.();
      }
    },
    [clearTimer, onError, onReady]
  );

  const handleLoadStart = useCallback(() => {
    clearTimer();
    timeoutRef.current = setTimeout(
      () => settle("error", "Timed out loading the 360 environment."),
      LOAD_TIMEOUT_MS
    );
  }, [clearTimer, settle]);

  const handleRawMessage = useCallback(
    (data: string) => {
      let payload: ViewerMessage;
      try {
        payload = JSON.parse(data);
      } catch {
        return;
      }
      if (payload.type === "ready") settle("ready");
      else if (payload.type === "error") settle("error", payload.message);
    },
    [settle]
  );

  const handleMessage = useCallback(
    (event: WebViewMessageEvent) => handleRawMessage(event.nativeEvent.data),
    [handleRawMessage]
  );

  const handleRetry = useCallback(() => {
    clearTimer();
    setErrorMessage(null);
    setStatus("loading");
    setReloadKey((key) => key + 1);
  }, [clearTimer]);

  // react-native-webview has no web implementation (it falls back to an
  // "unsupported platform" stub there), so Expo Web renders a plain iframe
  // running the same generated HTML instead. iframes have no onLoadStart
  // equivalent, so the timeout starts as soon as this reload cycle mounts,
  // and messages arrive via window.postMessage rather than a WebView prop.
  useEffect(() => {
    if (Platform.OS !== "web" || !html) return;
    handleLoadStart();

    function handleWindowMessage(event: MessageEvent) {
      if (event.source !== iframeRef.current?.contentWindow) return;
      handleRawMessage(event.data);
    }
    window.addEventListener("message", handleWindowMessage);
    return () => window.removeEventListener("message", handleWindowMessage);
  }, [html, reloadKey, handleLoadStart, handleRawMessage]);

  return (
    <View style={[styles.container, style]}>
      {html ? (
        Platform.OS === "web" ? (
          // JSX can't type-check a raw DOM tag against React Native's
          // JSX.IntrinsicElements, so this one element uses createElement.
          React.createElement("iframe", {
            key: reloadKey,
            ref: iframeRef,
            srcDoc: html,
            // allow-same-origin is required for WebGL: an opaque-origin
            // sandboxed iframe (allow-scripts alone) makes getContext('webgl')
            // throw a DOMException, which PSV swallows internally instead of
            // rethrowing — the viewer just hangs until our own timeout fires.
            // Safe here since this HTML is entirely our own generated markup,
            // not third-party/untrusted content.
            sandbox: "allow-scripts allow-same-origin",
            style: {
              width: "100%",
              height: "100%",
              border: "none",
              display: "block",
              backgroundColor: "#0b0b0f",
            },
          })
        ) : (
          <WebView
            key={reloadKey}
            style={styles.webview}
            containerStyle={styles.webviewContainer}
            source={{ html, baseUrl }}
            originWhitelist={["*"]}
            onLoadStart={handleLoadStart}
            onMessage={handleMessage}
            onError={({ nativeEvent }) => settle("error", nativeEvent.description)}
            // WebGL is unusable on Android without a hardware-backed layer.
            androidLayerType="hardware"
            domStorageEnabled
            cacheEnabled
            scrollEnabled={false}
            bounces={false}
            overScrollMode="never"
            showsHorizontalScrollIndicator={false}
            showsVerticalScrollIndicator={false}
            setBuiltInZoomControls={false}
            allowsInlineMediaPlayback
          />
        )
      ) : (
        <View style={styles.centered}>
          <Text style={styles.errorTitle}>No panorama source</Text>
        </View>
      )}

      {status === "loading" && (
        <View style={[StyleSheet.absoluteFill, styles.centered]} pointerEvents="none">
          <ActivityIndicator size="large" color="#FFD700" />
          <Text style={styles.loadingText}>Loading the boulevard…</Text>
        </View>
      )}

      {status === "error" && (
        <View style={[StyleSheet.absoluteFill, styles.centered]}>
          <Text style={styles.errorTitle}>Couldn't load the 360 view</Text>
          <Text style={styles.errorDetail} numberOfLines={3}>
            {errorMessage}
          </Text>
          <Pressable style={styles.retryButton} onPress={handleRetry}>
            <Text style={styles.retryLabel}>Retry</Text>
          </Pressable>
        </View>
      )}

      {/* box-none keeps the empty regions of the overlay draggable. */}
      <View style={StyleSheet.absoluteFill} pointerEvents="box-none">
        {children}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#0b0b0f",
    overflow: "hidden",
  },
  webview: {
    flex: 1,
    backgroundColor: "#0b0b0f",
  },
  webviewContainer: {
    flex: 1,
  },
  centered: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#0b0b0f",
    padding: 24,
    gap: 12,
  },
  loadingText: {
    color: "#d8d8e0",
    fontSize: 14,
  },
  errorTitle: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "600",
  },
  errorDetail: {
    color: "#9a9aa6",
    fontSize: 13,
    textAlign: "center",
  },
  retryButton: {
    marginTop: 4,
    paddingHorizontal: 24,
    paddingVertical: 10,
    borderRadius: 999,
    backgroundColor: "#FFD700",
  },
  retryLabel: {
    color: "#1a1a1a",
    fontSize: 15,
    fontWeight: "700",
  },
});
