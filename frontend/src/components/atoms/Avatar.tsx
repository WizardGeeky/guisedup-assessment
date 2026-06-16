import React from 'react';
import { View, Image, StyleSheet } from 'react-native';
import { typography } from '../../theme/typography';
import { getAvatarColor } from '../../types';
import AppText from './Text';

interface AvatarProps {
  username: string;
  size?: number;
  imageUrl?: string | null;
}

const Avatar: React.FC<AvatarProps> = ({ username, size = 40, imageUrl }) => {
  const initial = username.charAt(0).toUpperCase();
  const bgColor = getAvatarColor(username);

  const containerStyle = {
    width: size,
    height: size,
    borderRadius: size / 2,
    backgroundColor: bgColor,
  };

  if (imageUrl) {
    return (
      <Image
        source={{ uri: imageUrl }}
        style={[styles.container, containerStyle]}
      />
    );
  }

  return (
    <View style={[styles.container, containerStyle]}>
      <AppText
        variant="label"
        style={{
          fontSize: size * 0.42,
          fontWeight: typography.weights.bold,
          color: '#FFFFFF',
          lineHeight: size,
          textAlign: 'center',
        }}
      >
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
