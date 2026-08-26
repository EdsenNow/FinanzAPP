import { create } from 'zustand';

function getInitialTheme() {
  try {
    const saved = localStorage.getItem('theme');
    if (saved === 'light' || saved === 'dark') return saved;
    const settingsRaw = localStorage.getItem('finanzapp:settings:v1');
    if (settingsRaw) {
      const parsed = JSON.parse(settingsRaw);
      if (parsed && parsed.theme) return parsed.theme;
    }
  } catch (_) {}
  return 'dark';
}

export const useThemeStore = create((set) => ({
  theme: getInitialTheme(),
  
  toggleTheme: () => set((state) => {
    const nextTheme = state.theme === 'dark' ? 'light' : 'dark';
    try {
      localStorage.setItem('theme', nextTheme);
      document.documentElement.setAttribute('data-theme', nextTheme);
      document.documentElement.style.backgroundColor = nextTheme === 'light' ? '#faf4ed' : '#191724';
    } catch (_) {}
    return { theme: nextTheme };
  }),

  setTheme: (theme) => set(() => {
    const valid = theme === 'light' ? 'light' : 'dark';
    try {
      localStorage.setItem('theme', valid);
      document.documentElement.setAttribute('data-theme', valid);
      document.documentElement.style.backgroundColor = valid === 'light' ? '#faf4ed' : '#191724';
    } catch (_) {}
    return { theme: valid };
  })
}));
