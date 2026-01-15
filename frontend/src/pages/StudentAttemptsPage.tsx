import React, { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
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

export const StudentAttemptsPage: React.FC = () => {
  const navigate = useNavigate();
  const { assignmentId } = useParams<{ assignmentId: string }>();
  const [attempts, setAttempts] = useState<Attempt[]>([]);
  const [users, setUsers] = useState<Map<number, User>>(new Map());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const fetchAttempts = async () => {
      try {
        // Fetch attempts for the assignment
        const attemptsData = await apiClient.get<Attempt[]>(
          `/api/attempts${assignmentId ? `?assignment_id=${assignmentId}` : ''}`
        );
        
        // Filter to show only latest attempt per student
        const latestAttempts = new Map<number, Attempt>();
        attemptsData.forEach((attempt) => {
          const existing = latestAttempts.get(attempt.user_id);
          if (!existing || new Date(attempt.started_at) > new Date(existing.started_at)) {
            latestAttempts.set(attempt.user_id, attempt);
          }
        });
        
        setAttempts(Array.from(latestAttempts.values()));

        // Fetch user details for unique user IDs
        const uniqueUserIds = [...new Set(Array.from(latestAttempts.values()).map((a) => a.user_id))];
        const userMap = new Map<number, User>();
        
        for (const userId of uniqueUserIds) {
          try {
            const user = await apiClient.get<User>(`/api/auth/users/${userId}`);
            userMap.set(userId, user);
          } catch (err) {
            console.error(`Failed to fetch user ${userId}`, err);
            // Fallback to placeholder
            userMap.set(userId, {
              id: userId,
              username: `User ${userId}`,
              email: '',
            });
          }
        }
        
        setUsers(userMap);
      } catch (err: any) {
        setError(err.response?.data?.detail || 'Failed to fetch attempts');
      } finally {
        setLoading(false);
      }
    };

    fetchAttempts();
  }, [assignmentId]);

  const viewReplay = (attemptId: number) => {
    navigate(`/teacher/replay/${attemptId}`);
  };

  const formatDuration = (startedAt: string, finishedAt: string | null) => {
    if (!finishedAt) return 'In progress';
    
    const start = new Date(startedAt).getTime();
    const end = new Date(finishedAt).getTime();
    const durationMs = end - start;
    
    const minutes = Math.floor(durationMs / 60000);
    const seconds = Math.floor((durationMs % 60000) / 1000);
    
    return `${minutes}m ${seconds}s`;
  };

  if (loading) {
    return (
      <div className="page-container">
        <div className="page-content-centered" style={{ height: '100%', alignItems: 'center', fontSize: '18px' }}>
          Loading attempts...
        </div>
      </div>
    );
  }

  return (
    <div className="page-container">
      <header className="page-header">
        <h1 className="page-title">Student Attempts</h1>
        <button className="btn btn-secondary" onClick={() => navigate('/teacher')}>
           Back to Dashboard
        </button>
      </header>

      <main className="page-content">
        {error && <div className="auth-error" style={{ marginBottom: '20px' }}>{error}</div>}

        {attempts.length === 0 ? (
          <div className="empty-state-message">
            <p>No attempts found for this assignment.</p>
          </div>
        ) : (
          <div className="data-table-container">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Student</th>
                  <th>Started</th>
                  <th>Finished</th>
                  <th>Duration</th>
                  <th>AI Used</th>
                  <th>Score</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {attempts.map((attempt) => (
                  <tr key={attempt.id}>
                    <td>
                      {users.get(attempt.user_id)?.username || `User ${attempt.user_id}`}
                    </td>
                    <td>
                      {new Date(attempt.started_at).toLocaleString()}
                    </td>
                    <td>
                      {attempt.finished_at
                        ? new Date(attempt.finished_at).toLocaleString()
                        : ''}
                    </td>
                    <td>
                      {formatDuration(attempt.started_at, attempt.finished_at)}
                    </td>
                    <td>
                      {attempt.student_ai_choice === 'none' ? (
                        <span className="status-badge status-neutral"> No AI</span>
                      ) : (
                        <span className="status-badge status-success"> AI Used</span>
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
      </main>
    </div>
  );
};
