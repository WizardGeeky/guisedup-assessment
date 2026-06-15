import React, { useState, useMemo } from 'react';
import { View, ScrollView, Switch, TouchableOpacity, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';
import { ProfileStackParamList } from '../types';
import { useColors, Colors } from '../context/ThemeContext';
import { useTheme } from '../context/ThemeContext';
import { typography } from '../theme/typography';
import { spacing } from '../theme/spacing';
import { useAuth } from '../context/AuthContext';
import AppText from '../components/atoms/Text';

type SettingsNav = NativeStackNavigationProp<ProfileStackParamList, 'Settings'>;

interface RowProps {
  icon: React.ComponentProps<typeof Ionicons>['name'];
  label: string;
  value?: string;
  hasSwitch?: boolean;
  switchValue?: boolean;
  onSwitchChange?: (v: boolean) => void;
  isDestructive?: boolean;
  onPress?: () => void;
  colors: Colors;
}

const SettingRow: React.FC<RowProps> = ({
  icon, label, value, hasSwitch, switchValue, onSwitchChange, isDestructive, onPress, colors,
}) => {
  const styles = useMemo(() => createRowStyles(colors), [colors]);
  return (
    <TouchableOpacity
      style={styles.row}
      onPress={onPress}
      activeOpacity={onPress ? 0.6 : 1}
      disabled={!onPress && !hasSwitch}
    >
      <View style={[styles.iconWrap, { backgroundColor: isDestructive ? `${colors.error}12` : colors.surface2 }]}>
        <Ionicons name={icon} size={16} color={isDestructive ? colors.error : colors.textSecondary} />
      </View>
      <AppText variant="body" style={[styles.label, isDestructive && { color: colors.error }]}>
        {label}
      </AppText>
      {value !== undefined && (
        <AppText variant="caption" style={styles.value}>{value}</AppText>
      )}
      {hasSwitch && onSwitchChange !== undefined && (
        <Switch
          value={switchValue}
          onValueChange={onSwitchChange}
          trackColor={{ false: colors.border, true: colors.accent }}
          thumbColor="#FFFFFF"
        />
      )}
      {onPress && !hasSwitch && (
        <Ionicons name="chevron-forward" size={16} color={colors.textMuted} />
      )}
    </TouchableOpacity>
  );
};

const SettingsScreen: React.FC = () => {
  const colors = useColors();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const { isDark, toggleTheme } = useTheme();
  const navigation = useNavigation<SettingsNav>();
  const { user, logout } = useAuth();
  const [notificationsOn, setNotificationsOn] = useState(true);

  if (!user) return null;

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn} activeOpacity={0.7}>
          <Ionicons name="arrow-back" size={22} color={colors.textPrimary} />
        </TouchableOpacity>
        <AppText variant="h3" style={styles.title}>settings</AppText>
        <View style={styles.placeholder} />
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>

        {/* Account */}
        <View style={styles.section}>
          <AppText variant="caption" style={styles.sectionTitle}>account</AppText>
          <View style={styles.card}>
            <SettingRow icon="person-outline" label="username" value={`@${user.username}`} colors={colors} />
            <View style={styles.rowDivider} />
            <SettingRow icon="mail-outline" label="email" value={user.email} colors={colors} />
          </View>
        </View>

        {/* Appearance */}
        <View style={styles.section}>
          <AppText variant="caption" style={styles.sectionTitle}>appearance</AppText>
          <View style={styles.card}>
            <View style={styles.themePickerRow}>
              <View style={styles.themeRowLeft}>
                <View style={[styles.iconWrap, { backgroundColor: colors.surface2 }]}>
                  <Ionicons name="color-palette-outline" size={16} color={colors.textSecondary} />
                </View>
                <AppText variant="body" style={styles.themePickerLabel}>theme</AppText>
              </View>
              <View style={styles.themeToggle}>
                <TouchableOpacity
                  style={[styles.themeOption, !isDark && styles.themeOptionActive]}
                  onPress={() => { if (isDark) toggleTheme(); }}
                  activeOpacity={0.7}
                >
                  <Ionicons name="sunny-outline" size={14} color={!isDark ? '#FFFFFF' : colors.textMuted} />
                  <AppText variant="caption" style={[styles.themeOptionText, !isDark && styles.themeOptionTextActive]}>
                    light
                  </AppText>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.themeOption, isDark && styles.themeOptionActive]}
                  onPress={() => { if (!isDark) toggleTheme(); }}
                  activeOpacity={0.7}
                >
                  <Ionicons name="moon-outline" size={14} color={isDark ? '#FFFFFF' : colors.textMuted} />
                  <AppText variant="caption" style={[styles.themeOptionText, isDark && styles.themeOptionTextActive]}>
                    dark
                  </AppText>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </View>

        {/* Preferences */}
        <View style={styles.section}>
          <AppText variant="caption" style={styles.sectionTitle}>preferences</AppText>
          <View style={styles.card}>
            <SettingRow
              icon="notifications-outline"
              label="notifications"
              hasSwitch
              switchValue={notificationsOn}
              onSwitchChange={setNotificationsOn}
              colors={colors}
            />
          </View>
        </View>

        {/* Privacy */}
        <View style={styles.section}>
          <AppText variant="caption" style={styles.sectionTitle}>privacy</AppText>
          <View style={styles.card}>
            <SettingRow icon="lock-closed-outline" label="private account" onPress={() => {}} colors={colors} />
            <View style={styles.rowDivider} />
            <SettingRow icon="people-outline" label="blocked accounts" onPress={() => {}} colors={colors} />
            <View style={styles.rowDivider} />
            <SettingRow icon="shield-outline" label="data & permissions" onPress={() => {}} colors={colors} />
          </View>
        </View>

        {/* Logout */}
        <View style={styles.section}>
          <View style={styles.card}>
            <SettingRow
              icon="log-out-outline"
              label="log out"
              isDestructive
              onPress={() => void logout()}
              colors={colors}
            />
          </View>
        </View>

        <AppText variant="caption" style={styles.version}>guised up v1.0.0</AppText>
      </ScrollView>
    </SafeAreaView>
  );
};

function createRowStyles(c: Colors) {
  return StyleSheet.create({
    row: {
      flexDirection: 'row', alignItems: 'center',
      paddingHorizontal: spacing.lg, paddingVertical: spacing.md + 2,
    },
    iconWrap: {
      width: 30, height: 30, borderRadius: 8,
      alignItems: 'center', justifyContent: 'center', marginRight: spacing.md,
    },
    label: { flex: 1, color: c.textPrimary, fontSize: typography.sizes.md },
    value: { color: c.textMuted, fontSize: typography.sizes.sm },
  });
}

function createStyles(c: Colors) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: c.background },
    header: {
      flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
      paddingHorizontal: spacing.lg, paddingTop: spacing.sm, paddingBottom: spacing.md,
      borderBottomWidth: 1, borderBottomColor: c.border,
    },
    backBtn: {
      width: 38, height: 38, borderRadius: 19, backgroundColor: c.surface2,
      alignItems: 'center', justifyContent: 'center',
    },
    title: { color: c.textPrimary, fontWeight: typography.weights.bold },
    placeholder: { width: 38 },
    scrollContent: { paddingBottom: spacing.xxxxl },
    section: { marginTop: spacing.xl, paddingHorizontal: spacing.lg },
    sectionTitle: {
      color: c.textMuted, fontSize: typography.sizes.xs, fontWeight: typography.weights.semibold,
      textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: spacing.sm,
    },
    card: {
      backgroundColor: c.surface, borderRadius: 14,
      borderWidth: 1, borderColor: c.border, overflow: 'hidden',
    },
    rowDivider: { height: 1, backgroundColor: c.border, marginLeft: spacing.lg + 30 + spacing.md },
    iconWrap: {
      width: 30, height: 30, borderRadius: 8,
      alignItems: 'center', justifyContent: 'center', marginRight: spacing.md,
    },
    // Theme picker inline
    themePickerRow: {
      flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
      paddingHorizontal: spacing.lg, paddingVertical: spacing.md,
    },
    themeRowLeft: { flexDirection: 'row', alignItems: 'center' },
    themePickerLabel: { color: c.textPrimary, fontSize: typography.sizes.md },
    themeToggle: {
      flexDirection: 'row',
      backgroundColor: c.surface2,
      borderRadius: 10,
      padding: 3,
      gap: 2,
    },
    themeOption: {
      flexDirection: 'row', alignItems: 'center', gap: 4,
      paddingHorizontal: spacing.md, paddingVertical: spacing.xs,
      borderRadius: 8,
    },
    themeOptionActive: { backgroundColor: c.accent },
    themeOptionText: { color: c.textMuted, fontSize: typography.sizes.xs },
    themeOptionTextActive: { color: '#FFFFFF', fontWeight: typography.weights.semibold },
    version: { textAlign: 'center', color: c.textMuted, marginTop: spacing.xxxl },
  });
}

export default SettingsScreen;
