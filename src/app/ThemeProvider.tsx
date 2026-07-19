'use client';

import React, { createContext, useContext, useState, useEffect } from 'react';

type Theme = 'light' | 'dark' | 'system';
type Accent = 'navy' | 'blue' | 'indigo' | 'purple' | 'emerald' | 'cyan' | 'orange' | 'rose';

interface ThemeContextType {
  theme: Theme;
  accent: Accent;
  setTheme: (theme: Theme) => void;
  setAccent: (accent: Accent) => void;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

// Color specs matching ZConnect design system
const ACCENT_COLORS: Record<Accent, { primary: string; hover: string; foreground: string }> = {
  navy: { primary: '#0D2B5C', hover: '#091E43', foreground: '#FFFFFF' },
  blue: { primary: '#3B82F6', hover: '#2563EB', foreground: '#FFFFFF' },
  indigo: { primary: '#6366F1', hover: '#4F46E5', foreground: '#FFFFFF' },
  purple: { primary: '#A855F7', hover: '#9333EA', foreground: '#FFFFFF' },
  emerald: { primary: '#10B981', hover: '#059669', foreground: '#FFFFFF' },
  cyan: { primary: '#06B6D4', hover: '#0891B2', foreground: '#FFFFFF' },
  orange: { primary: '#F97316', hover: '#EA580C', foreground: '#FFFFFF' },
  rose: { primary: '#F43F5E', hover: '#E11D48', foreground: '#FFFFFF' },
};

// High contrast accessibility adjustment for Navy in Dark Mode
const DARK_NAVY_ACCENT = { primary: '#3B82F6', hover: '#60A5FA', foreground: '#FFFFFF' };

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setThemeState] = useState<Theme>('light');
  const [accent, setAccentState] = useState<Accent>('navy');
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    // Read initial preferences from localStorage
    const savedTheme = localStorage.getItem('zconnect_theme') as Theme;
    const savedAccent = localStorage.getItem('zconnect_accent') as Accent;
    
    if (savedTheme) setThemeState(savedTheme);
    if (savedAccent) setAccentState(savedAccent);
    
    setMounted(true);
  }, []);

  const setTheme = (newTheme: Theme) => {
    setThemeState(newTheme);
    localStorage.setItem('zconnect_theme', newTheme);
  };

  const setAccent = (newAccent: Accent) => {
    setAccentState(newAccent);
    localStorage.setItem('zconnect_accent', newAccent);
  };

  useEffect(() => {
    if (!mounted) return;

    const root = document.documentElement;

    // Helper to apply class rules
    const applyTheme = (isDark: boolean) => {
      if (isDark) {
        root.classList.add('dark');
      } else {
        root.classList.remove('dark');
      }
      
      // Determine active color specification
      let colorSpec = ACCENT_COLORS[accent];
      
      // If we are in dark mode and selected accent is navy, override with high contrast blue
      if (isDark && accent === 'navy') {
        colorSpec = DARK_NAVY_ACCENT;
      }
      
      root.style.setProperty('--primary-accent', colorSpec.primary);
      root.style.setProperty('--primary-accent-hover', colorSpec.hover);
      root.style.setProperty('--primary-accent-foreground', colorSpec.foreground);
    };

    if (theme === 'system') {
      const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
      applyTheme(mediaQuery.matches);

      const handler = (e: MediaQueryListEvent) => {
        applyTheme(e.matches);
      };
      
      mediaQuery.addEventListener('change', handler);
      return () => mediaQuery.removeEventListener('change', handler);
    } else {
      applyTheme(theme === 'dark');
    }
  }, [theme, accent, mounted]);

  return (
    <ThemeContext.Provider value={{ theme, accent, setTheme, setAccent }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
}
