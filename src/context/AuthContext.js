import React, { createContext, useState, useCallback } from 'react';

const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(() => {
    const savedUser = localStorage.getItem('user');
    if (!savedUser) return null;
    const userData = JSON.parse(savedUser);
    // Normalize to ensure id exists
    return { ...userData, id: userData.id || userData._id };
  });

  const [token, setToken] = useState(() => {
    return localStorage.getItem('token') || null;
  });

  const login = useCallback((user, token) => {
    // Normalize user object to ensure it has 'id' property (aliasing _id if necessary)
    const normalizedUser = {
      ...user,
      id: user.id || user._id
    };
    setUser(normalizedUser);
    setToken(token);
    localStorage.setItem('user', JSON.stringify(normalizedUser));
    localStorage.setItem('token', token);
  }, []);

  const logout = useCallback(() => {
    setUser(null);
    setToken(null);
    localStorage.removeItem('user');
    localStorage.removeItem('token');
  }, []);

  const isAuthenticated = !!token;

  return (
    <AuthContext.Provider value={{ user, token, login, logout, isAuthenticated }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = React.useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return context;
};
