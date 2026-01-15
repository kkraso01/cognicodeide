import React, { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { AssignmentList } from '../components/AssignmentList';
import { useAssignmentStore } from '../state/assignmentStore';
import { useUserStore } from '../state/userStore';

export const StudentAssignmentsPage: React.FC = () => {
  const navigate = useNavigate();
  const { assignments, fetchAssignments } = useAssignmentStore();
  const { logout, user } = useUserStore();

  useEffect(() => {
    fetchAssignments();
  }, [fetchAssignments]);

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  return (
    <div className="page-container">
      <header className="page-header">
        <h1 className="page-title">My Assignments</h1>
        <div className="page-actions">
          <span className="user-display-name">{user?.username}</span>
          <button className="btn btn-danger" onClick={handleLogout}>
            Logout
          </button>
        </div>
      </header>

      <main className="page-content">
        <AssignmentList assignments={assignments} />
      </main>
    </div>
  );
};
