import { useCallback, useEffect, useState } from 'react';

const STORAGE_KEY = 'tapal-theme';

function getSystemPreference() {
  return window.matchMedia?.('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

function resolveEffective(mode) {
  if (mode === 'system') return getSystemPreference();
  return mode;
}

function applyTheme(effective) {
  document.documentElement.setAttribute('data-theme', effective);
  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta) meta.content = effective === 'dark' ? '#0f1722' : '#f9f8f6';
}

let currentMode = 'system';
const listeners = new Set();

export function initDarkMode() {
  const stored = localStorage.getItem(STORAGE_KEY);
  currentMode = stored && ['light', 'dark', 'system'].includes(stored) ? stored : 'system';
  applyTheme(resolveEffective(currentMode));

  // Listen for system preference changes
  window.matchMedia?.('(prefers-color-scheme: dark)')
    .addEventListener('change', () => {
      if (currentMode === 'system') {
        applyTheme(resolveEffective('system'));
        listeners.forEach((fn) => fn(currentMode));
      }
    });
}

export function setDarkMode(mode) {
  if (!['light', 'dark', 'system'].includes(mode)) return;
  currentMode = mode;
  localStorage.setItem(STORAGE_KEY, mode);
  applyTheme(resolveEffective(mode));
  listeners.forEach((fn) => fn(mode));
}

export function getDarkMode() {
  return currentMode;
}

export function useDarkMode() {
  const [mode, setMode] = useState(currentMode);

  useEffect(() => {
    const handler = (newMode) => setMode(newMode);
    listeners.add(handler);
    return () => listeners.delete(handler);
  }, []);

  const toggle = useCallback(() => {
    const nextMode = mode === 'light' ? 'dark' : mode === 'dark' ? 'system' : 'light';
    setDarkMode(nextMode);
  }, [mode]);

  return { mode, setDarkMode, toggle, effective: resolveEffective(mode) };
}
