import React, { useMemo } from 'react';
import { View, TextInput, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useColors, Colors } from '../../context/ThemeContext';
import { webInputReset } from '../../utils/webStyle';
import { typography } from '../../theme/typography';
import { spacing } from '../../theme/spacing';

interface SearchBarProps {
  value: string;
  onChangeText: (text: string) => void;
  onClear: () => void;
  placeholder?: string;
}

const SearchBar: React.FC<SearchBarProps> = ({
  value,
  onChangeText,
  onClear,
  placeholder = 'search',
}) => {
  const colors = useColors();
  const styles = useMemo(() => createStyles(colors), [colors]);

  return (
    <View style={styles.container}>
      <Ionicons name="search-outline" size={17} color={colors.textMuted} style={styles.searchIcon} />
      <TextInput
        style={[styles.input, webInputReset]}
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={colors.textMuted}
        autoCorrect={false}
        autoCapitalize="none"
        returnKeyType="search"
      />
      {value.length > 0 && (
        <TouchableOpacity onPress={onClear} activeOpacity={0.7} style={styles.clearBtn}>
          <Ionicons name="close-circle" size={18} color={colors.textMuted} />
        </TouchableOpacity>
      )}
    </View>
  );
};

function createStyles(c: Colors) {
  return StyleSheet.create({
    container: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: c.surface,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: c.border,
      paddingHorizontal: spacing.md,
      height: 44,
    },
    searchIcon: { marginRight: spacing.sm },
    input: {
      flex: 1,
      color: c.textPrimary,
      fontSize: typography.sizes.md,
      paddingVertical: 0,
      outlineWidth: 0,
    } as any,
    clearBtn: { padding: spacing.xs, marginLeft: spacing.xs },
  });
}

export default SearchBar;
