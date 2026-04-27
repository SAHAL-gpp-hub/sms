// C-01 FIX: Store JWT token in memory (NOT localStorage) to prevent XSS token theft.
// Token is lost on page refresh — users must log in again, which is the secure pattern.

let _token = null;

export const setToken = (t) => { _token = t; };
export const getToken = () => _token;
export const clearToken = () => { _token = null; };