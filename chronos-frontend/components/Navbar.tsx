'use client';

import Link from 'next/link';
import { useState } from 'react';
import { useUser, PREDEFINED_USERS } from '@/contexts/UserContext';

export default function Navbar() {
  const { user, setUser } = useUser();
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);

  const handleUserChange = (userId: string) => {
    const selectedUser = PREDEFINED_USERS.find(u => u.id === userId);
    if (selectedUser) {
      setUser(selectedUser);
      setIsDropdownOpen(false);
    }
  };

  return (
    <nav className="bg-gradient-to-r from-gray-900 to-gray-800 text-white shadow-lg">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          <div className="flex items-center">
            <Link href="/" className="flex items-center">
              <span className="text-2xl font-bold tracking-wider">CHRONOS</span>
              <span className="ml-2 text-xs text-gray-400 hidden sm:block">
                LUXURY TIMEPIECES
              </span>
            </Link>
          </div>

          <div className="flex items-center gap-6">
            <Link
              href="/"
              className="text-gray-300 hover:text-white transition-colors duration-200"
            >
              Home
            </Link>

            <div className="relative">
              <button
                onClick={() => setIsDropdownOpen(!isDropdownOpen)}
                className="flex items-center gap-2 px-4 py-2 bg-gray-700 hover:bg-gray-600 rounded-lg transition-colors duration-200"
              >
                <svg
                  className="w-5 h-5"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"
                  />
                </svg>
                <span className="hidden sm:inline">{user?.name || 'Select User'}</span>
                <svg
                  className={`w-4 h-4 transition-transform ${
                    isDropdownOpen ? 'rotate-180' : ''
                  }`}
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M19 9l-7 7-7-7"
                  />
                </svg>
              </button>

              {isDropdownOpen && (
                <div className="absolute right-0 mt-2 w-48 bg-white rounded-lg shadow-xl py-1 z-50">
                  {PREDEFINED_USERS.map((u) => (
                    <button
                      key={u.id}
                      onClick={() => handleUserChange(u.id)}
                      className={`block w-full text-left px-4 py-2 text-sm transition-colors ${
                        user?.id === u.id
                          ? 'bg-gray-100 text-gray-900 font-semibold'
                          : 'text-gray-700 hover:bg-gray-50'
                      }`}
                    >
                      {u.name}
                      {u.id !== 'guest' && (
                        <span className="text-xs text-gray-500 ml-2">({u.id})</span>
                      )}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </nav>
  );
}
