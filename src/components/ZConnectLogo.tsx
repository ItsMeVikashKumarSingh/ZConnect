import React from 'react';

interface ZConnectLogoProps {
  className?: string;
  size?: number;
  showText?: boolean;
  textClassName?: string;
}

export function ZConnectLogo({ className = '', size = 32, showText = false, textClassName = '' }: ZConnectLogoProps) {
  return (
    <div className={`flex items-center gap-2.5 ${className}`}>
      <svg
        width={size}
        height={size}
        viewBox="0 0 200 200"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className="transition-all duration-300 transform hover:scale-105"
      >
        {/* Futuristic connection nodes forming Z */}
        <circle cx="45" cy="45" r="25" fill="#D4A017" className="animate-pulse" /> {/* Gold Top-Left Node */}
        <circle cx="155" cy="155" r="25" fill="var(--primary-accent)" /> {/* Accent Bottom-Right Node */}
        <circle cx="155" cy="45" r="18" fill="var(--primary-accent)" opacity="0.8" /> {/* Accent Top-Right Node */}
        <circle cx="45" cy="155" r="18" fill="#D4A017" opacity="0.8" /> {/* Gold Bottom-Left Node */}
        
        {/* Sleek connection tracks */}
        <path
          d="M45 45 L155 45 L45 155 L155 155"
          stroke="currentColor"
          strokeWidth="16"
          strokeLinecap="round"
          strokeLinejoin="round"
          className="text-foreground/80 dark:text-foreground/90 transition-colors"
        />
        
        {/* Accent inner highlights */}
        <path
          d="M45 45 L155 45 L100 100"
          stroke="#D4A017"
          strokeWidth="6"
          strokeLinecap="round"
        />
        <path
          d="M100 100 L45 155 L155 155"
          stroke="var(--primary-accent)"
          strokeWidth="6"
          strokeLinecap="round"
        />
      </svg>
      {showText && (
        <span className={`font-bold tracking-wide text-xl font-sans ${textClassName}`}>
          Z<span className="text-gold-accent">Connect</span>
        </span>
      )}
    </div>
  );
}
