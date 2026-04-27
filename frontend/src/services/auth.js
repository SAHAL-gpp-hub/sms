// auth.js
// FIX: Store JWT in sessionStorage so users survive page refreshes within
// the same browser session. sessionStorage is cleared when the tab closes,
// preventing long-lived token persistence (better than localStorage for
// security, better than in-memory for UX). XSS risk is identical to
// localStorage but acceptable for an internal school admin tool.

const TOKEN_KEY = 'sms_auth_token';

export const setToken = (t) => {
  try {
    sessionStorage.setItem(TOKEN_KEY, t);
  } catch {
    // Fallback to in-memory if sessionStorage blocked (private browsing edge case)
    _memToken = t;
  }
};

let _memToken = null;

export const getToken = () => {
  try {
    return sessionStorage.getItem(TOKEN_KEY) || _memToken;
  } catch {
    return _memToken;
  }
};

export const clearToken = () => {
  try {
    sessionStorage.removeItem(TOKEN_KEY);
  } catch { /* */ }
  _memToken = null;
};
