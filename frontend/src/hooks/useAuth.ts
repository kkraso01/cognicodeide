import { useEffect } from 'react';
import { useUserStore } from '../state/userStore';
import { useNavigate } from 'react-router-dom';

export const useAuth = () => {
  const { user, isAuthenticated, isLoading, login, logout, register, fetchUser } = useUserStore();
  const navigate = useNavigate();

  useEffect(() => {
    if (isAuthenticated && !user) {
      fetchUser();
    }
  }, [isAuthenticated, user, fetchUser]);

  const requireAuth = (requiredRole?: 'Student' | 'Teacher') => {
    if (!isAuthenticated) {
      navigate('/login');
      return false;
    }
    
    if (requiredRole && user?.role !== requiredRole) {
      navigate('/');
      return false;
    }
    
    return true;
  };

  return {
    user,
    isAuthenticated,
    isLoading,
    login,
    logout,
    register,
    requireAuth,
  };
};
