'use client';

import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { api } from '@/lib/api';

interface User {
  id: string;
  name: string;
  email: string;
}

interface UserContextType {
  user: User | null;
  setUser: (user: User | null) => void;
  logout: () => void;
}

const UserContext = createContext<UserContextType | undefined>(undefined);

const PREDEFINED_USERS: User[] = [
  { id: 'cust_001', name: 'James Bond', email: 'james.bond@mi6.gov.uk' },
  { id: 'cust_002', name: 'Alice Johnson', email: 'alice.johnson@email.com' },
  { id: 'guest', name: 'Guest', email: 'guest@chronos.com' },
];

// Helper to fetch and store JWT token
async function fetchAndStoreToken(user: User) {
  try {
    console.log('🔑 Fetching JWT token for user:', user.id);
    const token = await api.getToken(user.id, user.email);
    console.log('✅ JWT token received and stored');
    localStorage.setItem('chronos_token', token);
  } catch (error) {
    console.error('❌ Failed to fetch JWT token:', error);
  }
}

export function UserProvider({ children }: { children: ReactNode }) {
  const [user, setUserState] = useState<User | null>(null);
  const [isClient, setIsClient] = useState(false);

  useEffect(() => {
    console.log('👤 UserProvider mounted, setting isClient to true');
    setIsClient(true);
    const storedUserId = localStorage.getItem('chronos_userId');
    console.log('💾 Stored userId:', storedUserId);

    if (storedUserId) {
      const foundUser = PREDEFINED_USERS.find(u => u.id === storedUserId);
      if (foundUser) {
        console.log('👤 Found user in localStorage:', foundUser.name);
        setUserState(foundUser);
        fetchAndStoreToken(foundUser);
      }
    } else {
      console.log('👤 No stored user, defaulting to:', PREDEFINED_USERS[0].name);
      setUserState(PREDEFINED_USERS[0]);
      localStorage.setItem('chronos_userId', PREDEFINED_USERS[0].id);
      fetchAndStoreToken(PREDEFINED_USERS[0]);
    }
  }, []);

  const setUser = (newUser: User | null) => {
    console.log('👤 setUser called with:', newUser?.name || 'null');
    setUserState(newUser);
    if (newUser) {
      localStorage.setItem('chronos_userId', newUser.id);
      fetchAndStoreToken(newUser);
    } else {
      localStorage.removeItem('chronos_userId');
      localStorage.removeItem('chronos_token');
    }
  };

  const logout = () => {
    setUserState(null);
    localStorage.removeItem('chronos_userId');
    localStorage.removeItem('chronos_token');
  };

  if (!isClient) {
    return null;
  }

  return (
    <UserContext.Provider value={{ user, setUser, logout }}>
      {children}
    </UserContext.Provider>
  );
}

export function useUser() {
  const context = useContext(UserContext);
  if (context === undefined) {
    throw new Error('useUser must be used within a UserProvider');
  }
  return context;
}

export { PREDEFINED_USERS };
