import React, { useMemo } from 'react';
import { View, TouchableOpacity, StyleSheet, Platform } from 'react-native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import type { BottomTabBarProps } from '@react-navigation/bottom-tabs';
import { Ionicons } from '@expo/vector-icons';
import { TabParamList } from '../types';
import { useColors, Colors } from '../context/ThemeContext';
import { typography } from '../theme/typography';
import AppText from '../components/atoms/Text';
import FeedScreen from '../screens/FeedScreen';
import SearchScreen from '../screens/SearchScreen';
import CreatePostScreen from '../screens/CreatePostScreen';
import NotificationsScreen from '../screens/NotificationsScreen';
import ProfileStackNavigator from './ProfileStackNavigator';
import MyPostsScreen from '../screens/MyPostsScreen';

const Tab = createBottomTabNavigator<TabParamList>();

// Tabs to render in the bar (Notifications is hidden — accessed via bell icon)
const VISIBLE_TABS: Array<{
  name: keyof TabParamList;
  label: string;
  icon: string;
  iconFocused: string;
}> = [
  { name: 'Feed',    label: 'home',   icon: 'home-outline',          iconFocused: 'home' },
  { name: 'Search',  label: 'search', icon: 'search-outline',        iconFocused: 'search' },
  { name: 'Create',  label: '',       icon: '',                      iconFocused: '' },  // center + button
  { name: 'MyPosts', label: 'posts',  icon: 'document-text-outline', iconFocused: 'document-text' },
  { name: 'Profile', label: 'me',     icon: 'person-outline',        iconFocused: 'person' },
];

const CustomTabBar: React.FC<BottomTabBarProps> = ({ state, navigation }) => {
  const colors = useColors();
  const styles = useMemo(() => createBarStyles(colors), [colors]);

  return (
    <View style={styles.bar}>
      {VISIBLE_TABS.map((tab) => {
        const routeIndex = state.routes.findIndex((r) => r.name === tab.name);
        const isFocused = state.index === routeIndex;

        const onPress = () => {
          if (routeIndex === -1) return;
          const event = navigation.emit({
            type: 'tabPress',
            target: state.routes[routeIndex]?.key ?? '',
            canPreventDefault: true,
          });
          if (!isFocused && !event.defaultPrevented) {
            navigation.navigate(tab.name);
          }
        };

        // ── Center create button ──
        if (tab.name === 'Create') {
          return (
            <View key="Create" style={styles.createSlot}>
              <TouchableOpacity
                onPress={onPress}
                activeOpacity={0.85}
                style={styles.createOuter}
              >
                <View style={[styles.createInner, { backgroundColor: colors.accent, shadowColor: colors.accent }]}>
                  <Ionicons name="add" size={28} color="#FFF" />
                </View>
              </TouchableOpacity>
            </View>
          );
        }

        // ── Regular tab item ──
        const iconName = (isFocused ? tab.iconFocused : tab.icon) as any;
        return (
          <TouchableOpacity
            key={tab.name}
            style={styles.tabItem}
            onPress={onPress}
            activeOpacity={0.7}
          >
            <View style={styles.tabInner}>
              {isFocused && <View style={[styles.activePill, { backgroundColor: `${colors.accent}18` }]} />}
              <Ionicons
                name={iconName}
                size={22}
                color={isFocused ? colors.accent : colors.textMuted}
              />
              <AppText
                style={[
                  styles.tabLabel,
                  { color: isFocused ? colors.accent : colors.textMuted },
                  isFocused && styles.tabLabelActive,
                ]}
              >
                {tab.label}
              </AppText>
            </View>
          </TouchableOpacity>
        );
      })}
    </View>
  );
};

const TabNavigator: React.FC = () => {
  return (
    <Tab.Navigator
      tabBar={(props) => <CustomTabBar {...props} />}
      screenOptions={{ headerShown: false }}
    >
      <Tab.Screen name="Feed"          component={FeedScreen} />
      <Tab.Screen name="Search"        component={SearchScreen} />
      <Tab.Screen name="Create"        component={CreatePostScreen} />
      <Tab.Screen name="Notifications" component={NotificationsScreen} />
      <Tab.Screen name="MyPosts"       component={MyPostsScreen} />
      <Tab.Screen name="Profile"       component={ProfileStackNavigator} />
    </Tab.Navigator>
  );
};

function createBarStyles(c: Colors) {
  const BAR_HEIGHT = Platform.OS === 'web' ? 64 : 76;

  return StyleSheet.create({
    bar: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: c.surface,
      height: BAR_HEIGHT,
      paddingBottom: Platform.OS === 'web' ? 6 : 14,
      paddingTop: 6,
      paddingHorizontal: 4,
      // top shadow
      shadowColor: '#000',
      shadowOffset: { width: 0, height: -3 },
      shadowOpacity: 0.07,
      shadowRadius: 12,
      elevation: 16,
      // web box-shadow
      ...(Platform.OS === 'web' ? { boxShadow: '0 -3px 12px rgba(0,0,0,0.07)' } as any : {}),
    },

    // Regular tab
    tabItem: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
    },
    tabInner: {
      alignItems: 'center',
      justifyContent: 'center',
      gap: 3,
      paddingHorizontal: 10,
      paddingVertical: 6,
      borderRadius: 14,
      position: 'relative',
    },
    activePill: {
      ...StyleSheet.absoluteFillObject,
      borderRadius: 14,
    },
    tabLabel: {
      fontSize: 10,
      fontWeight: typography.weights.medium,
      letterSpacing: 0.2,
    },
    tabLabelActive: {
      fontWeight: typography.weights.bold,
    },

    // Create (+) slot
    createSlot: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
    },
    createOuter: {
      alignItems: 'center',
      justifyContent: 'center',
      marginBottom: Platform.OS === 'web' ? 14 : 18,
    },
    createInner: {
      width: 56,
      height: 56,
      borderRadius: 28,
      alignItems: 'center',
      justifyContent: 'center',
      shadowOffset: { width: 0, height: 6 },
      shadowOpacity: 0.4,
      shadowRadius: 10,
      elevation: 10,
    },
  });
}

export default TabNavigator;
