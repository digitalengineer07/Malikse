/**
 * Below are the colors that are used in the app. The colors are defined in the light and dark mode.
 * There are many other ways to style your app. For example, [Nativewind](https://www.nativewind.dev/), [Tamagui](https://tamagui.dev/), [unistyles](https://reactnativeunistyles.vercel.app), etc.
 */

import { Platform } from 'react-native';

const tintColorLight = '#0a7ea4';
const tintColorDark = '#fff';

export const AppTheme = {
  colors: {
    primary: '#4A90E2', // Soft Blue
    primaryDark: '#357ABD',
    primaryLight: '#D0E3F5',
    accent: '#63B3ED', // Lighter Blue
    accentLight: '#EBF8FF',
    background: 'transparent', // Make screens transparent for shared gradient background
    card: '#FFFFFF',
    cardSolid: '#FFFFFF',
    cardBorder: 'rgba(255, 255, 255, 0.8)',
    text: '#1E293B',
    textSecondary: '#475569',
    textMuted: '#94A3B8',
    white: '#FFFFFF',
    border: 'rgba(255, 255, 255, 0.5)',
    divider: 'rgba(255, 255, 255, 0.4)',
    success: '#10B981',
    successBg: '#ECFDF5',
    warning: '#F59E0B',
    warningBg: '#FFFBEB',
    danger: '#EF4444',
    dangerBg: '#FEF2F2',
    // 4-stage Verification Badges
    badgeIdentity: '#10B981',
    badgeDocument: '#3B82F6',
    badgeSite: '#8B5CF6',
    badgeLawyer: '#F59E0B',
  },
  shadows: {
    soft: {
      shadowColor: '#314E6B', // Soft blueish shadow
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.05,
      shadowRadius: 10,
      elevation: 3,
    },
    card: {
      shadowColor: '#314E6B',
      shadowOffset: { width: 0, height: 8 },
      shadowOpacity: 0.08,
      shadowRadius: 16,
      elevation: 5,
    },
    float: {
      shadowColor: '#314E6B',
      shadowOffset: { width: 0, height: 12 },
      shadowOpacity: 0.12,
      shadowRadius: 24,
      elevation: 10,
    },
  },
  glass: {},
  radius: {
    sm: 8,
    md: 12,
    lg: 16,
    xl: 24,
    full: 9999,
  }
};

export const Colors = {
  light: {
    text: '#0F172A',
    background: 'transparent',
    tint: '#059669',
    icon: '#64748B',
    tabIconDefault: '#94A3B8',
    tabIconSelected: '#059669',
  },
  dark: {
    text: '#ECEDEE',
    background: 'transparent',
    tint: tintColorDark,
    icon: '#9BA1A6',
    tabIconDefault: '#9BA1A6',
    tabIconSelected: tintColorDark,
  },
};

export const Fonts = Platform.select({
  ios: {
    /** iOS `UIFontDescriptorSystemDesignDefault` */
    sans: 'system-ui',
    /** iOS `UIFontDescriptorSystemDesignSerif` */
    serif: 'ui-serif',
    /** iOS `UIFontDescriptorSystemDesignRounded` */
    rounded: 'ui-rounded',
    /** iOS `UIFontDescriptorSystemDesignMonospaced` */
    mono: 'ui-monospace',
  },
  default: {
    sans: 'normal',
    serif: 'serif',
    rounded: 'normal',
    mono: 'monospace',
  },
  web: {
    sans: "system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif",
    serif: "Georgia, 'Times New Roman', serif",
    rounded: "'SF Pro Rounded', 'Hiragino Maru Gothic ProN', Meiryo, 'MS PGothic', sans-serif",
    mono: "SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono', 'Courier New', monospace",
  },
});
