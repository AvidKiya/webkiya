import logoLight from '../../assets/brand/logo-light.webp';
import logoDark from '../../assets/brand/logo-dark.webp';
import brandProfile from '../../assets/brand/brand-profile.webp';
import { cn } from '../../utils/cn';

export { brandProfile, logoLight, logoDark };

interface LogoProps {
  isDark?: boolean;
  variant?: 'wordmark' | 'avatar' | 'combo';
  size?: 'sm' | 'md' | 'lg';
  showTagline?: boolean;
  className?: string;
}

export function Logo({
  isDark = false,
  variant = 'combo',
  size = 'md',
  showTagline = false,
  className,
}: LogoProps) {
  if (variant === 'avatar') {
    const avatarDims = {
      sm: 'w-9 h-9',
      md: 'w-11 h-11',
      lg: 'w-20 h-20',
    }[size];
    return (
      <div
        className={cn(
          'rounded-full overflow-hidden ring-2 ring-gold-500/40 bg-[#482780] shrink-0 flex items-center justify-center',
          avatarDims,
          className
        )}
      >
        <img
          src={brandProfile}
          alt="آواتار رسمی کیا — KIYA"
          className="w-full h-full object-contain"
        />
      </div>
    );
  }

  if (variant === 'wordmark') {
    const wordDims = {
      sm: 'h-9 w-24',
      md: 'h-11 w-28',
      lg: 'h-16 w-40',
    }[size];
    return (
      <div className={cn('flex items-center justify-center shrink-0 p-1', wordDims, className)}>
        <img
          src={isDark ? logoDark : logoLight}
          alt="نشان رسمی کیا — KIYA"
          className="max-h-full max-w-full object-contain"
        />
      </div>
    );
  }

  return (
    <div className={cn('flex items-center gap-2.5 shrink-0', className)}>
      <div
        className={cn(
          'rounded-xl overflow-hidden bg-[#482780] border border-gold-500/35 shadow-e1 shrink-0 flex items-center justify-center',
          size === 'sm' ? 'w-9 h-9' : size === 'lg' ? 'w-12 h-12' : 'w-10 h-10'
        )}
      >
        <img
          src={brandProfile}
          alt="کیا — KIYA"
          className="w-full h-full object-contain"
        />
      </div>
      <div className="flex flex-col leading-tight">
        <div className="flex items-center gap-1.5">
          <span
            className={cn(
              'font-extrabold text-ink-900 tracking-tight',
              size === 'sm' ? 'text-base' : size === 'lg' ? 'text-xl' : 'text-[17px]'
            )}
          >
            کیا
          </span>
          <span className="text-[11px] font-bold tracking-widest text-gold-text bg-brand-50 px-1.5 py-0.5 rounded-md border border-brand-200/70">
            <bdi>KIYA</bdi>
          </span>
        </div>
        {showTagline && (
          <span className="text-[11px] text-ink-500 font-medium mt-0.5">
            هر روز جدید، بدون واسطه
          </span>
        )}
      </div>
    </div>
  );
}
