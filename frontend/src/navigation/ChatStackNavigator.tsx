import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { ChatStackParamList } from '../types';
import ChatListScreen from '../screens/ChatListScreen';
import ChatRoomScreen from '../screens/ChatRoomScreen';

const Stack = createNativeStackNavigator<ChatStackParamList>();

const ChatStackNavigator: React.FC = () => {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="ChatList" component={ChatListScreen} />
      <Stack.Screen name="ChatRoom" component={ChatRoomScreen} />
    </Stack.Navigator>
  );
};

export default ChatStackNavigator;
