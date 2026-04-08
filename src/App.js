import React, { useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from './context/AuthContext';
import { ThemeProvider } from './context/ThemeContext';
import Navigation from './components/Navigation';
import ProtectedRoute from './components/ProtectedRoute';
import Login from './pages/Login';
import Register from './pages/Register';
import Groups from './pages/Groups';
import GroupDetail from './pages/GroupDetail';
import Payments from './pages/Payments';
import Settlements from './pages/Settlements';
import { authAPI } from './api/axios';
import './App.css';

function App() {
  const { isAuthenticated, login } = useAuth();

  useEffect(() => {
    // Check if user is already logged in
    const checkAuth = async () => {
      const token = localStorage.getItem('token');
      const user = localStorage.getItem('user');

      if (token && user) {
        try {
          // Verify token is still valid
          const response = await authAPI.getCurrentUser();
          login(response.data.user, token);
        } catch (error) {
          // Token is invalid, clear storage
          console.log('Token validation failed:', error.message);
          localStorage.removeItem('token');
          localStorage.removeItem('user');
        }
      }
    };

    checkAuth();
  }, [login]);

  return (
    <ThemeProvider>
      <Router future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
        <Navigation />
        <Routes>
          <Route
            path="/login"
            element={isAuthenticated ? <Navigate to="/groups" /> : <Login />}
          />
          <Route
            path="/register"
            element={isAuthenticated ? <Navigate to="/groups" /> : <Register />}
          />
          <Route
            path="/groups"
            element={
              <ProtectedRoute>
                <Groups />
              </ProtectedRoute>
            }
          />
          <Route
            path="/group/:id"
            element={
              <ProtectedRoute>
                <GroupDetail />
              </ProtectedRoute>
            }
          />
          <Route
            path="/payments"
            element={
              <ProtectedRoute>
                <Payments />
              </ProtectedRoute>
            }
          />
          <Route
            path="/settlements"
            element={
              <ProtectedRoute>
                <Settlements />
              </ProtectedRoute>
            }
          />
          <Route path="/" element={<Navigate to="/groups" />} />
        </Routes>
      </Router>
    </ThemeProvider>
  );
}

export default App;
