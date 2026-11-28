import { Platform, StyleSheet } from 'react-native';

// Values mirror DESIGN.md (light theme) and client/src/styles.css so the app
// reads as the same product as the website.
export const colors = {
  paper: '#f3f0e7',
  surface: '#fcfaf4',
  inputBg: '#fffdf7',
  ink: '#29332b',
  muted: '#5e6759',
  placeholder: '#6d7567',
  border: '#c9ccbb',
  inputBorder: '#939c89',
  forest: '#283c31',
  forestRaised: '#344c3d',
  forestBorder: '#203229',
  onForest: '#eeefe1',
  onForestMuted: '#b8c5b3',
  selected: '#e7dba9',
  rust: '#934125',
  rustDark: '#793a24',
  focus: '#25614a',
  error: '#8a251a',
  errorBg: '#f7dfd6',
  errorBorder: '#c28a77',
  successBg: '#dce8d9',
  successText: '#2d5734',
  successBorder: '#94ae8b',
  warnBg: '#f5e8bf',
  warnText: '#644c14',
  warnBorder: '#c5b16f',
  neutralBg: '#e9eddf',
  neutralText: '#374c32',
  neutralBorder: '#a4ae93',
} as const;

export const space = { xs: 4, sm: 8, md: 12, lg: 16, xl: 24, xxl: 32 } as const;
export const radius = 4;
export const touch = 48;

export const font = {
  serif: Platform.select({ ios: 'Georgia', android: 'serif', default: 'Georgia, serif' }),
  mono: Platform.select({ ios: 'Menlo', android: 'monospace', default: 'ui-monospace, monospace' }),
};

export const text = StyleSheet.create({
  title: { fontFamily: font.serif, fontSize: 26, lineHeight: 32, fontWeight: '700', color: colors.ink },
  heading: { fontFamily: font.serif, fontSize: 20, lineHeight: 26, fontWeight: '700', color: colors.ink },
  subheading: { fontSize: 16, lineHeight: 22, fontWeight: '700', color: colors.ink },
  body: { fontSize: 16, lineHeight: 24, color: colors.ink },
  small: { fontSize: 14, lineHeight: 20, color: colors.muted },
  label: { fontSize: 15, lineHeight: 20, fontWeight: '600', color: colors.ink },
  mono: { fontFamily: font.mono, fontSize: 13, lineHeight: 18, color: colors.muted },
});
