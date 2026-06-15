import React, { useEffect, useRef, useMemo } from 'react';
import { View, Animated, StyleSheet } from 'react-native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { AuthStackParamList } from '../types';
import { useColors, Colors } from '../context/ThemeContext';
import { typography } from '../theme/typography';
import AppText from '../components/atoms/Text';

type SplashNavProp = NativeStackNavigationProp<AuthStackParamList, 'Splash'>;

interface SplashScreenProps {
  navigation: SplashNavProp;
}

const SplashScreen: React.FC<SplashScreenProps> = ({ navigation }) => {
  const colors = useColors();
  const styles = useMemo(() => createStyles(colors), [colors]);

  const opacity = useRef(new Animated.Value(0)).current;
  const scale = useRef(new Animated.Value(0.85)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(opacity, {
        toValue: 1,
        duration: 700,
        useNativeDriver: true,
      }),
      Animated.spring(scale, {
        toValue: 1,
        friction: 6,
        tension: 80,
        useNativeDriver: true,
      }),
    ]).start();

    const timer = setTimeout(() => {
      navigation.replace('Login');
    }, 2000);

    return () => clearTimeout(timer);
  }, [navigation, opacity, scale]);

  return (
    <View style={styles.container}>
      <Animated.View style={[styles.content, { opacity, transform: [{ scale }] }]}>
        <View style={[styles.logoCircle, { shadowColor: colors.accent }]}>
          <AppText style={styles.logoLetter}>G</AppText>
        </View>
        <AppText variant="h2" style={styles.appName}>
          guised up
        </AppText>
        <AppText variant="caption" style={styles.tagline}>
          real people. real moments.
        </AppText>
      </Animated.View>
    </View>
  );
};

function createStyles(c: Colors) {
  return StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: c.background,
      alignItems: 'center',
      justifyContent: 'center',
    },
    content: {
      alignItems: 'center',
    },
    logoCircle: {
      width: 88,
      height: 88,
      borderRadius: 44,
      backgroundColor: c.accent,
      alignItems: 'center',
      justifyContent: 'center',
      marginBottom: 20,
      shadowOffset: { width: 0, height: 8 },
      shadowOpacity: 0.4,
      shadowRadius: 16,
      elevation: 12,
    },
    logoLetter: {
      fontSize: 40,
      fontWeight: typography.weights.bold,
      color: '#FFFFFF',
      lineHeight: 48,
    },
    appName: {
      color: c.textPrimary,
      fontWeight: typography.weights.bold,
      letterSpacing: 1,
      marginBottom: 6,
    },
    tagline: {
      color: c.textMuted,
      letterSpacing: 0.5,
    },
  });
}

export default SplashScreen;
