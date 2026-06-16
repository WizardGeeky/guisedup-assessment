import React, { createContext, useContext, useEffect, useRef, useState, ReactNode } from 'react';
import { io, Socket } from 'socket.io-client';
import { config } from '../constants/config';
import { tokenStorage } from '../services/tokenStorage';
import { useAuth } from './AuthContext';

interface SocketContextValue {
  socket: Socket | null;
  joinPost: (postId: string) => void;
  leavePost: (postId: string) => void;
}

const SocketContext = createContext<SocketContextValue>({
  socket: null,
  joinPost: () => {},
  leavePost: () => {},
});

export function SocketProvider({ children }: { children: ReactNode }): React.JSX.Element {
  const { isAuthenticated } = useAuth();
  const [socket, setSocket] = useState<Socket | null>(null);
  const socketRef = useRef<Socket | null>(null);

  useEffect(() => {
    if (!isAuthenticated) {
      socketRef.current?.disconnect();
      socketRef.current = null;
      setSocket(null);
      return;
    }

    const connect = async () => {
      const token = await tokenStorage.getAccessToken();
      if (!token) return;

      // Strip /api path — socket connects to server root
      const serverUrl = config.apiUrl.replace('/api', '');

      const s = io(serverUrl, {
        auth: { token },
        transports: ['websocket', 'polling'],
        reconnectionAttempts: 5,
        reconnectionDelay: 2000,
      });

      s.on('connect', () => setSocket(s));
      s.on('connect_error', (err) => {
        console.warn('Socket connect error:', err.message);
      });
      s.on('disconnect', () => setSocket(null));

      socketRef.current = s;
    };

    void connect();

    return () => {
      socketRef.current?.disconnect();
      socketRef.current = null;
      setSocket(null);
    };
  }, [isAuthenticated]);

  const joinPost = (postId: string) => socketRef.current?.emit('join-post', postId);
  const leavePost = (postId: string) => socketRef.current?.emit('leave-post', postId);

  return (
    <SocketContext.Provider value={{ socket, joinPost, leavePost }}>
      {children}
    </SocketContext.Provider>
  );
}

export function useSocket(): SocketContextValue {
  return useContext(SocketContext);
}
