import { useState } from 'react';
import { useSelector, useDispatch } from 'react-redux';
import { Eye, EyeOff, Loader2, Type, ImageIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { toast } from 'react-toastify';
import { updateProfile } from '../../features/auth/authSlice';
import type { RootState, AppDispatch } from '../../app/store';
import AvatarDropzone from '../../components/common/HadlingAvatars/AvatarDropzone';
import AvatarCropDialog from '../../components/common/HadlingAvatars/AvatarCropDialog';

export default function UserAccount() {
  const dispatch = useDispatch<AppDispatch>();
  const user     = useSelector((state: RootState) => state.auth.user);

  const [name, setName]   = useState(user?.name ?? 'Admin User');
  const [email, setEmail] = useState(user?.email ?? 'admin@example.com');
  const [avatarMode, setAvatarMode] = useState<'letter' | 'image'>(user?.avatar_mode ?? 'letter');
  const [savedAvatar, setSavedAvatar] = useState<string | null>(user?.avatar_base64 ?? null);
  const [editorOpen, setEditorOpen] = useState(false);
  const [cropImage, setCropImage]   = useState<string | null>(null);
  const [showPassword, setShowPassword] = useState(false);
  const [saving, setSaving] = useState(false);

  const handleModeChange = (value: 'letter' | 'image') => {
    setAvatarMode(value);
    if (value === 'letter') setSavedAvatar(null);
  };

  const openCropWith = (img: string) => { setCropImage(img); setEditorOpen(true); };

  const handleSave = async () => {
    setSaving(true);
    try {
      await dispatch(updateProfile({
        name, email,
        avatar_mode:   avatarMode,
        avatar_base64: avatarMode === 'image' ? savedAvatar : null,
      })).unwrap();
      toast.success('Profile saved successfully.');
    } catch (err: unknown) {
      const detail = (err as { detail?: string })?.detail;
      toast.error(detail ?? 'Failed to save profile.');
    } finally {
      setSaving(false);
    }
  };

  const initials = name[0]?.toUpperCase() ?? 'A';

  return (
    <div>
      <h1 className="text-3xl font-bold mb-6">My Account</h1>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">

        {/* ── Left: profile card ── */}
        <div className="rounded-lg border border-border bg-card p-6 text-center space-y-4">

          {/* Mode toggle */}
          <div className="flex rounded-md border border-border overflow-hidden text-xs w-fit mx-auto">
            {(['letter', 'image'] as const).map((mode) => (
              <button
                key={mode}
                type="button"
                onClick={() => handleModeChange(mode)}
                className={cn(
                  'flex items-center gap-1.5 px-3 py-1.5 transition-colors',
                  avatarMode === mode ? 'bg-primary text-primary-foreground' : 'hover:bg-muted text-muted-foreground'
                )}
              >
                {mode === 'letter' ? <Type className="h-3.5 w-3.5" /> : <ImageIcon className="h-3.5 w-3.5" />}
                {mode === 'letter' ? 'Letter' : 'Image'}
              </button>
            ))}
          </div>

          {/* Avatar preview */}
          {avatarMode === 'letter' ? (
            <Avatar className="w-24 h-24 mx-auto text-3xl bg-primary text-primary-foreground">
              <AvatarFallback className="text-3xl bg-primary text-primary-foreground">{initials}</AvatarFallback>
            </Avatar>
          ) : savedAvatar ? (
            <div className="flex flex-col items-center gap-2">
              <Avatar className="w-24 h-24 mx-auto">
                <AvatarImage src={savedAvatar} alt="Avatar" />
                <AvatarFallback>{initials}</AvatarFallback>
              </Avatar>
              <Button size="sm" variant="outline" onClick={() => openCropWith(savedAvatar)}>
                Change photo
              </Button>
            </div>
          ) : (
            <AvatarDropzone onFile={openCropWith} />
          )}

          <div>
            <p className="font-semibold text-lg">{name}</p>
            <p className="text-sm text-muted-foreground mt-0.5">{email}</p>
          </div>
          <Badge variant="default">{user?.role ?? 'admin'}</Badge>
        </div>

        {/* ── Right: settings form ── */}
        <div className="md:col-span-2 rounded-lg border border-border bg-card p-6">
          <h2 className="text-lg font-semibold mb-1">Profile Settings</h2>
          <hr className="border-border mb-5" />

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label htmlFor="name">Full Name</Label>
              <Input id="name" value={name} onChange={(e) => setName(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="email">Email</Label>
              <Input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="role">Role</Label>
              <Input id="role" value={user?.role ?? 'admin'} disabled />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="password">New Password</Label>
              <div className="relative">
                <Input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  placeholder="Leave blank to keep current"
                  className="pr-10"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((s) => !s)}
                  onMouseDown={(e) => e.preventDefault()}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>

            <div className="sm:col-span-2 pt-2">
              <Button onClick={handleSave} disabled={saving}>
                {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Save Changes'}
              </Button>
            </div>
          </div>
        </div>
      </div>

      <AvatarCropDialog
        open={editorOpen}
        onClose={() => setEditorOpen(false)}
        onApply={(base64) => setSavedAvatar(base64)}
        image={cropImage}
        title="Edit Profile Photo"
      />
    </div>
  );
}
