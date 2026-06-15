import React from 'react';
import { View, StyleSheet } from 'react-native';
import { typography } from '../../theme/typography';
import { getAvatarColor } from '../../types';
import AppText from './Text';

interface AvatarProps {
  username: string;
  size?: number;
}

const Avatar: React.FC<AvatarProps> = ({ username, size = 40 }) => {
  const initial = username.charAt(0).toUpperCase();
  const bgColor = getAvatarColor(username);

  const containerStyle = {
    width: size,
    height: size,
    borderRadius: size / 2,
    backgroundColor: bgColor,
  };

  const textStyle = {
    fontSize: size * 0.42,
    fontWeight: typography.weights.bold,
    color: '#FFFFFF',
    lineHeight: size,
    textAlign: 'center' as const,
  };

  return (
    <View style={[styles.container, containerStyle]}>
      <AppText variant="label" style={textStyle}>
        {initial}
      </AppText>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
});

export default Avatar;
