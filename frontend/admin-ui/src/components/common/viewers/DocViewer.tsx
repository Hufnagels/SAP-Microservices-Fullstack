/*
 * components/common/viewers/DocViewer.tsx
 * ─────────────────────────────────────────────────────────────────────────────
 * Purpose : Viewer dialog for DOCX and plain-text (TXT) files.
 *           DOCX is converted to HTML via mammoth.js and rendered inline.
 *           TXT content is decoded from base64 and shown in a <pre> block.
 *
 * Props
 *   open     – controls dialog visibility
 *   onClose  – dismiss callback
 *   src      – base64 string of the file content
 *   mimeType – determines rendering strategy
 *   fileName – shown in the dialog title
 */
import { useEffect, useState } from 'react';
import mammoth from 'mammoth';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Dialog from '@mui/material/Dialog';
import DialogTitle from '@mui/material/DialogTitle';
import DialogContent from '@mui/material/DialogContent';
import DialogActions from '@mui/material/DialogActions';
import Typography from '@mui/material/Typography';
import CircularProgress from '@mui/material/CircularProgress';

interface DocViewerProps {
  open:     boolean;
  onClose:  () => void;
  src:      string;
  mimeType: string;
  fileName: string;
}

export default function DocViewer({ open, onClose, src, mimeType, fileName }: DocViewerProps) {
  const [html, setHtml]       = useState<string>('');
  const [text, setText]       = useState<string>('');
  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState<string | null>(null);

  const isDocx = mimeType === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
              || fileName.toLowerCase().endsWith('.docx');

  useEffect(() => {
    if (!open || !src) return;
    setError(null);

    if (isDocx) {
      setLoading(true);
      const base64 = src.includes(',') ? src.split(',')[1] : src;
      // Decode base64 → ArrayBuffer
      const binary = atob(base64);
      const bytes  = new Uint8Array(binary.length);
      for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
      mammoth.convertToHtml({ arrayBuffer: bytes.buffer as ArrayBuffer })
        .then((result) => { setHtml(result.value); })
        .catch(() => { setError('Failed to convert document.'); })
        .finally(() => setLoading(false));
    } else {
      // Plain text: decode base64
      try {
        const base64  = src.includes(',') ? src.split(',')[1] : src;
        const decoded = atob(base64);
        setText(decoded);
      } catch {
        setError('Failed to decode file content.');
      }
    }
  }, [open, src, isDocx]);

  return (
    <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth>
      <DialogTitle>{fileName}</DialogTitle>
      <DialogContent>
        {loading ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
            <CircularProgress />
          </Box>
        ) : error ? (
          <Typography color="error" variant="body2">{error}</Typography>
        ) : isDocx ? (
          <Box
            sx={{
              maxHeight: 520,
              overflowY: 'auto',
              '& h1,& h2,& h3': { mt: 2, mb: 0.5 },
              '& p': { mb: 1 },
              '& table': { borderCollapse: 'collapse', width: '100%' },
              '& td,& th': { border: '1px solid', borderColor: 'divider', p: '4px 8px' },
            }}
            dangerouslySetInnerHTML={{ __html: html }}
          />
        ) : (
          <Box
            component="pre"
            sx={{
              m: 0,
              maxHeight: 520,
              overflowY: 'auto',
              fontFamily: 'monospace',
              fontSize: '0.85rem',
              whiteSpace: 'pre-wrap',
              wordBreak: 'break-word',
              color: 'text.primary',
            }}
          >
            {text}
          </Box>
        )}
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Close</Button>
      </DialogActions>
    </Dialog>
  );
}
