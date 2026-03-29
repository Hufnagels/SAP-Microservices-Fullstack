import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useDispatch, useSelector } from 'react-redux';
import { Eye, EyeOff, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from 'react-toastify';
import { signIn, fetchCurrentUser } from '../features/auth/authSlice';
import type { AppDispatch, RootState } from '../app/store';
import { VITE_APP_NAME, PAGE_SINGIN_SUBTILE } from '../features/config';

export default function SignIn() {
  const dispatch = useDispatch<AppDispatch>();
  const navigate = useNavigate();
  const { loading } = useSelector((state: RootState) => state.auth);
  const [username, setUsername]       = useState('');
  const [password, setPassword]       = useState('');
  const [showPassword, setShowPassword] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await dispatch(signIn({ username, password })).unwrap();
      await dispatch(fetchCurrentUser());
      navigate('/map');
    } catch (err: unknown) {
      const detail = (err as { detail?: string })?.detail;
      toast.error(detail ?? 'Sign in failed');
    }
  };

  return (
    <div className="flex min-h-screen bg-background">

      {/* Left panel — video */}
      <div className="hidden sm:flex relative flex-1 overflow-hidden bg-gray-900 items-center justify-center">
        <video
          autoPlay loop muted playsInline
          className="absolute inset-0 h-full w-full object-cover opacity-70"
        >
          <source src="/demo.mp4" type="video/mp4" />
        </video>
        <div className="absolute bottom-12 left-12 right-12 text-white">
          <h2 className="text-3xl font-bold mb-2">{VITE_APP_NAME}</h2>
          <p className="text-base opacity-80">{PAGE_SINGIN_SUBTILE}</p>
        </div>
      </div>

      {/* Right panel — form */}
      <div className="w-full sm:w-[420px] shrink-0 flex flex-col items-center justify-center px-10 py-12 bg-background">
        <div className="w-full max-w-[340px] space-y-6">
          {/* App icon */}
          <div className="flex justify-center">
            <img src="/app-icon.jpg" alt="App icon" className="w-[200px] h-[200px] rounded-2xl object-cover" />
          </div>

          {/* Heading */}
          <div>
            <h1 className="text-2xl font-bold text-primary">Welcome back</h1>
            <p className="text-sm text-muted-foreground mt-1">Sign in to your account to continue.</p>
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="username">Username</Label>
              <Input
                id="username"
                type="text"
                required
                value={username}
                onChange={(e) => setUsername(e.target.value)}
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="password">Password</Label>
              <div className="relative">
                <Input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
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

            <Button type="submit" className="w-full" size="lg" disabled={loading}>
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Sign In'}
            </Button>
          </form>
        </div>
      </div>
    </div>
  );
}
