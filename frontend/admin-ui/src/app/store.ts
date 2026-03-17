/*
 * app/store.ts
 * ─────────────────────────────────────────────────────────────────────────────
 * Purpose : Configures and exports the single Redux store that powers the
 *           entire application. Redux DevTools are enabled in dev mode.
 *
 * Registered slices (state keys)
 *   auth   → features/auth/authSlice
 *   theme  → features/theme/themeSlice
 *   maps   → features/maps/mapsSlice
 *   charts → features/charts/chartsSlice
 *   users  → features/users/usersSlice
 *   files  → features/files/filesSlice
 *
 * Key exports
 *   store       – the Redux store instance (used in main.tsx Provider)
 *   RootState   – inferred full state type, used in useSelector calls
 *   AppDispatch – inferred dispatch type, used with useDispatch<AppDispatch>()
 */
import { configureStore } from '@reduxjs/toolkit';
import authReducer   from '../features/auth/authSlice';
import themeReducer  from '../features/theme/themeSlice';
import mapsReducer   from '../features/maps/mapsSlice';
import chartsReducer from '../features/charts/chartsSlice';
import usersReducer       from '../features/users/usersSlice';
import filesReducer       from '../features/files/filesSlice';
import permissionsReducer from '../features/permissions/permissionsSlice';




export const store = configureStore({
  reducer: {
    auth:   authReducer,
    theme:  themeReducer,
    maps:   mapsReducer,
    charts: chartsReducer,
    users:       usersReducer,
    files:       filesReducer,
    permissions: permissionsReducer,
  },
  devTools: import.meta.env.DEV,
  //window.__REDUX_DEVTOOLS_EXTENSION__ && window.__REDUX_DEVTOOLS_EXTENSION__()
});

export type RootState   = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;
