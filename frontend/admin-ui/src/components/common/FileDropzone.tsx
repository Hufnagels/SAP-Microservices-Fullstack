/*
 * components/common/FileDropzone.tsx
 * ─────────────────────────────────────────────────────────────────────────────
 * Purpose : Generic drag-and-drop upload zone for the File Manager.
 *           Accepts images, PDF, Office documents, CSV and plain text.
 *           Follows the same visual style as HadlingAvatars/AvatarDropzone.
 *
 * Props
 *   onFiles – callback receiving the raw File[] array after a drop / selection
 */
import { useDropzone } from 'react-dropzone';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import UploadFileIcon from '@mui/icons-material/UploadFile';

interface FileDropzoneProps {
  onFiles: (files: File[]) => void;
}

const ACCEPTED = {
  'image/*':                                                               [],
  'video/mp4':                                                             [],
  'application/pdf':                                                       [],
  'application/vnd.ms-excel':                                              [],
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet':    [],
  'text/csv':                                                              [],
  'text/plain':                                                            [],
  'application/msword':                                                    [],
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': [],
};

export default function FileDropzone({ onFiles }: FileDropzoneProps) {
  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    accept:   ACCEPTED,
    onDrop:   (accepted) => { if (accepted.length) onFiles(accepted); },
  });

  return (
    <Box
      {...getRootProps()}
      sx={{
        width:       '100%',
        border:      '2px dashed',
        borderColor: isDragActive ? 'primary.main' : 'divider',
        borderRadius: 2,
        py: 5,
        px: 3,
        textAlign:  'center',
        cursor:     'pointer',
        bgcolor:    isDragActive ? 'action.hover' : 'transparent',
        transition: 'all 0.2s',
        '&:hover':  { borderColor: 'primary.main', bgcolor: 'action.hover' },
      }}
    >
      <input {...getInputProps()} />
      <UploadFileIcon sx={{ fontSize: 48, color: 'text.disabled', mb: 1 }} />
      <Typography variant="body1" color="text.secondary" fontWeight={500}>
        {isDragActive ? 'Drop files here…' : 'Drag & drop files, or click to select'}
      </Typography>
      <Typography variant="caption" color="text.disabled">
        PNG, JPG, PDF, XLS, XLSX, DOC, DOCX, CSV, TXT, MP4
      </Typography>
    </Box>
  );
}
