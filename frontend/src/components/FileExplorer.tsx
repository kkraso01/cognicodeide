import React, { useState } from 'react';

export interface FileNode {
  name: string;
  path: string;
  type: 'file' | 'folder';
  content?: string;
  children?: FileNode[];
}

interface FileExplorerProps {
  files: FileNode[];
  currentFile: string;
  onFileSelect: (file: FileNode) => void;
  onFileCreate?: (path: string, name: string, type: 'file' | 'folder') => void;
  onFileDelete?: (path: string) => void;
  readOnly?: boolean;
}

export const FileExplorer: React.FC<FileExplorerProps> = ({
  files,
  currentFile,
  onFileSelect,
  onFileCreate,
  onFileDelete,
  readOnly = false,
}) => {
  const [expandedFolders, setExpandedFolders] = useState<Set<string>>(new Set(['/']));
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; path: string } | null>(null);

  const toggleFolder = (path: string) => {
    const newExpanded = new Set(expandedFolders);
    if (newExpanded.has(path)) {
      newExpanded.delete(path);
    } else {
      newExpanded.add(path);
    }
    setExpandedFolders(newExpanded);
  };

  const handleContextMenu = (e: React.MouseEvent, path: string) => {
    if (readOnly) return;
    e.preventDefault();
    setContextMenu({ x: e.clientX, y: e.clientY, path });
  };

  const closeContextMenu = () => setContextMenu(null);

  const renderFileNode = (node: FileNode, depth: number = 0): React.ReactNode => {
    const isExpanded = expandedFolders.has(node.path);
    const isSelected = node.path === currentFile;

    if (node.type === 'folder') {
      return (
        <div key={node.path}>
          <div
            className={`file-node ${isSelected ? 'selected' : ''}`}
            style={{ paddingLeft: `${depth * 16 + 8}px` }}
            onClick={() => toggleFolder(node.path)}
            onContextMenu={(e) => handleContextMenu(e, node.path)}
          >
            <span className="file-icon">{isExpanded ? '📂' : '📁'}</span>
            <span className="file-name">{node.name}</span>
          </div>
          {isExpanded && node.children && (
            <div>
              {node.children.map((child) => renderFileNode(child, depth + 1))}
            </div>
          )}
        </div>
      );
    }

    return (
      <div
        key={node.path}
        className={`file-node ${isSelected ? 'selected' : ''}`}
        style={{ paddingLeft: `${depth * 16 + 8}px` }}
        onClick={() => onFileSelect(node)}
        onContextMenu={(e) => handleContextMenu(e, node.path)}
      >
        <span className="file-icon">{getFileIcon(node.name)}</span>
        <span className="file-name">{node.name}</span>
      </div>
    );
  };

  const getFileIcon = (fileName: string): string => {
    const ext = fileName.split('.').pop()?.toLowerCase();
    switch (ext) {
      case 'py':
        return '🐍';
      case 'java':
        return '☕';
      case 'c':
      case 'cpp':
        return '🇨';
      case 'js':
      case 'ts':
        return '📜';
      case 'json':
        return '📋';
      case 'txt':
      case 'md':
        return '📝';
      default:
        return '📄';
    }
  };

  return (
    <div className="file-explorer-container">
      <div className="explorer-header">
        <span>FILES</span>
        {!readOnly && onFileCreate && (
          <div className="explorer-actions">
            <button
              className="explorer-action-btn"
              onClick={() => {
                const name = prompt('File name:');
                if (name) onFileCreate('/', name, 'file');
              }}
              title="New File"
            >
              +📄
            </button>
            <button
              className="explorer-action-btn"
              onClick={() => {
                const name = prompt('Folder name:');
                if (name) onFileCreate('/', name, 'folder');
              }}
              title="New Folder"
            >
              +📁
            </button>
          </div>
        )}
      </div>
      <div className="explorer-content">
        {files.map((file) => renderFileNode(file))}
      </div>

      {contextMenu && (
        <>
          <div className="context-menu-overlay" onClick={closeContextMenu} />
          <div
            className="context-menu"
            style={{
              left: contextMenu.x,
              top: contextMenu.y,
            }}
          >
            <button
              className="context-menu-item"
              onClick={() => {
                if (onFileDelete) onFileDelete(contextMenu.path);
                closeContextMenu();
              }}
            >
               🗑️ Delete
            </button>
          </div>
        </>
      )}
    </div>
  );
};

