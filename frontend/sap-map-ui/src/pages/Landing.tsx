import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { VITE_APP_NAME } from '../features/config';

export default function Landing() {
  const navigate = useNavigate();

  return (
    <div className="flex h-screen overflow-hidden bg-background">
      {/* Left: video */}
      <video
        src=""
        autoPlay muted loop playsInline
        className="flex-1 h-full object-cover bg-[#0d1117]"
      />

      {/* Right: CTA */}
      <div className="w-[420px] shrink-0 flex flex-col items-center justify-center px-8 text-center bg-gradient-to-b from-[#0d1117] to-[#161b22]">
        <h1 className="text-4xl font-bold text-primary mb-3">{VITE_APP_NAME}</h1>
        <p className="text-muted-foreground mb-10">SAP B1 data visualized on interactive maps</p>
        <Button size="lg" className="w-full text-lg py-6" onClick={() => navigate('/signin')}>
          Sign In
        </Button>
      </div>
    </div>
  );
}
