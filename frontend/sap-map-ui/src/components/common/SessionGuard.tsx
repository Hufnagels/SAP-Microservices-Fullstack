import { useEffect, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
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
      await dispatch(renewToken()).unwrap();
    } catch {
      dispatch(signOut());
    }
  };

  const handleExit = () => {
    setShowModal(false);
    dispatch(signOut());
  };

  return (
    <Dialog open={showModal}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Session Expiring</DialogTitle>
          <DialogDescription>
            Your session is about to expire. Do you want to stay logged in?
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button variant="destructive" onClick={handleExit}>Exit</Button>
          <Button onClick={handleStay} autoFocus>Stay logged in</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
