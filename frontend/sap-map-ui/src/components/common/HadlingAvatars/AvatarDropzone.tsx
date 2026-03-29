import { useDropzone } from 'react-dropzone';
import { ImageIcon } from 'lucide-react';
import { cn } from '@/lib/utils';

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
    <div
      {...getRootProps()}
      className={cn(
        'w-full border-2 border-dashed rounded-lg text-center cursor-pointer transition-colors',
        compact ? 'py-3 px-2' : 'py-8 px-4',
        isDragActive
          ? 'border-primary bg-primary/5'
          : 'border-border hover:border-primary hover:bg-accent'
      )}
    >
      <input {...getInputProps()} />
      <ImageIcon className={cn('mx-auto mb-1 text-muted-foreground', compact ? 'h-7 w-7' : 'h-9 w-9')} />
      <p className={cn('text-muted-foreground', compact ? 'text-xs' : 'text-sm')}>
        {isDragActive
          ? (compact ? 'Drop image here…' : 'Drop the image here…')
          : (compact ? 'Drag & drop or click' : 'Drag & drop an image, or click to select')}
      </p>
      {!compact && <p className="text-xs text-muted-foreground/60 mt-1">PNG, JPG, GIF, WebP</p>}
    </div>
  );
}
