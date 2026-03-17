/*
 * components/common/viewers/VideoViewer.tsx
 * ─────────────────────────────────────────────────────────────────────────────
 * Purpose : Dialog-based MP4 / video player for the File Manager.
 *           Fetches the file via GET /files/{id}/stream (with Authorization
 *           header) and creates a Blob URL — this allows the browser to use
 *           range requests for seeking, which base64 data-URLs cannot do.
 *
 * Props
 *   open    – controls dialog visibility
 *   onClose – dismiss callback
 *   fileId  – numeric file ID (used to build the stream URL)
 *   token   – Bearer token for Authorization header
 *   title   – dialog header text
 */
import { useEffect, useRef, useState } from 'react';
import Dialog from '@mui/material/Dialog';
import DialogTitle from '@mui/material/DialogTitle';
import DialogContent from '@mui/material/DialogContent';
import DialogActions from '@mui/material/DialogActions';
import Button from '@mui/material/Button';
import CircularProgress from '@mui/material/CircularProgress';
import Box from '@mui/material/Box';
import { VITE_APP_API_URL } from '../../../features/config';

interface VideoViewerProps {
  open:    boolean;
  onClose: () => void;
  fileId:  number;
  token:   string;
  title?:  string;
}

export default function VideoViewer({ open, onClose, fileId, token, title = 'Video' }: VideoViewerProps) {
  const [blobUrl,  setBlobUrl]  = useState<string | null>(null);
  const [loading,  setLoading]  = useState(false);
  const [error,    setError]    = useState<string | null>(null);
  const prevBlobUrl              = useRef<string | null>(null);

  useEffect(() => {
    if (!open) return;

    let cancelled = false;
    setLoading(true);
    setError(null);

    fetch(`${VITE_APP_API_URL}/files/${fileId}/stream`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return res.blob();
      })
      .then((blob) => {
        if (cancelled) return;
        const url = URL.createObjectURL(blob);
        // Revoke previous blob URL to free memory
        if (prevBlobUrl.current) URL.revokeObjectURL(prevBlobUrl.current);
        prevBlobUrl.current = url;
        setBlobUrl(url);
        setLoading(false);
      })
      .catch((err) => {
        if (!cancelled) { setError(err.message); setLoading(false); }
      });

    return () => { cancelled = true; };
  }, [open, fileId, token]);

  const handleClose = () => {
    setBlobUrl(null);
    onClose();
  };

  return (
    <Dialog open={open} onClose={handleClose} maxWidth="md" fullWidth>
      <DialogTitle>{title}</DialogTitle>
      <DialogContent sx={{ p: 1 }}>
        {loading && (
          <Box sx={{ display: 'flex', justifyContent: 'center', py: 6 }}>
            <CircularProgress />
          </Box>
        )}
        {error && (
          <Box sx={{ py: 4, textAlign: 'center', color: 'error.main' }}>
            Failed to load video: {error}
          </Box>
        )}
        {blobUrl && (
          <video
            controls
            autoPlay={false}
            style={{ width: '100%', borderRadius: 8, display: 'block' }}
            src={blobUrl}
          />
        )}
      </DialogContent>
      <DialogActions>
        <Button onClick={handleClose}>Close</Button>
      </DialogActions>
    </Dialog>
  );
}
