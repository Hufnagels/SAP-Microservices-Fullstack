/*
 * components/common/SessionGuard.tsx
 * ─────────────────────────────────────────────────────────────────────────────
 * Purpose : After IDLE_MS of user inactivity, shows a dialog:
 *             "Stay logged in" → POST /auth/refresh → new token stored, timer reset
 *             "Exit"           → signOut → redirect to /signin
 *
 * Triggers: mousemove, click, keydown, scroll, touchstart
 *
 * IDLE_MS  : 10 000 ms (10 s) — test value; change to e.g. 15 * 60 * 1000 for prod
 */

import { useEffect, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import {
  Dialog, DialogTitle, DialogContent, DialogActions,
  Button, Typography,
} from '@mui/material';
import { signOut, renewToken } from '../../features/auth/authSlice';
import type { RootState, AppDispatch } from '../../app/store';

const IDLE_MS = 15 * 60 * 1000; // 15 min idle

export default function SessionGuard() {
  const dispatch = useDispatch<AppDispatch>();
  const token    = useSelector((state: RootState) => state.auth.token);
  const [showModal, setShowModal] = useState(false);

  useEffect(() => {
    if (!token) return;

    let timer: ReturnType<typeof setTimeout>;

    const reset = () => {
      clearTimeout(timer);
      timer = setTimeout(() => setShowModal(true), IDLE_MS);
    };

    const events = ['mousemove', 'click', 'keydown', 'scroll', 'touchstart'] as const;
    events.forEach((e) => window.addEventListener(e, reset, { passive: true }));
    reset();

    return () => {
      clearTimeout(timer);
      events.forEach((e) => window.removeEventListener(e, reset));
    };
  }, [token]);

  const handleStay = async () => {
    setShowModal(false);
    try {
      await (dispatch(renewToken()) as any).unwrap();
    } catch {
      dispatch(signOut());
    }
  };

  const handleExit = () => {
    setShowModal(false);
    dispatch(signOut());
  };

  return (
    <Dialog open={showModal} disableEscapeKeyDown>
      <DialogTitle>Session Expiring</DialogTitle>
      <DialogContent>
        <Typography>
          Your session is about to expire. Do you want to stay logged in?
        </Typography>
      </DialogContent>
      <DialogActions>
        <Button onClick={handleExit} color="error">Exit</Button>
        <Button onClick={handleStay} variant="contained" autoFocus>
          Stay logged in
        </Button>
      </DialogActions>
    </Dialog>
  );
}
