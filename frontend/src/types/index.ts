// API-aligned types — match the backend response shapes exactly

export type AuthenticityLevel = 'high' | 'medium' | 'low';

export function getAuthenticityLevel(score: number): AuthenticityLevel {
  if (score >= 0.7) return 'high';
  if (score >= 0.4) return 'medium';
  return 'low';
}

export function getAvatarColor(username: string): string {
  const PALETTE = [
    '#E53935', '#8E24AA', '#1E88E5', '#00897B',
    '#F4511E', '#6D4C41', '#546E7A', '#3949AB',
  ];
  let hash = 0;
  for (let i = 0; i < username.length; i++) {
    hash = (hash * 31 + username.charCodeAt(i)) % PALETTE.length;
  }
  return PALETTE[Math.abs(hash) % PALETTE.length] ?? '#E53935';
}

export function formatTimeAgo(dateString: string): string {
  const date = new Date(dateString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMin = Math.floor(diffMs / (1000 * 60));
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (diffMin < 1) return 'just now';
  if (diffMin < 60) return `${diffMin}m`;
  if (diffHours < 24) return `${diffHours}h`;
  if (diffDays < 7) return `${diffDays}d`;
  return `${Math.floor(diffDays / 7)}w`;
}

export type RelationshipDepth = 'close_friend' | 'friend' | 'acquaintance';

export function getRelationshipDepth(score: number): RelationshipDepth {
  if (score > 0.65) return 'close_friend';
  if (score > 0.25) return 'friend';
  return 'acquaintance';
}

// Navigation param lists
export type RootStackParamList = {
  Auth: undefined;
  Main: undefined;
};

export type AuthStackParamList = {
  Splash: undefined;
  Login: undefined;
  Signup: undefined;
  ForgotPassword: undefined;
  OTPVerification: { email: string };
  ResetPassword: { email: string; token: string };
};

export type TabParamList = {
  Feed: undefined;
  Search: undefined;
  Create: undefined;
  Notifications: undefined;
  MyPosts: undefined;
  Profile: undefined;
};

export type ProfileStackParamList = {
  ProfileHome: undefined;
  Settings: undefined;
  EditProfile: undefined;
};
