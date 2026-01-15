import React, { useEffect, useState } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { LoginPage } from './pages/LoginPage';
import { StudentWorkspace } from './pages/StudentWorkspace';
import { StudentAssignmentsPage } from './pages/StudentAssignmentsPage';
import { TeacherDashboard } from './pages/TeacherDashboard';
import { CreateAssignmentPage } from './pages/CreateAssignmentPage';
import { EditAssignmentPage } from './pages/EditAssignmentPage';
import { StudentAttemptsPage } from './pages/StudentAttemptsPage';
import { ReplayPage } from './pages/ReplayPage';
import { TeacherSettingsPage } from './pages/TeacherSettingsPage';
import { useUserStore } from './state/userStore';

const App: React.FC = () => {
  const { isAuthenticated, user, fetchUser } = useUserStore();
  const [initialized, setInitialized] = useState(false);

  useEffect(() => {
    // On app load, restore user from token if available
    fetchUser().finally(() => {
      setInitialized(true);
    });
  }, [fetchUser]);

  // Show loading screen while initializing
  if (!initialized) {
    return (
      <div className="app-loading">
        <div>Loading...</div>
      </div>
    );
  }


  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        
        <Route
          path="/student"
          element={
            isAuthenticated && user?.role === 'Student' ? (
              <Navigate to="/student/assignments" replace />
            ) : (
              <Navigate to="/login" replace />
            )
          }
        />
        
        <Route
          path="/student/assignments"
          element={
            isAuthenticated && user?.role === 'Student' ? (
              <StudentAssignmentsPage />
            ) : (
              <Navigate to="/login" replace />
            )
          }
        />
        
        <Route
          path="/student/assignment/:assignmentId"
          element={
            isAuthenticated && user?.role === 'Student' ? (
              <StudentWorkspace />
            ) : (
              <Navigate to="/login" replace />
            )
          }
        />
        
        <Route
          path="/teacher"
          element={
            isAuthenticated && user?.role === 'Teacher' ? (
              <TeacherDashboard />
            ) : (
              <Navigate to="/login" replace />
            )
          }
        />
        
        <Route
          path="/teacher/create-assignment"
          element={
            isAuthenticated && user?.role === 'Teacher' ? (
              <CreateAssignmentPage />
            ) : (
              <Navigate to="/login" replace />
            )
          }
        />
        
        <Route
          path="/teacher/edit-assignment/:assignmentId"
          element={
            isAuthenticated && user?.role === 'Teacher' ? (
              <EditAssignmentPage />
            ) : (
              <Navigate to="/login" replace />
            )
          }
        />
        
        <Route
          path="/teacher/settings"
          element={
            isAuthenticated && user?.role === 'Teacher' ? (
              <TeacherSettingsPage />
            ) : (
              <Navigate to="/login" replace />
            )
          }
        />
        
        <Route
          path="/teacher/attempts/:assignmentId?"
          element={
            isAuthenticated && user?.role === 'Teacher' ? (
              <StudentAttemptsPage />
            ) : (
              <Navigate to="/login" replace />
            )
          }
        />
        
        <Route
          path="/teacher/replay/:attemptId"
          element={
            isAuthenticated && user?.role === 'Teacher' ? (
              <ReplayPage />
            ) : (
              <Navigate to="/login" replace />
            )
          }
        />
        
        <Route
          path="/"
          element={
            isAuthenticated ? (
              user?.role === 'Teacher' ? (
                <Navigate to="/teacher" replace />
              ) : (
                <Navigate to="/student" replace />
              )
            ) : (
              <Navigate to="/login" replace />
            )
          }
        />
      </Routes>
    </BrowserRouter>
  );
};

export default App;
