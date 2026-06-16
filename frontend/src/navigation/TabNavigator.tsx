import React, { useMemo, useState, useEffect } from 'react';
import { View, TouchableOpacity, StyleSheet, Platform } from 'react-native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import type { BottomTabBarProps } from '@react-navigation/bottom-tabs';
import { Ionicons } from '@expo/vector-icons';
import { TabParamList } from '../types';
import { useColors, Colors } from '../context/ThemeContext';
import { useSocket } from '../context/SocketContext';
import { typography } from '../theme/typography';
import AppText from '../components/atoms/Text';
import FeedScreen from '../screens/FeedScreen';
import SearchScreen from '../screens/SearchScreen';
import CreatePostScreen from '../screens/CreatePostScreen';
import NotificationsScreen from '../screens/NotificationsScreen';
import MyPostsScreen from '../screens/MyPostsScreen';
import ChatStackNavigator from './ChatStackNavigator';
import ProfileStackNavigator from './ProfileStackNavigator';
import SettingsStackNavigator from './SettingsStackNavigator';

const Tab = createBottomTabNavigator<TabParamList>();

const VISIBLE_TABS: Array<{
  name: keyof TabParamList;
  label: string;
  icon: string;
  iconFocused: string;
}> = [
  { name: 'Feed',     label: 'home',     icon: 'home-outline',          iconFocused: 'home' },
  { name: 'Chat',     label: 'chat',     icon: 'chatbubbles-outline',   iconFocused: 'chatbubbles' },
  { name: 'Create',   label: '',         icon: '',                      iconFocused: '' },
  { name: 'MyPosts',  label: 'posts',    icon: 'newspaper-outline',     iconFocused: 'newspaper' },
  { name: 'Settings', label: 'settings', icon: 'settings-outline',      iconFocused: 'settings-sharp' },
];

const CustomTabBar: React.FC<BottomTabBarProps> = ({ state, navigation }) => {
  const colors = useColors();
  const styles = useMemo(() => createBarStyles(colors), [colors]);
  const { socket } = useSocket();
  const [hasUnreadNotif, setHasUnreadNotif] = useState(false);

  useEffect(() => {
    if (!socket) return;
    const handler = () => setHasUnreadNotif(true);
    socket.on('new-notification', handler);
    return () => { socket.off('new-notification', handler); };
  }, [socket]);

  return (
    <View style={styles.bar}>
      {VISIBLE_TABS.map((tab) => {
        const routeIndex = state.routes.findIndex((r) => r.name === tab.name);
        const isFocused = state.index === routeIndex;

        const onPress = () => {
          if (routeIndex === -1) return;
          if (tab.name === 'Notifications') setHasUnreadNotif(false);
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
              <TouchableOpacity onPress={onPress} activeOpacity={0.85} style={styles.createOuter}>
                <View style={[styles.createInner, { backgroundColor: colors.accent, shadowColor: colors.accent }]}>
                  <Ionicons name="add" size={28} color="#FFF" />
                </View>
              </TouchableOpacity>
            </View>
          );
        }

        // ── Regular tab item ──
        const iconName = (isFocused ? tab.iconFocused : tab.icon) as any;
        const showBadge = tab.name === 'Notifications' && hasUnreadNotif && !isFocused;
        return (
          <TouchableOpacity key={tab.name} style={styles.tabItem} onPress={onPress} activeOpacity={0.7}>
            <View style={styles.tabInner}>
              {isFocused && <View style={[styles.activePill, { backgroundColor: `${colors.accent}18` }]} />}
              <View>
                <Ionicons name={iconName} size={22} color={isFocused ? colors.accent : colors.textMuted} />
                {showBadge && <View style={[styles.notifBadge, { backgroundColor: colors.accent }]} />}
              </View>
              <AppText style={[styles.tabLabel, { color: isFocused ? colors.accent : colors.textMuted }, isFocused && styles.tabLabelActive]}>
                {tab.label}
              </AppText>
            </View>
          </TouchableOpacity>
        );
      })}
    </View>
  );
};

const TabNavigator: React.FC = () => (
  <Tab.Navigator tabBar={(props) => <CustomTabBar {...props} />} screenOptions={{ headerShown: false }}>
    <Tab.Screen name="Feed"          component={FeedScreen} />
    <Tab.Screen name="Search"        component={SearchScreen} />
    <Tab.Screen name="Create"        component={CreatePostScreen} />
    <Tab.Screen name="Chat"          component={ChatStackNavigator} />
    <Tab.Screen name="Notifications" component={NotificationsScreen} />
    <Tab.Screen name="MyPosts"       component={MyPostsScreen} />
    <Tab.Screen name="Profile"       component={ProfileStackNavigator} />
    <Tab.Screen name="Settings"      component={SettingsStackNavigator} />
  </Tab.Navigator>
);

function createBarStyles(c: Colors) {
  const BAR_HEIGHT = Platform.OS === 'web' ? 64 : 76;
  return StyleSheet.create({
    bar: {
      flexDirection: 'row', alignItems: 'center',
      backgroundColor: c.surface, height: BAR_HEIGHT,
      paddingBottom: Platform.OS === 'web' ? 6 : 14,
      paddingTop: 6, paddingHorizontal: 4,
      shadowColor: '#000', shadowOffset: { width: 0, height: -3 },
      shadowOpacity: 0.07, shadowRadius: 12, elevation: 16,
      ...(Platform.OS === 'web' ? { boxShadow: '0 -3px 12px rgba(0,0,0,0.07)' } as any : {}),
    },
    tabItem: { flex: 1, alignItems: 'center', justifyContent: 'center' },
    tabInner: {
      alignItems: 'center', justifyContent: 'center',
      gap: 3, paddingHorizontal: 10, paddingVertical: 6,
      borderRadius: 14, position: 'relative',
    },
    activePill: { ...StyleSheet.absoluteFill, borderRadius: 14 },
    tabLabel: { fontSize: 10, fontWeight: typography.weights.medium, letterSpacing: 0.2 },
    tabLabelActive: { fontWeight: typography.weights.bold },
    notifBadge: {
      position: 'absolute', top: -2, right: -3,
      width: 8, height: 8, borderRadius: 4,
      borderWidth: 1.5, borderColor: 'transparent',
    },
    createSlot: { flex: 1, alignItems: 'center', justifyContent: 'center' },
    createOuter: {
      alignItems: 'center', justifyContent: 'center',
      marginBottom: Platform.OS === 'web' ? 14 : 18,
    },
    createInner: {
      width: 56, height: 56, borderRadius: 28,
      alignItems: 'center', justifyContent: 'center',
      shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.4,
      shadowRadius: 10, elevation: 10,
    },
  });
}

export default TabNavigator;
