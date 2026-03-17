/*
 * components/common/viewers/PdfViewer.tsx
 * ─────────────────────────────────────────────────────────────────────────────
 * Purpose : In-browser PDF viewer dialog using react-pdf.
 *           Renders one page at a time with Previous / Next navigation.
 *
 * Props
 *   open    – controls dialog visibility
 *   onClose – dismiss callback
 *   src     – base64 data URL (data:application/pdf;base64,...) of the PDF
 *   title   – dialog header text
 */
import { useState } from 'react';
import { Document, Page, pdfjs } from 'react-pdf';
import 'react-pdf/dist/Page/AnnotationLayer.css';
import 'react-pdf/dist/Page/TextLayer.css';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Dialog from '@mui/material/Dialog';
import DialogTitle from '@mui/material/DialogTitle';
import DialogContent from '@mui/material/DialogContent';
import DialogActions from '@mui/material/DialogActions';
import Typography from '@mui/material/Typography';
import CircularProgress from '@mui/material/CircularProgress';

// Configure pdf.js worker via CDN (avoids bundling the heavy worker)
pdfjs.GlobalWorkerOptions.workerSrc = `https://unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.mjs`;

interface PdfViewerProps {
  open:    boolean;
  onClose: () => void;
  src:     string;
  title?:  string;
}

export default function PdfViewer({ open, onClose, src, title = 'PDF' }: PdfViewerProps) {
  const [numPages, setNumPages]   = useState<number>(0);
  const [pageNumber, setPageNumber] = useState(1);

  const handleDocLoad = ({ numPages }: { numPages: number }) => {
    setNumPages(numPages);
    setPageNumber(1);
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth>
      <DialogTitle>{title}</DialogTitle>
      <DialogContent>
        <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2, pt: 1 }}>
          <Document
            file={src}
            onLoadSuccess={handleDocLoad}
            loading={<CircularProgress />}
            error={
              <Typography color="error" variant="body2">
                Failed to load PDF. The file may be corrupted or unsupported.
              </Typography>
            }
          >
            <Page
              pageNumber={pageNumber}
              width={560}
              renderAnnotationLayer
              renderTextLayer
            />
          </Document>

          {numPages > 0 && (
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
              <Button
                size="small"
                variant="outlined"
                disabled={pageNumber <= 1}
                onClick={() => setPageNumber((p) => p - 1)}
              >
                Previous
              </Button>
              <Typography variant="body2" color="text.secondary">
                Page {pageNumber} of {numPages}
              </Typography>
              <Button
                size="small"
                variant="outlined"
                disabled={pageNumber >= numPages}
                onClick={() => setPageNumber((p) => p + 1)}
              >
                Next
              </Button>
            </Box>
          )}
        </Box>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Close</Button>
      </DialogActions>
    </Dialog>
  );
}
