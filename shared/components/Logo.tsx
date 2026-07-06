import { Droplets } from 'lucide-react';

interface LogoProps {
  size?: 'sm' | 'md' | 'lg';
  showText?: boolean;
}

export function Logo({ size = 'md', showText = true }: LogoProps) {
  const iconSizes = {
    sm: 'w-6 h-6',
    md: 'w-8 h-8',
    lg: 'w-12 h-12',
  };

  const textSizes = {
    sm: 'text-lg',
    md: 'text-2xl',
    lg: 'text-4xl',
  };

  return (
    <div className="flex items-center gap-2">
      <div className="water-gradient rounded-xl p-2">
        <Droplets className={`${iconSizes[size]} text-primary-foreground`} />
      </div>
      {showText && (
        <span className={`${textSizes[size]} font-bold water-gradient-text`}>
          Purifies
        </span>
      )}
    </div>
  );
}
