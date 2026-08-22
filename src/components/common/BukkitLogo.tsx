import React from 'react';

export interface BukkitLogoProps {
  variant?: 'full' | 'icon' | 'badge' | 'horizontal' | 'receipt' | 'stacked';
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl' | '2xl';
  className?: string;
  theme?: 'dark' | 'light' | 'color' | 'mono' | 'receipt';
  showSubtitle?: boolean;
  subtitleText?: string;
  onClick?: () => void;
}

/**
 * Official BUKKIT Logo Component
 * Faithfully matches official brand assets:
 * - Chef Hat ('toque') atop 'B'
 * - 3 Orange speed motion trails on left
 * - Slanted 'B' with energetic top gradient and speed/lightning cutout
 * - Heavy italic geometric display wordmark: BUKKIT
 */
export const BukkitIcon: React.FC<{
  size?: number;
  className?: string;
  theme?: 'dark' | 'light' | 'color' | 'mono' | 'receipt';
}> = ({ size = 36, className = '', theme = 'color' }) => {
  const isReceiptOrMono = theme === 'mono' || theme === 'receipt';
  const isLight = theme === 'light';

  // ID generator for unique gradient references
  const gradId = `bkt_${Math.random().toString(36).substring(2, 7)}`;

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 200 200"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={`shrink-0 select-none ${className}`}
      aria-label="BUKKIT Icon"
    >
      <defs>
        <linearGradient id={`${gradId}_speed`} x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" stopColor="#FF4500" />
          <stop offset="100%" stopColor="#FF6A00" />
        </linearGradient>
        <linearGradient id={`${gradId}_glow`} x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stopColor="#FF5A00" />
          <stop offset="55%" stopColor="#FFFFFF" />
          <stop offset="100%" stopColor="#FFFFFF" />
        </linearGradient>
        <filter id={`${gradId}_shadow`} x="-20%" y="-20%" width="140%" height="140%">
          <feDropShadow dx="0" dy="2" stdDeviation="3" floodColor="#FF5A00" floodOpacity="0.4" />
        </filter>
      </defs>

      <g transform="translate(4, 10)">
        {/* 1. Three Orange Speed Motion Trails */}
        <path
          d="M 45 74 L 105 74 C 109 74 112 77 112 81 C 112 85 109 88 105 88 L 45 88 C 40.5 88 37 84.5 37 81 C 37 77.5 40.5 74 45 74 Z"
          fill={isReceiptOrMono ? '#EA580C' : `url(#${gradId}_speed)`}
        />
        <path
          d="M 16 98 L 98 98 C 102 98 105 101 105 105 C 105 109 102 112 98 112 L 16 112 C 11.5 112 8 108.5 8 105 C 8 101.5 11.5 98 16 98 Z"
          fill={isReceiptOrMono ? '#EA580C' : `url(#${gradId}_speed)`}
        />
        <path
          d="M 42 122 L 92 122 C 96 122 99 125 99 129 C 99 133 96 136 92 136 L 42 136 C 37.5 136 34 132.5 34 129 C 34 125.5 37.5 122 42 122 Z"
          fill={isReceiptOrMono ? '#EA580C' : `url(#${gradId}_speed)`}
        />

        {/* 2. Chef's Hat atop B */}
        <g transform="translate(94, 14)">
          {/* Hat Top Puffs */}
          <path
            d="M 12 34 C 4 34 0 26 3 18 C 6 10 15 8 24 11 C 28 3 42 -1 54 5 C 65 10 68 20 66 28 C 74 28 80 35 77 42 C 74 48 66 50 58 48 L 16 48 C 13 44 12 39 12 34 Z"
            fill={isReceiptOrMono ? '#0F172A' : '#FFFFFF'}
            stroke={isReceiptOrMono ? 'none' : '#0F172A'}
            strokeWidth={isReceiptOrMono ? 0 : 1}
          />
          {/* Hat Brim Band */}
          <path
            d="M 18 40 L 68 40 C 72 40 74 43 73 46 L 71 52 C 70 54 68 56 64 56 L 14 56 C 10 56 8 54 9 52 L 11 46 C 12 43 15 40 18 40 Z"
            fill={isReceiptOrMono ? '#0F172A' : '#FFFFFF'}
            stroke={isReceiptOrMono ? 'none' : '#0F172A'}
            strokeWidth={isReceiptOrMono ? 0 : 0.8}
          />
          <path
            d="M 16 46 L 66 46"
            stroke="#FF5A00"
            strokeWidth="2.5"
            strokeLinecap="round"
          />
        </g>

        {/* 3. Slanted Capital 'B' Body */}
        <path
          d="M 104 64 C 100 64 96 68 94 73 L 74 152 C 72 158 77 162 83 162 L 140 162 C 162 162 178 150 181 131 C 183 118 176 108 165 102 C 173 96 177 86 175 77 C 172 64 159 64 142 64 L 104 64 Z"
          fill={isReceiptOrMono ? '#0F172A' : `url(#${gradId}_glow)`}
          stroke={isReceiptOrMono ? '#0F172A' : '#111827'}
          strokeWidth="1.5"
          filter={isReceiptOrMono ? undefined : `url(#${gradId}_shadow)`}
        />

        {/* Top Counter of 'B' */}
        <path
          d="M 118 78 L 138 78 C 146 78 152 82 151 88 C 150 94 144 97 136 97 L 113 97 L 118 78 Z"
          fill={isReceiptOrMono ? '#FFFFFF' : '#111827'}
        />

        {/* Bottom Counter of 'B' */}
        <path
          d="M 108 111 L 137 111 C 147 111 154 116 152 125 C 150 134 142 139 132 139 L 102 139 L 108 111 Z"
          fill={isReceiptOrMono ? '#FFFFFF' : '#111827'}
        />

        {/* Inner Lightning Notch */}
        <polygon
          points="100,84 115,84 105,106 119,106 94,144 102,110 91,110"
          fill={isReceiptOrMono ? '#FFFFFF' : '#111827'}
        />
      </g>
    </svg>
  );
};

export const BukkitLogo: React.FC<BukkitLogoProps> = ({
  variant = 'full',
  size = 'md',
  className = '',
  theme = 'color',
  showSubtitle = true,
  subtitleText = 'CAMPUS FOOD EXPRESS',
  onClick,
}) => {
  const sizeMap = {
    xs: { icon: 22, text: 'text-sm', sub: 'text-[7px]', gap: 'gap-1.5' },
    sm: { icon: 30, text: 'text-lg', sub: 'text-[8.5px]', gap: 'gap-2' },
    md: { icon: 38, text: 'text-2xl', sub: 'text-[10px]', gap: 'gap-2.5' },
    lg: { icon: 50, text: 'text-3xl', sub: 'text-xs', gap: 'gap-3' },
    xl: { icon: 66, text: 'text-4xl', sub: 'text-sm', gap: 'gap-3.5' },
    '2xl': { icon: 84, text: 'text-5xl', sub: 'text-base', gap: 'gap-4' },
  };

  const currentSize = sizeMap[size] || sizeMap.md;

  // Icon only
  if (variant === 'icon') {
    return (
      <div
        onClick={onClick}
        className={`inline-flex items-center justify-center ${className} ${onClick ? 'cursor-pointer' : ''}`}
      >
        <BukkitIcon size={currentSize.icon} theme={theme} />
      </div>
    );
  }

  // Receipt Mode (Print and official invoice headers)
  if (variant === 'receipt') {
    return (
      <div
        onClick={onClick}
        className={`inline-flex items-center ${currentSize.gap} ${className}`}
      >
        <BukkitIcon size={currentSize.icon} theme="receipt" />
        <div className="flex flex-col text-left">
          <div className="flex items-center gap-1.5">
            <span className={`font-black italic tracking-tighter uppercase leading-none font-sans text-slate-900 ${currentSize.text}`}>
              BUKKIT
            </span>
            <span className="bg-[#EA580C] text-white text-[8px] font-black px-1.5 py-0.5 rounded-sm uppercase tracking-wider">
              OFFICIAL
            </span>
          </div>
          {showSubtitle && (
            <span className="text-[9px] font-extrabold uppercase tracking-widest text-slate-500 mt-0.5">
              {subtitleText}
            </span>
          )}
        </div>
      </div>
    );
  }

  // Badge Variant (Encapsulated pill)
  if (variant === 'badge') {
    return (
      <div
        onClick={onClick}
        className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-2xl bg-slate-900 text-white shadow-md border border-slate-800 transition-colors ${className} ${onClick ? 'cursor-pointer hover:bg-slate-800' : ''}`}
      >
        <BukkitIcon size={currentSize.icon} theme="dark" />
        <div className="text-left">
          <div className="flex items-center gap-1.5">
            <span className="font-black italic tracking-tight text-white leading-none text-base">
              BUKKIT
            </span>
            <span className="text-[8px] font-black bg-[#FF5A00] text-white px-1.5 py-0.5 rounded-md">
              EXPRESS
            </span>
          </div>
          {showSubtitle && (
            <span className="text-[8px] font-bold text-slate-400 tracking-wider uppercase block mt-0.5">
              {subtitleText}
            </span>
          )}
        </div>
      </div>
    );
  }

  // Stacked Variant (Centered icon on top of wordmark)
  if (variant === 'stacked') {
    return (
      <div
        onClick={onClick}
        className={`inline-flex flex-col items-center justify-center text-center ${className} ${onClick ? 'cursor-pointer' : ''}`}
      >
        <BukkitIcon size={currentSize.icon * 1.3} theme={theme} />
        <span
          className={`font-black italic tracking-tighter uppercase leading-none mt-2 font-sans ${
            theme === 'light'
              ? 'text-white'
              : 'text-slate-900 dark:text-white'
          } ${currentSize.text}`}
        >
          BUKKIT
        </span>
        {showSubtitle && (
          <span
            className={`font-extrabold uppercase tracking-widest mt-1 ${currentSize.sub} ${
              theme === 'light' ? 'text-rose-100' : 'text-[#FF5A00] dark:text-orange-400'
            }`}
          >
            {subtitleText}
          </span>
        )}
      </div>
    );
  }

  // Default / Horizontal Full Logo
  return (
    <div
      onClick={onClick}
      className={`inline-flex items-center ${currentSize.gap} ${className} ${onClick ? 'cursor-pointer' : ''}`}
    >
      <div className="relative flex items-center justify-center shrink-0">
        <BukkitIcon size={currentSize.icon} theme={theme} />
      </div>

      <div className="flex flex-col text-left">
        <div className="flex items-center gap-1.5">
          <span
            className={`font-black italic tracking-tighter uppercase leading-none font-sans ${
              theme === 'light'
                ? 'text-white'
                : 'text-slate-900 dark:text-white'
            } ${currentSize.text}`}
          >
            BUKKIT
          </span>
          <span className="bg-gradient-to-r from-[#FF4500] to-[#FF6A00] text-white text-[8px] font-black px-1.5 py-0.5 rounded-sm tracking-wide shadow-2xs">
            FOOD
          </span>
        </div>
        {showSubtitle && (
          <div className="flex items-center gap-1 mt-0.5">
            <span className="w-1.5 h-1.5 rounded-full bg-[#FF5A00] shrink-0 animate-pulse" />
            <span
              className={`font-black uppercase tracking-widest leading-none truncate ${currentSize.sub} ${
                theme === 'light'
                  ? 'text-orange-200'
                  : 'text-[#FF5A00] dark:text-orange-400'
              }`}
            >
              {subtitleText}
            </span>
          </div>
        )}
      </div>
    </div>
  );
};
