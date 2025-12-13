'use client';

import Link from 'next/link';
import { useState } from 'react';
import { useUser, PREDEFINED_USERS } from '@/contexts/UserContext';

export default function Navbar() {
  const { user, setUser, isAdmin } = useUser();
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);

  const handleUserChange = (userId: string) => {
    const selectedUser = PREDEFINED_USERS.find(u => u.id === userId);
    if (selectedUser) {
      setUser(selectedUser);
      setIsDropdownOpen(false);
    }
  };

  return (
    <nav className="bg-[#0a0a0a] border-b border-[#1a1a1a] sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-20">
          {/* Logo */}
          <Link href="/" className="flex items-center gap-3 group">
            <div className="w-10 h-10 rounded-full border border-[#d4af37]/30 flex items-center justify-center group-hover:border-[#d4af37]/60 transition-colors">
              <svg className="w-5 h-5 text-[#d4af37]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <circle cx="12" cy="12" r="10" strokeWidth="1.5" />
                <path strokeLinecap="round" strokeWidth="1.5" d="M12 6v6l4 2" />
              </svg>
            </div>
            <div>
              <span className="font-display text-xl text-white tracking-wider">CHRONOS</span>
              <span className="hidden sm:block text-[10px] text-[#666666] tracking-[0.2em] uppercase">
                Luxury Timepieces
              </span>
            </div>
          </Link>

          {/* Navigation */}
          <div className="flex items-center gap-8">
            <Link
              href="/"
              className="text-[#808080] hover:text-[#d4af37] transition-colors duration-300 text-sm tracking-wide"
            >
              Collection
            </Link>
            {user && user.id !== 'guest' && user.id !== 'admin' && (
              <>
                <Link
                  href="/orders"
                  className="text-[#808080] hover:text-[#d4af37] transition-colors duration-300 text-sm tracking-wide"
                >
                  Orders
                </Link>
                <Link
                  href="/wishlist"
                  className="text-[#808080] hover:text-[#d4af37] transition-colors duration-300 text-sm tracking-wide"
                >
                  Wishlist
                </Link>
              </>
            )}

            {/* User Selector */}
            <div className="relative">
              <button
                onClick={() => setIsDropdownOpen(!isDropdownOpen)}
                className="flex items-center gap-3 px-4 py-2 border border-[#2a2a2a] hover:border-[#d4af37]/30 transition-all duration-300 group"
              >
                <div className={`w-8 h-8 rounded-full flex items-center justify-center ${
                  isAdmin
                    ? 'bg-[#d4af37]/20 border border-[#d4af37]/50'
                    : 'bg-[#1a1a1a] border border-[#2a2a2a]'
                }`}>
                  {isAdmin ? (
                    <svg className="w-4 h-4 text-[#d4af37]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                    </svg>
                  ) : (
                    <svg className="w-4 h-4 text-[#666666] group-hover:text-[#d4af37] transition-colors" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                    </svg>
                  )}
                </div>
                <div className="hidden sm:block text-left">
                  <p className="text-white text-sm">{user?.name || 'Select User'}</p>
                  <p className="text-[#666666] text-xs">
                    {isAdmin ? 'Administrator' : 'Customer'}
                  </p>
                </div>
                <svg
                  className={`w-4 h-4 text-[#666666] transition-transform duration-300 ${
                    isDropdownOpen ? 'rotate-180' : ''
                  }`}
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M19 9l-7 7-7-7" />
                </svg>
              </button>

              {/* Dropdown */}
              {isDropdownOpen && (
                <>
                  {/* Backdrop */}
                  <div
                    className="fixed inset-0 z-40"
                    onClick={() => setIsDropdownOpen(false)}
                  />

                  {/* Menu */}
                  <div className="absolute right-0 mt-2 w-64 bg-[#111111] border border-[#2a2a2a] shadow-2xl z-50 overflow-hidden">
                    <div className="px-4 py-3 border-b border-[#2a2a2a]">
                      <p className="text-[10px] text-[#666666] tracking-[0.2em] uppercase">Switch Account</p>
                    </div>
                    <div className="py-2">
                      {PREDEFINED_USERS.map((u) => (
                        <button
                          key={u.id}
                          onClick={() => handleUserChange(u.id)}
                          className={`w-full text-left px-4 py-3 flex items-center gap-3 transition-all duration-200 ${
                            user?.id === u.id
                              ? 'bg-[#d4af37]/10 border-l-2 border-[#d4af37]'
                              : 'hover:bg-[#1a1a1a] border-l-2 border-transparent'
                          }`}
                        >
                          <div className={`w-8 h-8 rounded-full flex items-center justify-center ${
                            u.id === 'admin'
                              ? 'bg-[#d4af37]/20 border border-[#d4af37]/50'
                              : 'bg-[#1a1a1a] border border-[#2a2a2a]'
                          }`}>
                            {u.id === 'admin' ? (
                              <svg className="w-4 h-4 text-[#d4af37]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                              </svg>
                            ) : (
                              <span className="text-xs text-[#808080] font-medium">
                                {u.name.charAt(0)}
                              </span>
                            )}
                          </div>
                          <div>
                            <p className={`text-sm ${user?.id === u.id ? 'text-[#d4af37]' : 'text-white'}`}>
                              {u.name}
                            </p>
                            <p className="text-xs text-[#666666]">
                              {u.id === 'admin' ? 'Administrator' : u.id}
                            </p>
                          </div>
                          {user?.id === u.id && (
                            <svg className="w-4 h-4 text-[#d4af37] ml-auto" fill="currentColor" viewBox="0 0 20 20">
                              <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                            </svg>
                          )}
                        </button>
                      ))}
                    </div>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      </div>
    </nav>
  );
}
