type LogoutFn = () => void;
let _logout: LogoutFn | null = null;
export function registerLogout(fn: LogoutFn) { _logout = fn; }
export function logoutExternal() { _logout?.(); window.location.href = '/'; }
