import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AssignmentList } from '../components/AssignmentList';
import { ReplayViewer } from '../components/ReplayViewer';
import { useAssignmentStore } from '../state/assignmentStore';
import { useUserStore } from '../state/userStore';
import { apiClient } from '../utils/apiClient';

interface Attempt {
  id: number;
  assignment_id: number;
  user_id: number;
  started_at: string;
  finished_at: string | null;
  mode: string;
  student_ai_choice: string;
  total_score: number | null;
}

interface User {
  id: number;
  username: string;
  email: string;
}

interface Assignment {
  id: number;
  title: string;
}

export const TeacherDashboard: React.FC = () => {
  const navigate = useNavigate();
  const { assignments, fetchAssignments } = useAssignmentStore();
  const { logout } = useUserStore();
  const [view, setView] = useState<'assignments' | 'attempts' | 'replay'>('assignments');
  const [allAttempts, setAllAttempts] = useState<Attempt[]>([]);
  const [users, setUsers] = useState<Map<number, User>>(new Map());
  const [assignmentMap, setAssignmentMap] = useState<Map<number, Assignment>>(new Map());
  const [loadingAttempts, setLoadingAttempts] = useState(false);
  const [selectedAttemptId, setSelectedAttemptId] = useState<number | null>(null);

  useEffect(() => {
    fetchAssignments();
  }, [fetchAssignments]);

  useEffect(() => {
    // Create assignment map for quick lookup
    const map = new Map<number, Assignment>();
    assignments.forEach((a) => {
      map.set(a.id, { id: a.id, title: a.title });
    });
    setAssignmentMap(map);
  }, [assignments]);

  const fetchAllAttempts = async () => {
    setLoadingAttempts(true);
    try {
      // Fetch all attempts across all assignments
      const allAttemptsData: Attempt[] = [];
      
      for (const assignment of assignments) {
        try {
          const attempts = await apiClient.get<Attempt[]>(
            `/api/attempts?assignment_id=${assignment.id}`
          );
          allAttemptsData.push(...attempts);
        } catch (err) {
          console.error(`Failed to fetch attempts for assignment ${assignment.id}`, err);
        }
      }

      // Get latest attempt per student per assignment
      const latestAttemptsMap = new Map<string, Attempt>();
      allAttemptsData.forEach((attempt) => {
        const key = `${attempt.user_id}-${attempt.assignment_id}`;
        const existing = latestAttemptsMap.get(key);
        if (!existing || new Date(attempt.started_at) > new Date(existing.started_at)) {
          latestAttemptsMap.set(key, attempt);
        }
      });

      const latestAttempts = Array.from(latestAttemptsMap.values());
      setAllAttempts(latestAttempts);

      // Fetch user details
      const uniqueUserIds = [...new Set(latestAttempts.map((a) => a.user_id))];
      const userMap = new Map<number, User>();
      
      for (const userId of uniqueUserIds) {
        try {
          const user = await apiClient.get<User>(`/api/auth/users/${userId}`);
          userMap.set(userId, user);
        } catch (err) {
          console.error(`Failed to fetch user ${userId}`, err);
          userMap.set(userId, {
            id: userId,
            username: `User ${userId}`,
            email: '',
          });
        }
      }
      
      setUsers(userMap);
    } catch (error) {
      console.error('Failed to fetch all attempts:', error);
    } finally {
      setLoadingAttempts(false);
    }
  };

  const handleViewChange = (newView: 'assignments' | 'attempts' | 'replay') => {
    setView(newView);
    if (newView === 'attempts' && allAttempts.length === 0) {
      fetchAllAttempts();
    }
  };

  const viewReplay = (attemptId: number) => {
    setSelectedAttemptId(attemptId);
    setView('replay');
  };

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  return (
    <div className="page-container">
      <header className="page-header">
        <h1 className="page-title">Teacher Dashboard</h1>
        <div className="page-actions">
          <button
            className="btn btn-primary"
            onClick={() => navigate('/teacher/create-assignment')}
          >
            + Create Assignment
          </button>
          <button
            className="btn btn-secondary"
            onClick={() => navigate('/teacher/settings')}
          >
             Logging Settings
          </button>
          <button className="btn btn-danger" onClick={handleLogout}>
            Logout
          </button>
        </div>
      </header>

      <nav className="nav-tabs">
        <button
          className={`nav-tab ${view === 'assignments' ? 'active' : ''}`}
          onClick={() => setView('assignments')}
        >
          Assignments
        </button>
        <button
          className={`nav-tab ${view === 'attempts' ? 'active' : ''}`}
          onClick={() => handleViewChange('attempts')}
        >
          Student Attempts
        </button>
      </nav>

      <main className="page-content">
        {view === 'assignments' && (
          <div>
            <h2 className="page-section-title">Assignments</h2>
            <AssignmentList 
              assignments={assignments}
              onSelect={(assignment) => navigate(`/teacher/attempts/${assignment.id}`)}
            />
          </div>
        )}

        {view === 'attempts' && (
          <div>
            <h2 className="page-section-title">All Student Attempts</h2>
            {loadingAttempts ? (
              <div className="empty-state-message">Loading attempts...</div>
            ) : allAttempts.length === 0 ? (
              <div className="empty-state-message">No student attempts found yet.</div>
            ) : (
              <div className="data-table-container">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Student</th>
                      <th>Assignment</th>
                      <th>Started</th>
                      <th>Finished</th>
                      <th>AI Used</th>
                      <th>Score</th>
                      <th>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {allAttempts.map((attempt) => (
                      <tr key={attempt.id}>
                        <td>
                          {users.get(attempt.user_id)?.username || `User ${attempt.user_id}`}
                        </td>
                        <td>
                          {assignmentMap.get(attempt.assignment_id)?.title || `Assignment ${attempt.assignment_id}`}
                        </td>
                        <td>
                          {new Date(attempt.started_at).toLocaleString()}
                        </td>
                        <td>
                          {attempt.finished_at ? new Date(attempt.finished_at).toLocaleString() : ''}
                        </td>
                        <td>
                          {attempt.student_ai_choice === 'none' ? (
                            <span className="status-badge status-neutral">No AI</span>
                          ) : (
                            <span className="status-badge status-success">AI Used</span>
                          )}
                        </td>
                        <td>
                          {attempt.total_score !== null ? `${attempt.total_score}%` : ''}
                        </td>
                        <td>
                          <button
                            className="btn btn-primary btn-sm"
                            onClick={() => viewReplay(attempt.id)}
                          >
                            View Replay
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {view === 'replay' && selectedAttemptId && (
          <div className="replay-view-container">
            <button
              className="btn btn-secondary btn-sm back-btn"
              onClick={() => setView('attempts')}
            >
               Back to Attempts
            </button>
            <ReplayViewer attemptId={selectedAttemptId} />
          </div>
        )}
      </main>
    </div>
  );
};
