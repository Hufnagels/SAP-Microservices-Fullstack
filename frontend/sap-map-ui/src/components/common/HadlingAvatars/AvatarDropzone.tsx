/*
 * components/common/AvatarDropzone.tsx
 * ─────────────────────────────────────────────────────────────────────────────
 * Purpose : Reusable drag-and-drop image upload area for avatar selection.
 *           Extracted from UserAccount.tsx and Users.tsx to remove duplication.
 *
 * Used by : pages/users/UserAccount.tsx, pages/users/Users.tsx,
 *           components/common/AvatarCropDialog.tsx (compact variant inside dialog)
 *
 * Props
 *   onFile  – callback fired with an object URL of the dropped/selected file
 *   compact – when true renders with reduced padding and smaller icon for use
 *             inside dialogs; default false
 */
import { useDropzone } from 'react-dropzone';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import ImageIcon from '@mui/icons-material/Image';

interface AvatarDropzoneProps {
  onFile: (objectUrl: string) => void;
  compact?: boolean;
}

export default function AvatarDropzone({ onFile, compact = false }: AvatarDropzoneProps) {
  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    accept: { 'image/*': [] },
    maxFiles: 1,
    onDrop: (accepted) => {
      if (accepted[0]) onFile(URL.createObjectURL(accepted[0]));
    },
  });

  return (
    <Box
      {...getRootProps()}
      sx={{
        width: '100%',
        border: '2px dashed',
        borderColor: isDragActive ? 'primary.main' : 'divider',
        borderRadius: 2,
        py: compact ? 2 : 4,
        px: compact ? 1 : 2,
        textAlign: 'center',
        cursor: 'pointer',
        bgcolor: isDragActive ? 'action.hover' : 'transparent',
        transition: 'all 0.2s',
        '&:hover': { borderColor: 'primary.main', bgcolor: 'action.hover' },
      }}
    >
      <input {...getInputProps()} />
      <ImageIcon sx={{ fontSize: compact ? 32 : 40, color: 'text.disabled', mb: compact ? 0.5 : 1 }} />
      <Typography variant={compact ? 'caption' : 'body2'} color="text.secondary" display="block">
        {isDragActive
          ? (compact ? 'Drop image here…' : 'Drop the image here…')
          : (compact ? 'Drag & drop or click to upload' : 'Drag & drop an image, or click to select')}
      </Typography>
      {!compact && (
        <Typography variant="caption" color="text.disabled">
          PNG, JPG, GIF, WebP
        </Typography>
      )}
    </Box>
  );
}
