import React from 'react';
import DELFILANDIA_LOGO_SRC from '../assets/images/delfilandia_official_logo_1786979436790.jpg';

export { DELFILANDIA_LOGO_SRC };

interface DelfilandiaWordmarkProps {
  className?: string;
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl' | '2xl' | 'hero';
  showSlogan?: boolean;
  sloganClassName?: string;
  lightModeForce?: boolean; // For white background cards / receipts
}

/**
 * DELFILÂNDIA Wordmark matching brand identity:
 * - "DELFI" in deep cobalt blue (#084b8a / #004b87)
 * - "LÂNDIA" in vibrant warm orange (#ea7617 / #f07c10)
 */
export const DelfilandiaWordmark: React.FC<DelfilandiaWordmarkProps> = ({
  className = '',
  size = 'md',
  showSlogan = false,
  sloganClassName = '',
  lightModeForce = false,
}) => {
  const sizeClasses = {
    xs: 'text-sm font-black tracking-tight',
    sm: 'text-base sm:text-lg font-black tracking-tight',
    md: 'text-lg sm:text-xl font-black tracking-tight',
    lg: 'text-2xl sm:text-3xl font-black tracking-tight',
    xl: 'text-3xl sm:text-4xl font-black tracking-tight',
    '2xl': 'text-4xl sm:text-5xl font-black tracking-tight',
    hero: 'text-3xl sm:text-5xl lg:text-6xl font-black tracking-tight',
  };

  const blueColor = lightModeForce 
    ? 'text-[#084b8a]' 
    : 'text-[#084b8a] dark:text-[#38bdf8]';

  const orangeColor = lightModeForce 
    ? 'text-[#ea7617]' 
    : 'text-[#ea7617] dark:text-[#fb923c]';

  return (
    <div className={`inline-flex flex-col ${className}`}>
      <span className={`select-none inline-flex items-baseline ${sizeClasses[size]}`}>
        <span className={`${blueColor} drop-shadow-sm transition-colors`}>
          DELFI
        </span>
        <span className={`${orangeColor} drop-shadow-sm transition-colors`}>
          LÂNDIA
        </span>
      </span>
      {showSlogan && (
        <span className={`text-slate-400 font-medium text-xs sm:text-sm tracking-normal ${sloganClassName}`}>
          Um mundo de produtos à sua porta
        </span>
      )}
    </div>
  );
};

interface DelfilandiaBrandProps {
  logoSize?: 'sm' | 'md' | 'lg' | 'xl' | 'hero';
  textSize?: 'xs' | 'sm' | 'md' | 'lg' | 'xl' | '2xl' | 'hero';
  showSlogan?: boolean;
  showAngolaBadge?: boolean;
  className?: string;
  onClick?: () => void;
  orientation?: 'horizontal' | 'vertical';
  lightModeForce?: boolean;
}

/**
 * Combines the official circular slogan emblem image with the dual-color wordmark
 */
export const DelfilandiaBrand: React.FC<DelfilandiaBrandProps> = ({
  logoSize = 'md',
  textSize = 'md',
  showSlogan = true,
  showAngolaBadge = true,
  className = '',
  onClick,
  orientation = 'horizontal',
  lightModeForce = false,
}) => {
  const logoDimensions = {
    sm: 'w-8 h-8 sm:w-9 sm:h-9',
    md: 'w-10 h-10 sm:w-12 sm:h-12',
    lg: 'w-14 h-14 sm:w-16 sm:h-16',
    xl: 'w-20 h-20 sm:w-24 sm:h-24',
    hero: 'w-24 h-24 sm:w-32 sm:h-32 md:w-36 md:h-36',
  };

  const isVertical = orientation === 'vertical';

  return (
    <div
      onClick={onClick}
      className={`inline-flex ${isVertical ? 'flex-col items-center text-center' : 'items-center'} gap-3 ${onClick ? 'cursor-pointer hover:opacity-95' : ''} ${className}`}
    >
      {/* Slogan Logo Badge */}
      <div className={`${logoDimensions[logoSize]} rounded-full overflow-hidden border-2 border-amber-400/90 shadow-lg flex items-center justify-center bg-white shrink-0 p-0.5 ring-2 ring-blue-500/20`}>
        <img
          src={DELFILANDIA_LOGO_SRC}
          alt="DELFILÂNDIA - Um mundo de produtos à sua porta"
          className="w-full h-full object-contain rounded-full"
          referrerPolicy="no-referrer"
          onError={(e) => {
            (e.currentTarget as HTMLImageElement).src = '/logo.jpg';
          }}
        />
      </div>

      {/* Wordmark and Subtitle */}
      <div className={isVertical ? 'flex flex-col items-center' : 'flex flex-col'}>
        <div className="flex items-center gap-2">
          <DelfilandiaWordmark
            size={textSize}
            lightModeForce={lightModeForce}
          />
          {showAngolaBadge && (
            <span className="text-[10px] sm:text-xs px-1.5 py-0.5 rounded-full bg-blue-500/20 text-blue-300 font-bold border border-blue-500/30 shrink-0">
              🇦🇴 Angola
            </span>
          )}
        </div>
        {showSlogan && (
          <p className={`text-xs text-slate-300 font-medium ${isVertical ? 'mt-1' : ''}`}>
            Um mundo de produtos à sua porta
          </p>
        )}
      </div>
    </div>
  );
};
