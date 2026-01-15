import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useUserStore } from '../state/userStore';

interface Assignment {
  id: number;
  title: string;
  description: string;
  language: string;
  ai_mode: string;
}

interface AssignmentListProps {
  assignments: Assignment[];
  onSelect?: (assignment: Assignment) => void;
}

export const AssignmentList: React.FC<AssignmentListProps> = ({ assignments, onSelect }) => {
  const navigate = useNavigate();
  const { user } = useUserStore();
  const isTeacher = user?.role === 'Teacher';

  const handleClick = (assignment: Assignment, e: React.MouseEvent) => {
    // Don't navigate if clicking edit button
    if ((e.target as HTMLElement).closest('button')) {
      return;
    }

    if (onSelect) {
      onSelect(assignment);
    } else if (!isTeacher) {
      navigate(`/student/assignment/${assignment.id}`);
    }
  };

  const handleEdit = (assignmentId: number, e: React.MouseEvent) => {
    e.stopPropagation();
    navigate(`/teacher/edit-assignment/${assignmentId}`);
  };

  if (assignments.length === 0) {
    return (
      <div className="empty-state-message">
        <p>No assignments available</p>
      </div>
    );
  }

  return (
    <div className="assignments-grid">
      {assignments.map((assignment) => (
        <div
          key={assignment.id}
          className="assignment-card"
          onClick={(e) => handleClick(assignment, e)}
        >
          <div className="assignment-card-header">
            <h3 className="assignment-title">{assignment.title}</h3>
            {isTeacher && (
              <button
                className="btn btn-primary btn-sm"
                onClick={(e) => handleEdit(assignment.id, e)}
                title="Edit assignment"
              >
                 Edit
              </button>
            )}
          </div>
          <p className="assignment-description">
            {assignment.description}
          </p>
          <div className="assignment-meta">
            <span className="assignment-lang-badge">{assignment.language}</span>
            <span className="assignment-lang-badge">{assignment.ai_mode}</span>
          </div>
        </div>
      ))}
    </div>
  );
};
