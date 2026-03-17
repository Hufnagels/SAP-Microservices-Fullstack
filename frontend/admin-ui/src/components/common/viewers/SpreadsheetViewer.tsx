/*
 * components/common/viewers/SpreadsheetViewer.tsx
 * ─────────────────────────────────────────────────────────────────────────────
 * Purpose : Displays XLS, XLSX, and CSV files as a scrollable MUI Table.
 *           Uses SheetJS (xlsx) to parse the base64 content and reads the
 *           first worksheet, converting rows to JSON objects.
 *
 * Props
 *   open      – controls dialog visibility
 *   onClose   – dismiss callback
 *   src       – base64 string of the file content (without data: prefix)
 *   fileName  – shown in the dialog title
 */
import { useEffect, useState } from 'react';
import * as XLSX from 'xlsx';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Dialog from '@mui/material/Dialog';
import DialogTitle from '@mui/material/DialogTitle';
import DialogContent from '@mui/material/DialogContent';
import DialogActions from '@mui/material/DialogActions';
import Table from '@mui/material/Table';
import TableHead from '@mui/material/TableHead';
import TableBody from '@mui/material/TableBody';
import TableRow from '@mui/material/TableRow';
import TableCell from '@mui/material/TableCell';
import TableContainer from '@mui/material/TableContainer';
import Typography from '@mui/material/Typography';

interface SpreadsheetViewerProps {
  open:     boolean;
  onClose:  () => void;
  src:      string;
  fileName: string;
}

export default function SpreadsheetViewer({ open, onClose, src, fileName }: SpreadsheetViewerProps) {
  const [headers, setHeaders] = useState<string[]>([]);
  const [rows, setRows]       = useState<Record<string, unknown>[]>([]);
  const [error, setError]     = useState<string | null>(null);

  useEffect(() => {
    if (!open || !src) return;
    try {
      // src may arrive as a full data URL or a raw base64 string
      const base64 = src.includes(',') ? src.split(',')[1] : src;
      const wb     = XLSX.read(base64, { type: 'base64' });
      const sheet  = wb.Sheets[wb.SheetNames[0]];
      const data   = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: '' });
      const cols   = data.length > 0 ? Object.keys(data[0]) : [];
      setHeaders(cols);
      setRows(data);
      setError(null);
    } catch {
      setError('Failed to parse file. The data may be corrupted.');
      setHeaders([]);
      setRows([]);
    }
  }, [open, src]);

  return (
    <Dialog open={open} onClose={onClose} maxWidth="lg" fullWidth>
      <DialogTitle>{fileName}</DialogTitle>
      <DialogContent>
        {error ? (
          <Typography color="error" variant="body2">{error}</Typography>
        ) : rows.length === 0 ? (
          <Typography color="text.secondary" variant="body2">No data found in the first sheet.</Typography>
        ) : (
          <TableContainer sx={{ maxHeight: 500 }}>
            <Table size="small" stickyHeader>
              <TableHead>
                <TableRow>
                  {headers.map((h) => (
                    <TableCell key={h} sx={{ fontWeight: 700, whiteSpace: 'nowrap' }}>
                      {h}
                    </TableCell>
                  ))}
                </TableRow>
              </TableHead>
              <TableBody>
                {rows.map((row, i) => (
                  <TableRow key={i} hover>
                    {headers.map((h) => (
                      <TableCell key={h} sx={{ whiteSpace: 'nowrap' }}>
                        {String(row[h] ?? '')}
                      </TableCell>
                    ))}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        )}
        <Box sx={{ mt: 1 }}>
          <Typography variant="caption" color="text.disabled">
            Showing sheet 1 · {rows.length} row{rows.length !== 1 ? 's' : ''}
          </Typography>
        </Box>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Close</Button>
      </DialogActions>
    </Dialog>
  );
}
