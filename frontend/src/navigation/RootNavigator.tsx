import React, { useMemo } from 'react';
import { View, ActivityIndicator, StyleSheet } from 'react-native';
import { useAuth } from '../context/AuthContext';
import { useColors, Colors } from '../context/ThemeContext';
import AuthNavigator from './AuthNavigator';
import TabNavigator from './TabNavigator';

const RootNavigator: React.FC = () => {
  const { isAuthenticated, isLoading } = useAuth();
  const colors = useColors();
  const styles = useMemo(() => createStyles(colors), [colors]);

  if (isLoading) {
    return (
      <View style={styles.loading}>
        <ActivityIndicator size="large" color={colors.accent} />
      </View>
    );
  }

  return isAuthenticated ? <TabNavigator /> : <AuthNavigator />;
};

function createStyles(c: Colors) {
  return StyleSheet.create({
    loading: {
      flex: 1,
      backgroundColor: c.background,
      alignItems: 'center',
      justifyContent: 'center',
    },
  });
}

export default RootNavigator;
