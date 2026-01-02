import { createContext, useContext, useEffect, useState, ReactNode } from 'react';

type Theme = 'warm' | 'dark' | 'rose' | 'forest' | 'starry' | 'lilac' | 'monochrome' | 'sepia' 
| 'espresso' | 'midnight' | 'sage' | 'amber' | 'cherry' | 'ocean' | 'slate' ;

interface ThemeContextType {
  theme: Theme;
  setTheme: (theme: Theme) => void;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setTheme] = useState<Theme>('warm');
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    const saved = localStorage.getItem('app-theme') as Theme;
    if (saved) {
      setTheme(saved);
    }
  }, []);

  useEffect(() => {
    if (!mounted) return;
    
    const root = document.documentElement;
    
    // Remove all theme attributes
    root.removeAttribute('data-theme');
    
    // Apply new theme
    if (theme !== 'warm') {
      root.setAttribute('data-theme', theme);
    }
    
    localStorage.setItem('app-theme', theme);
  }, [theme, mounted]);

  if (!mounted) {
    return null;
  }

  return (
    <ThemeContext.Provider value={{ theme, setTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useTheme must be used within ThemeProvider');
  }
  return context;
}