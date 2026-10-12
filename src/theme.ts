export const colors = {
  primary: '#2563EB',
  primaryDark: '#1E40AF',
  primaryLight: '#3B82F6',
  primarySoft: '#EFF6FF',

  admin: '#7C3AED',
  adminDark: '#6D28D9',
  adminSoft: '#F5F3FF',

  success: '#10B981',
  successDark: '#059669',
  successSoft: '#ECFDF5',

  warning: '#F59E0B',
  warningDark: '#D97706',
  warningSoft: '#FFFBEB',

  danger: '#EF4444',
  dangerDark: '#DC2626',
  dangerSoft: '#FEF2F2',

  gray: {
    50: '#F8FAFC',
    100: '#F1F5F9',
    200: '#E2E8F0',
    300: '#CBD5E1',
    400: '#94A3B8',
    500: '#64748B',
    600: '#475569',
    700: '#334155',
    800: '#1E293B',
    900: '#0F172A',
  },

  white: '#FFFFFF',
  black: '#000000',
};

export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 24,
  xxxl: 32,
};

export const radius = {
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 24,
  pill: 999,
};

export const shadow = {
  none: {},
  xs: {
    shadowColor: colors.gray[900],
    shadowOpacity: 0.04,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 1 },
    elevation: 1,
  },
  sm: {
    shadowColor: colors.gray[900],
    shadowOpacity: 0.06,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  md: {
    shadowColor: colors.gray[900],
    shadowOpacity: 0.08,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 4,
  },
  lg: {
    shadowColor: colors.gray[900],
    shadowOpacity: 0.1,
    shadowRadius: 20,
    shadowOffset: { width: 0, height: 8 },
    elevation: 8,
  },
  colored: (color: string) => ({
    shadowColor: color,
    shadowOpacity: 0.25,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 8 },
    elevation: 6,
  }),
};

export const font = {
  regular: 'Inter_400Regular',
  medium: 'Inter_500Medium',
  semibold: 'Inter_600SemiBold',
  bold: 'Inter_700Bold',
  extrabold: 'Inter_800ExtraBold',
  black: 'Inter_900Black',
};

export const text = {
  h1: { fontSize: 32, fontFamily: font.black, letterSpacing: -0.5 },
  h2: { fontSize: 24, fontFamily: font.extrabold, letterSpacing: -0.3 },
  h3: { fontSize: 20, fontFamily: font.extrabold },
  h4: { fontSize: 17, fontFamily: font.bold },
  body: { fontSize: 14, fontFamily: font.regular },
  bodyMedium: { fontSize: 14, fontFamily: font.semibold },
  small: { fontSize: 12, fontFamily: font.medium },
  tiny: { fontSize: 11, fontFamily: font.semibold, letterSpacing: 1.5 },
  label: { fontSize: 11, fontFamily: font.extrabold, letterSpacing: 1.8 },
};
