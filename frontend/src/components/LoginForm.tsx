import React, { useState } from 'react';
import { useUserStore } from '../state/userStore';
import { useNavigate } from 'react-router-dom';

export const LoginForm: React.FC = () => {
  const [isLogin, setIsLogin] = useState(true);
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState<'Student' | 'Teacher'>('Student');
  const [error, setError] = useState('');

  const { login, register, isLoading } = useUserStore();
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    try {
      if (isLogin) {
        await login(username, password);
        // Get user role from store after login
        const userRole = useUserStore.getState().user?.role;
        navigate(userRole === 'Teacher' ? '/teacher' : '/student');
      } else {
        await register(username, email, password, role);
        // Redirect based on selected role during registration
        navigate(role === 'Teacher' ? '/teacher' : '/student');
      }
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Authentication failed');
    }
  };

  return (
    <div className="auth-container">
      <div className="auth-card">
        <h1 className="auth-brand-title">COGNICODE</h1>
        <p className="auth-subtitle">Educational Coding Platform</p>

        <div className="nav-tabs auth-tabs">
          <button
            className={`nav-tab auth-tab ${isLogin ? 'active' : ''}`}
            onClick={() => setIsLogin(true)}
          >
            Login
          </button>
          <button
            className={`nav-tab auth-tab ${!isLogin ? 'active' : ''}`}
            onClick={() => setIsLogin(false)}
          >
            Register
          </button>
        </div>

        <form onSubmit={handleSubmit} className="auth-form">
          <div className="form-group">
            <label className="form-label">Username</label>
            <input
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              required
              className="form-input"
            />
          </div>

          {!isLogin && (
            <div className="form-group">
              <label className="form-label">Email</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="form-input"
              />
            </div>
          )}

          <div className="form-group">
            <label className="form-label">Password</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              className="form-input"
            />
          </div>

          {!isLogin && (
            <div className="form-group">
              <label className="form-label">Role</label>
              <select
                value={role}
                onChange={(e) => setRole(e.target.value as 'Student' | 'Teacher')}
                className="form-input"
              >
                <option value="Student">Student</option>
                <option value="Teacher">Teacher</option>
              </select>
            </div>
          )}

          {error && <div className="auth-error">{error}</div>}

          <button type="submit" disabled={isLoading} className="btn btn-primary btn-block auth-submit-btn">
            {isLoading ? 'Processing...' : isLogin ? 'Login' : 'Register'}
          </button>
        </form>
      </div>
    </div>
  );
};
