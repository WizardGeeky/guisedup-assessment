import React, { useMemo } from 'react';
import { View, TouchableOpacity, StyleSheet } from 'react-native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import type { BottomTabBarButtonProps } from '@react-navigation/bottom-tabs';
import { Ionicons } from '@expo/vector-icons';
import { TabParamList } from '../types';
import { useColors, Colors } from '../context/ThemeContext';
import { typography } from '../theme/typography';
import { spacing } from '../theme/spacing';
import FeedScreen from '../screens/FeedScreen';
import SearchScreen from '../screens/SearchScreen';
import CreatePostScreen from '../screens/CreatePostScreen';
import NotificationsScreen from '../screens/NotificationsScreen';
import ProfileStackNavigator from './ProfileStackNavigator';

const Tab = createBottomTabNavigator<TabParamList>();

const CreateTabButton: React.FC<BottomTabBarButtonProps> = ({ onPress }) => {
  const colors = useColors();
  return (
    <TouchableOpacity onPress={onPress ?? undefined} activeOpacity={0.85} style={staticStyles.createOuter}>
      <View style={[staticStyles.createInner, { backgroundColor: colors.accent, shadowColor: colors.accent }]}>
        <Ionicons name="add" size={28} color="#FFFFFF" />
      </View>
    </TouchableOpacity>
  );
};

const TabNavigator: React.FC = () => {
  const colors = useColors();
  const styles = useMemo(() => createStyles(colors), [colors]);

  return (
    <Tab.Navigator
      screenOptions={{
        headerShown: false,
        tabBarStyle: styles.tabBar,
        tabBarActiveTintColor: colors.accent,
        tabBarInactiveTintColor: colors.textMuted,
        tabBarShowLabel: true,
        tabBarLabelStyle: staticStyles.tabLabel,
      }}
    >
      <Tab.Screen
        name="Feed"
        component={FeedScreen}
        options={{
          tabBarLabel: 'home',
          tabBarIcon: ({ color, focused }) => (
            <Ionicons name={focused ? 'home' : 'home-outline'} size={22} color={color} />
          ),
        }}
      />
      <Tab.Screen
        name="Search"
        component={SearchScreen}
        options={{
          tabBarLabel: 'search',
          tabBarIcon: ({ color, focused }) => (
            <Ionicons name={focused ? 'search' : 'search-outline'} size={22} color={color} />
          ),
        }}
      />
      <Tab.Screen
        name="Create"
        component={CreatePostScreen}
        options={{
          tabBarLabel: '',
          tabBarButton: (props) => <CreateTabButton {...props} />,
        }}
      />
      <Tab.Screen
        name="Notifications"
        component={NotificationsScreen}
        options={{
          tabBarLabel: 'activity',
          tabBarIcon: ({ color, focused }) => (
            <Ionicons name={focused ? 'notifications' : 'notifications-outline'} size={22} color={color} />
          ),
        }}
      />
      <Tab.Screen
        name="Profile"
        component={ProfileStackNavigator}
        options={{
          tabBarLabel: 'profile',
          tabBarIcon: ({ color, focused }) => (
            <Ionicons name={focused ? 'person' : 'person-outline'} size={22} color={color} />
          ),
        }}
      />
    </Tab.Navigator>
  );
};

const staticStyles = StyleSheet.create({
  tabLabel: {
    fontSize: typography.sizes.xs,
    fontWeight: typography.weights.medium,
  },
  createOuter: {
    top: -18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  createInner: {
    width: 58,
    height: 58,
    borderRadius: 29,
    alignItems: 'center',
    justifyContent: 'center',
    shadowOffset: { width: 0, height: 5 },
    shadowOpacity: 0.4,
    shadowRadius: 10,
    elevation: 8,
  },
});

function createStyles(c: Colors) {
  return StyleSheet.create({
    tabBar: {
      backgroundColor: c.surface,
      borderTopColor: c.border,
      borderTopWidth: 1,
      height: 62,
      paddingBottom: 8,
      paddingTop: 6,
    },
  });
}

export default TabNavigator;
