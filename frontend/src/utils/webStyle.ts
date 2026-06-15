import { Platform } from 'react-native';

/**
 * Applied inline on every TextInput to suppress the browser's native
 * <input> border and focus ring. No-op on native.
 */
export const webInputReset =
  Platform.OS === 'web'
    ? ({
        borderWidth: 0,
        outlineWidth: 0,
        outlineStyle: 'none',
      } as any)
    : undefined;
