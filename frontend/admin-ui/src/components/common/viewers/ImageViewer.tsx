/*
 * components/common/viewers/ImageViewer.tsx
 * ─────────────────────────────────────────────────────────────────────────────
 * Purpose : View-only image dialog with zoom and rotate sliders.
 *           Reuses react-avatar-editor (already installed) for rendering —
 *           same UX as AvatarCropDialog but without the Apply/crop step.
 *
 * Props
 *   open    – controls dialog visibility
 *   onClose – dismiss callback
 *   src     – base64 data URL of the image
 *   title   – dialog header text (defaults to file name)
 */
import { useRef, useState, useEffect } from 'react';
import AvatarEditor from 'react-avatar-editor';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Dialog from '@mui/material/Dialog';
import DialogTitle from '@mui/material/DialogTitle';
import DialogContent from '@mui/material/DialogContent';
import DialogActions from '@mui/material/DialogActions';
import Slider from '@mui/material/Slider';
import Typography from '@mui/material/Typography';

interface ImageViewerProps {
  open:    boolean;
  onClose: () => void;
  src:     string;
  title?:  string;
}

export default function ImageViewer({ open, onClose, src, title = 'Image' }: ImageViewerProps) {
  const editorRef            = useRef<AvatarEditor>(null);
  const [scale, setScale]   = useState(1);
  const [rotate, setRotate] = useState(0);

  useEffect(() => {
    if (open) { setScale(1); setRotate(0); }
  }, [open]);

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>{title}</DialogTitle>
      <DialogContent>
        <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2.5, pt: 1 }}>
          {src && (
            <AvatarEditor
              ref={editorRef}
              image={src}
              width={340}
              height={340}
              border={0}
              borderRadius={0}
              color={[0, 0, 0, 0]}
              scale={scale}
              rotate={rotate}
              style={{ borderRadius: 8, maxWidth: '100%' }}
            />
          )}

          <Box sx={{ width: '100%' }}>
            <Typography variant="caption" color="text.secondary">Zoom</Typography>
            <Slider
              min={0.5} max={4} step={0.05}
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
        </Box>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Close</Button>
      </DialogActions>
    </Dialog>
  );
}
