import React from 'react';

interface BukkitLogoProps {
  variant?: 'full' | 'icon' | 'badge' | 'horizontal';
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl';
  className?: string;
  theme?: 'dark' | 'light' | 'color';
}

export const BukkitLogo: React.FC<BukkitLogoProps> = ({
  variant = 'full',
  size = 'md',
  className = '',
  theme = 'color',
}) => {
  const sizeMap = {
    xs: { icon: 24, text: 'text-xs', sub: 'text-[7px]' },
    sm: { icon: 32, text: 'text-sm', sub: 'text-[9px]' },
    md: { icon: 40, text: 'text-lg', sub: 'text-[10px]' },
    lg: { icon: 54, text: 'text-2xl', sub: 'text-xs' },
    xl: { icon: 72, text: 'text-3xl', sub: 'text-sm' },
  };

  const currentSize = sizeMap[size] || sizeMap.md;

  // The BUKKIT Icon SVG containing the speed 'B' with fork cutout, chef's hat & delivery trails
  const IconSvg = (
    <svg
      width={currentSize.icon}
      height={currentSize.icon}
      viewBox="0 0 100 100"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className="shrink-0 transition-transform group-hover:scale-105 duration-300 drop-shadow-xs"
    >
      <defs>
        <linearGradient id="bukkitGreenGrad" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#0F5A35" />
          <stop offset="100%" stopColor="#08361E" />
        </linearGradient>
        <linearGradient id="bukkitOrangeGrad" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#FF7A00" />
          <stop offset="100%" stopColor="#E65100" />
        </linearGradient>
        <filter id="bukkitGlow" x="-20%" y="-20%" width="140%" height="140%">
          <feDropShadow dx="0" dy="2" stdDeviation="3" floodColor="#FF7A00" floodOpacity="0.3" />
        </filter>
      </defs>

      {/* Speed Streaks (Motion Trails) */}
      <rect x="8" y="32" width="18" height="5" rx="2.5" fill="url(#bukkitOrangeGrad)" />
      <rect x="3" y="42" width="23" height="5.5" rx="2.75" fill="url(#bukkitOrangeGrad)" />
      <rect x="8" y="53" width="18" height="5" rx="2.5" fill="#0F5A35" />
      <rect x="14" y="64" width="12" height="4.5" rx="2.25" fill="#0F5A35" />

      {/* Top Orange Curved Hood / Cloche */}
      <path
        d="M32 26C32 20 48 10 65 10C78 10 88 17 88 26L32 26Z"
        fill="url(#bukkitOrangeGrad)"
      />
      <circle cx="65" cy="8" r="3.5" fill="url(#bukkitOrangeGrad)" />

      {/* Main Stylized 'B' Body in Emerald Green */}
      <path
        d="M26 26C26 23.5 28 21.5 30.5 21.5H62C74 21.5 82 28 82 38C82 44.5 77 49.5 70 51.5C79 53.5 85 60 85 69C85 81 74 88 59 88H30.5C28 88 26 86 26 83.5V26Z"
        fill="url(#bukkitGreenGrad)"
      />

      {/* Top Counter Cutout of 'B' */}
      <path
        d="M44 32H58C63.5 32 67 35 67 39.5C67 44 63.5 47 58 47H44V32Z"
        fill="#FFFFFF"
      />

      {/* Bottom Counter Cutout of 'B' with Negative Space Fork */}
      <path
        d="M44 56H60C66 56 70 59.5 70 65C70 70.5 66 74 60 74H44V56Z"
        fill="#FFFFFF"
      />

      {/* Fork Silhouette Cutout inside the lower bowl */}
      <path
        d="M52 74V65C52 64 53 63 54 63C55 63 56 64 56 65V74H52Z"
        fill="#0F5A35"
      />
      <path
        d="M50 60V64H51V60H50ZM53 60V64H54V60H53ZM56 60V64H57V60H56Z"
        fill="#0F5A35"
      />

      {/* Location / Delivery Accent Dot */}
      <circle cx="78" cy="48" r="4.5" fill="#FF7A00" filter="url(#bukkitGlow)" />
    </svg>
  );

  if (variant === 'icon') {
    return <div className={`inline-flex items-center justify-center ${className}`}>{IconSvg}</div>;
  }

  if (variant === 'badge') {
    return (
      <div
        className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-2xl bg-white shadow-xs border border-emerald-100 ${className}`}
      >
        {IconSvg}
        <div className="text-left">
          <div className="flex items-center gap-1">
            <span className="font-black text-[#0D472B] tracking-tight leading-none text-base">
              BUKKIT
            </span>
            <span className="text-[9px] font-black bg-[#FF7A00] text-white px-1.5 py-0.2 rounded-md">
              INT
            </span>
          </div>
          <span className="text-[8px] font-bold text-slate-500 tracking-wider uppercase block">
            CAMPUS FOOD FAST
          </span>
        </div>
      </div>
    );
  }

  // Default / Horizontal Variant
  return (
    <div className={`inline-flex items-center gap-2.5 ${className}`}>
      <div className="relative flex items-center justify-center p-1 rounded-2xl bg-emerald-950/5 border border-emerald-900/10 shadow-2xs">
        {IconSvg}
      </div>

      <div className="flex flex-col text-left">
        <div className="flex items-center gap-1.5">
          <span
            className={`font-black tracking-tight leading-none ${currentSize.text} ${
              theme === 'light' ? 'text-white' : 'text-[#0D472B]'
            }`}
          >
            BUKKIT
          </span>
          <span className="bg-[#FF7A00] text-white text-[9px] font-extrabold px-1.5 py-0.5 rounded-sm tracking-wide shadow-2xs">
            INT
          </span>
        </div>
        <div className="flex items-center gap-1 mt-0.5">
          <span className="w-1 h-1 rounded-full bg-[#FF7A00]" />
          <span
            className={`font-bold uppercase tracking-widest leading-none ${currentSize.sub} ${
              theme === 'light' ? 'text-emerald-200' : 'text-[#FF7A00]'
            }`}
          >
            GOOD FOOD • DELIVERED FAST
          </span>
        </div>
      </div>
    </div>
  );
};
