import React from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ReplayViewer } from '../components/ReplayViewer';

export const ReplayPage: React.FC = () => {
  const navigate = useNavigate();
  const { attemptId } = useParams<{ attemptId: string }>();

  return (
    <div className="page-container">
      <header className="page-header">
        <h1 className="page-title">Session Replay</h1>
        <button className="btn btn-secondary" onClick={() => navigate(-1)}>
           Back
        </button>
      </header>

      <main className="replay-page-main">
        {attemptId && <ReplayViewer attemptId={parseInt(attemptId)} />}
      </main>
    </div>
  );
};
