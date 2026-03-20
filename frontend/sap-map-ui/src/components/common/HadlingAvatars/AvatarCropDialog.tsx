/*
 * components/common/AvatarCropDialog.tsx
 * ─────────────────────────────────────────────────────────────────────────────
 * Purpose : Reusable avatar crop dialog using react-avatar-editor. Provides
 *           zoom/rotate sliders and an inner AvatarDropzone so users can swap
 *           to a different image without closing the dialog.
 *           Extracted from UserAccount.tsx and Users.tsx to remove duplication.
 *
 * Used by : pages/users/UserAccount.tsx, pages/users/Users.tsx
 *
 * Props
 *   open    – controls dialog visibility
 *   onClose – called when dialog is dismissed (Cancel or after Apply)
 *   onApply – called with the base64 PNG string of the cropped result
 *   image   – initial image to load in the editor (base64 or object URL);
 *             ignored while the user has dropped a new file inside the dialog
 *   title   – optional dialog title; defaults to 'Edit Photo'
 *
 * Key internal state
 *   pendingFile – object URL of a newly-dropped image (overrides `image` prop)
 *   scale       – AvatarEditor zoom level (1–3)
 *   rotate      – AvatarEditor rotation in degrees (0–360)
 */
import { useRef, useState, useCallback, useEffect } from 'react';
import AvatarEditor from 'react-avatar-editor';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Dialog from '@mui/material/Dialog';
import DialogTitle from '@mui/material/DialogTitle';
import DialogContent from '@mui/material/DialogContent';
import DialogActions from '@mui/material/DialogActions';
import Slider from '@mui/material/Slider';
import Typography from '@mui/material/Typography';
import AvatarDropzone from './AvatarDropzone';

interface AvatarCropDialogProps {
  open: boolean;
  onClose: () => void;
  onApply: (base64: string) => void;
  image?: string | null;
  title?: string;
}

export default function AvatarCropDialog({
  open,
  onClose,
  onApply,
  image,
  title = 'Edit Photo',
}: AvatarCropDialogProps) {
  const editorRef = useRef<AvatarEditor>(null);
  const [pendingFile, setPendingFile] = useState<string | null>(null);
  const [scale, setScale]             = useState(1.2);
  const [rotate, setRotate]           = useState(0);

  // Reset internal state each time the dialog opens
  useEffect(() => {
    if (open) {
      setPendingFile(null);
      setScale(1.2);
      setRotate(0);
    }
  }, [open]);

  const currentImage = pendingFile ?? image ?? null;

  const handleApply = useCallback(() => {
    if (!editorRef.current) return;
    const base64 = editorRef.current.getImageScaledToCanvas().toDataURL('image/png');
    onApply(base64);
    onClose();
  }, [onApply, onClose]);

  return (
    <Dialog open={open} onClose={onClose} maxWidth="xs" fullWidth>
      <DialogTitle>{title}</DialogTitle>
      <DialogContent>
        <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2.5, pt: 1 }}>
          {currentImage && (
            <AvatarEditor
              ref={editorRef}
              image={currentImage}
              width={240}
              height={240}
              border={24}
              borderRadius={120}
              color={[0, 0, 0, 0.55]}
              scale={scale}
              rotate={rotate}
              style={{ borderRadius: 8 }}
            />
          )}

          <Box sx={{ width: '100%' }}>
            <Typography variant="caption" color="text.secondary">Zoom</Typography>
            <Slider
              min={1} max={3} step={0.05}
              value={scale}
              onChange={(_, v) => setScale(v as number)}
              size="small"
            />
          </Box>

          <Box sx={{ width: '100%' }}>
            <Typography variant="caption" color="text.secondary">Rotate</Typography>
            <Slider
              min={0} max={360} step={1}
              value={rotate}
              onChange={(_, v) => setRotate(v as number)}
              size="small"
            />
          </Box>

          <AvatarDropzone
            compact
            onFile={(url) => { setPendingFile(url); setScale(1.2); setRotate(0); }}
          />
        </Box>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Cancel</Button>
        <Button variant="contained" disabled={!currentImage} onClick={handleApply}>Apply</Button>
      </DialogActions>
    </Dialog>
  );
}
