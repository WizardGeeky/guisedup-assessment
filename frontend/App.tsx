import React from 'react';
import { StyleSheet, View, ActivityIndicator, Platform } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { NavigationContainer, DefaultTheme, DarkTheme } from '@react-navigation/native';
import { StatusBar } from 'expo-status-bar';
import { useFonts } from 'expo-font';
import { Ionicons } from '@expo/vector-icons';
import { AuthProvider } from './src/context/AuthContext';
import { ThemeProvider, useTheme } from './src/context/ThemeContext';
import RootNavigator from './src/navigation/RootNavigator';
import { lightColors, darkColors } from './src/theme/colors';

const lightNavTheme = {
  ...DefaultTheme,
  colors: {
    ...DefaultTheme.colors,
    primary: lightColors.accent,
    background: lightColors.background,
    card: lightColors.surface,
    text: lightColors.textPrimary,
    border: lightColors.border,
    notification: lightColors.accent,
  },
};

const darkNavTheme = {
  ...DarkTheme,
  colors: {
    ...DarkTheme.colors,
    primary: darkColors.accent,
    background: darkColors.background,
    card: darkColors.surface,
    text: darkColors.textPrimary,
    border: darkColors.border,
    notification: darkColors.accent,
  },
};

// Inner component so it can read ThemeContext
function AppContent(): React.JSX.Element {
  const { isDark } = useTheme();
  return (
    <NavigationContainer theme={isDark ? darkNavTheme : lightNavTheme}>
      <StatusBar style={isDark ? 'light' : 'dark'} />
      <RootNavigator />
    </NavigationContainer>
  );
}

// On web: renders a phone-sized frame centered on a desktop canvas.
// On native: transparent wrapper (flex: 1, no visual change).
function WebFrame({ children }: { children: React.ReactNode }) {
  if (Platform.OS !== 'web') {
    return <>{children}</>;
  }
  return (
    <View style={styles.webDesktop}>
      <View style={styles.webPhone}>
        {children}
      </View>
    </View>
  );
}

export default function App() {
  const [fontsLoaded] = useFonts({ ...Ionicons.font });

  if (!fontsLoaded) {
    return (
      <View style={[styles.root, styles.loading]}>
        <ActivityIndicator size="small" color={lightColors.accent} />
      </View>
    );
  }

  return (
    <GestureHandlerRootView style={styles.root}>
      <SafeAreaProvider>
        <WebFrame>
          <ThemeProvider>
            <AuthProvider>
              <AppContent />
            </AuthProvider>
          </ThemeProvider>
        </WebFrame>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  loading: {
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: lightColors.background,
  },
  // Web desktop backdrop — warm sand to match the app's light theme
  webDesktop: {
    flex: 1,
    backgroundColor: '#D9D3C7',
    alignItems: 'center',
    justifyContent: 'center',
  },
  // Phone frame — max 430px wide, full available height
  webPhone: {
    flex: 1,
    width: '100%',
    // @ts-ignore — maxWidth is valid on web but not in RN types
    maxWidth: 430,
    overflow: 'hidden',
    backgroundColor: lightColors.background,
    // Subtle drop-shadow so it reads as a device on desktop
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.18,
    shadowRadius: 32,
    elevation: 12,
  },
});
