'use client';

import React, { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronDown, Check, Search } from 'lucide-react';

export interface SelectOption {
  value: string;
  label: string;
  icon?: React.ElementType;
  description?: string;
}

interface CustomSelectProps {
  options: SelectOption[];
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  disabled?: boolean;
  searchable?: boolean;
  className?: string;
  icon?: React.ElementType;
}

export const CustomSelect: React.FC<CustomSelectProps> = ({
  options = [],
  value,
  onChange,
  placeholder = 'Select option...',
  disabled = false,
  searchable = false,
  className = '',
  icon: Icon,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const containerRef = useRef<HTMLDivElement>(null);

  const selectedOption = options.find((opt) => String(opt.value) === String(value));

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen]);

  const filteredOptions = searchable
    ? options.filter((opt) =>
        opt.label.toLowerCase().includes(searchQuery.toLowerCase()) ||
        opt.description?.toLowerCase().includes(searchQuery.toLowerCase())
      )
    : options;

  const handleSelect = (val: string) => {
    if (disabled) return;
    onChange(val);
    setIsOpen(false);
    setSearchQuery('');
  };

  return (
    <div className={`relative w-full ${className}`} ref={containerRef}>
      {/* Trigger Button */}
      <button
        type="button"
        onClick={() => !disabled && setIsOpen((prev) => !prev)}
        disabled={disabled}
        className={`flex w-full items-center justify-between gap-2 rounded-xl border px-3.5 py-2.5 text-xs transition-all duration-200 cursor-pointer ${
          disabled
            ? 'cursor-not-allowed border-zinc-800/60 bg-zinc-950/40 text-zinc-600'
            : isOpen
            ? 'border-purple-500/60 bg-[#0d0d20] text-zinc-100 shadow-[0_0_15px_rgba(147,51,234,0.15)] ring-1 ring-purple-500/40'
            : 'border-zinc-800 bg-[#0c0c16]/90 text-zinc-300 hover:border-zinc-700 hover:bg-[#121222]'
        }`}
      >
        <div className="flex min-w-0 items-center gap-2">
          {Icon && <Icon className="shrink-0 text-zinc-400 w-3.5 h-3.5" />}
          <span className="truncate font-medium">
            {selectedOption ? selectedOption.label : placeholder}
          </span>
        </div>
        <ChevronDown
          className={`w-3.5 h-3.5 shrink-0 text-zinc-500 transition-transform duration-200 ${
            isOpen ? 'rotate-180 text-purple-400' : ''
          }`}
        />
      </button>

      {/* Dropdown Popover */}
      <AnimatePresence>
        {isOpen && !disabled && (
          <motion.div
            initial={{ opacity: 0, y: -6, scale: 0.98 }}
            animate={{ opacity: 1, y: 4, scale: 1 }}
            exit={{ opacity: 0, y: -6, scale: 0.98 }}
            transition={{ duration: 0.15 }}
            className="absolute left-0 right-0 top-full z-50 overflow-hidden rounded-xl border border-zinc-800 bg-[#090916]/95 p-1 shadow-2xl backdrop-blur-xl ring-1 ring-white/5"
          >
            {searchable && (
              <div className="border-b border-zinc-800/80 p-1.5">
                <div className="flex items-center gap-2 rounded-lg bg-zinc-900/80 px-2.5 py-1.5 border border-zinc-800">
                  <Search className="w-3.5 h-3.5 shrink-0 text-zinc-500" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Filter options..."
                    className="w-full bg-transparent text-xs text-zinc-200 placeholder-zinc-500 focus:outline-none"
                    autoFocus
                  />
                </div>
              </div>
            )}

            <div className="max-h-56 space-y-0.5 overflow-y-auto p-1">
              {filteredOptions.length === 0 ? (
                <div className="px-3 py-2.5 text-center text-xs text-zinc-500">
                  No options found
                </div>
              ) : (
                filteredOptions.map((opt) => {
                  const isSelected = String(opt.value) === String(value);
                  const ItemIcon = opt.icon;
                  return (
                    <button
                      key={opt.value}
                      type="button"
                      onClick={() => handleSelect(opt.value)}
                      className={`flex w-full items-center justify-between rounded-lg px-2.5 py-2 text-xs transition-colors cursor-pointer ${
                        isSelected
                          ? 'bg-purple-600/20 font-semibold text-purple-300'
                          : 'text-zinc-300 hover:bg-zinc-800/60 hover:text-white'
                      }`}
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        {ItemIcon && <ItemIcon className="w-3.5 h-3.5 shrink-0 text-zinc-400" />}
                        <span className="truncate">{opt.label}</span>
                      </div>
                      {isSelected && <Check className="w-3.5 h-3.5 text-purple-400 shrink-0" />}
                    </button>
                  );
                })
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};
