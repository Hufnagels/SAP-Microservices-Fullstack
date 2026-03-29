import { useRef, useState, useCallback, useEffect } from 'react';
import AvatarEditor from 'react-avatar-editor';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';
import AvatarDropzone from './AvatarDropzone';

interface AvatarCropDialogProps {
  open: boolean;
  onClose: () => void;
  onApply: (base64: string) => void;
  image?: string | null;
  title?: string;
}

export default function AvatarCropDialog({
  open, onClose, onApply, image, title = 'Edit Photo',
}: AvatarCropDialogProps) {
  const editorRef = useRef<AvatarEditor>(null);
  const [pendingFile, setPendingFile] = useState<string | null>(null);
  const [scale, setScale]             = useState(1.2);
  const [rotate, setRotate]           = useState(0);

  useEffect(() => {
    if (open) { setPendingFile(null); setScale(1.2); setRotate(0); }
  }, [open]);

  const currentImage = pendingFile ?? image ?? null;

  const handleApply = useCallback(() => {
    if (!editorRef.current) return;
    const base64 = editorRef.current.getImageScaledToCanvas().toDataURL('image/png');
    onApply(base64);
    onClose();
  }, [onApply, onClose]);

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent className="max-w-xs">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
        </DialogHeader>

        <div className="flex flex-col items-center gap-5 py-2">
          {currentImage && (
            <AvatarEditor
              ref={editorRef}
              image={currentImage}
              width={240} height={240} border={24} borderRadius={120}
              color={[0, 0, 0, 0.55]}
              scale={scale} rotate={rotate}
              style={{ borderRadius: 8 }}
            />
          )}

          <div className="w-full space-y-1">
            <p className="text-xs text-muted-foreground">Zoom</p>
            <Slider min={1} max={3} step={0.05} value={[scale]} onValueChange={([v]) => setScale(v)} />
          </div>

          <div className="w-full space-y-1">
            <p className="text-xs text-muted-foreground">Rotate</p>
            <Slider min={0} max={360} step={1} value={[rotate]} onValueChange={([v]) => setRotate(v)} />
          </div>

          <AvatarDropzone
            compact
            onFile={(url) => { setPendingFile(url); setScale(1.2); setRotate(0); }}
          />
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button disabled={!currentImage} onClick={handleApply}>Apply</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
