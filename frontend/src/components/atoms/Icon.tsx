import React from 'react';
import { Text, StyleSheet } from 'react-native';

interface IconProps {
  emoji: string;
  size?: number;
}

const Icon: React.FC<IconProps> = ({ emoji, size = 20 }) => {
  return (
    <Text style={[styles.base, { fontSize: size, lineHeight: size * 1.4 }]}>
      {emoji}
    </Text>
  );
};

const styles = StyleSheet.create({
  base: {
    textAlign: 'center',
  },
});

export default Icon;
