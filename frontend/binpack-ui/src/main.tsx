import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { Provider } from 'react-redux';
import { store } from './app/store';
import { registerLogout } from './auth/logoutBus';
import { signOut } from './features/auth/authSlice';
import App from './App';
import './style.css';

registerLogout(() => store.dispatch(signOut()));

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <Provider store={store}>
      <App />
    </Provider>
  </StrictMode>
);
