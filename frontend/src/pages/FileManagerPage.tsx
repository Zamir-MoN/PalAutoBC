import React, { useState, useEffect, useRef } from 'react';
import {
  FolderTree,
  Folder,
  File,
  FileText,
  ChevronRight,
  ArrowLeft,
  Edit,
  Trash2,
  Save,
  X,
  RefreshCw,
  AlertCircle,
  CheckCircle2,
} from 'lucide-react';
import { api } from '../services/api';
import { FileItem } from '../types';
import { animatePageEntrance } from '../animations/gsap';

export function FileManagerPage() {
  const containerRef = useRef<HTMLDivElement>(null);
  const [currentPath, setCurrentPath] = useState<string>('');
  const [files, setFiles] = useState<FileItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [editFile, setEditFile] = useState<FileItem | null>(null);
  const [editContent, setEditContent] = useState<string>('');
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  const loadFiles = async (targetPath = currentPath) => {
    try {
      setLoading(true);
      const res = await api.listFiles(targetPath);
      setFiles(res);
      setCurrentPath(targetPath);
    } catch (err: any) {
      setError(err.message || 'Failed to list directory');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    animatePageEntrance(containerRef.current);
    loadFiles('');
  }, []);

  const handleOpenFolder = (folderName: string) => {
    const next = currentPath ? `${currentPath}/${folderName}` : folderName;
    loadFiles(next);
  };

  const handleGoUp = () => {
    if (!currentPath) return;
    const parts = currentPath.split('/');
    parts.pop();
    loadFiles(parts.join('/'));
  };

  const handleEdit = async (file: FileItem) => {
    try {
      setLoading(true);
      const res = await api.readFile(file.relativePath);
      setEditFile(file);
      setEditContent(res.content);
    } catch (err: any) {
      setError(err.message || 'Cannot open file for editing');
    } finally {
      setLoading(false);
    }
  };

  const handleSaveFile = async () => {
    if (!editFile) return;
    setSaving(true);
    try {
      await api.writeFile(editFile.relativePath, editContent);
      setMessage(`Saved ${editFile.name} successfully.`);
      setEditFile(null);
      loadFiles();
    } catch (err: any) {
      setError(err.message || 'Failed to save file');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (file: FileItem) => {
    if (!window.confirm(`Delete ${file.isDir ? 'folder' : 'file'} "${file.name}"? This cannot be undone.`)) return;
    try {
      await api.deleteFile(file.relativePath);
      setMessage(`Deleted ${file.name}.`);
      loadFiles();
    } catch (err: any) {
      setError(err.message || 'Failed to delete');
    }
  };

  const formatBytes = (bytes: number) => {
    if (!bytes) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
  };

  return (
    <div ref={containerRef} className="space-y-4 max-w-6xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-white flex items-center gap-2">
            <FolderTree className="w-5 h-5 text-accent" />
            Server File Manager
          </h1>
          <p className="text-xs text-mutedText mt-0.5">Sandboxed file browser, configuration editor, and directory management</p>
        </div>
        <button
          onClick={() => loadFiles()}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-card hover:bg-border text-white border border-border transition-colors self-start sm:self-auto"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
          <span>Refresh</span>
        </button>
      </div>

      {message && (
        <div className="p-3.5 rounded-xl bg-success/10 border border-success/30 text-success text-xs flex items-center justify-between">
          <span>{message}</span>
          <button onClick={() => setMessage('')} className="hover:opacity-75">✕</button>
        </div>
      )}

      {error && (
        <div className="p-3.5 rounded-xl bg-danger/10 border border-danger/30 text-danger text-xs flex items-center justify-between">
          <span>{error}</span>
          <button onClick={() => setError('')} className="hover:opacity-75">✕</button>
        </div>
      )}

      {/* Path Breadcrumbs */}
      <div className="bg-card border border-border rounded-lg px-4 py-2 text-xs flex items-center gap-2 font-mono">
        <button
          onClick={handleGoUp}
          disabled={!currentPath}
          className="text-mutedText hover:text-white disabled:opacity-30 flex items-center gap-1"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          <span>Up</span>
        </button>
        <span className="text-border">/</span>
        <span className="text-secondaryText font-semibold">/home/ubuntu/Palserver</span>
        {currentPath && (
          <>
            <span className="text-border">/</span>
            <span className="text-accent">{currentPath}</span>
          </>
        )}
      </div>

      {/* File List Table */}
      <div className="bg-card border border-border rounded-xl p-4 shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-border/80 text-mutedText font-medium">
                <th className="pb-3 pl-2">Name</th>
                <th className="pb-3">Size</th>
                <th className="pb-3">Modified</th>
                <th className="pb-3 pr-2 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/40 font-mono">
              {files.length === 0 ? (
                <tr>
                  <td colSpan={4} className="py-8 text-center text-mutedText font-sans">
                    Directory is empty.
                  </td>
                </tr>
              ) : (
                files.map((f) => (
                  <tr key={f.name} className="hover:bg-secondary/40 transition-colors">
                    <td className="py-2.5 pl-2">
                      {f.isDir ? (
                        <button
                          onClick={() => handleOpenFolder(f.name)}
                          className="flex items-center gap-2 text-white hover:text-accent font-semibold"
                        >
                          <Folder className="w-4 h-4 text-accent fill-accent/20" />
                          <span>{f.name}</span>
                        </button>
                      ) : (
                        <div className="flex items-center gap-2 text-secondaryText">
                          {f.isEditable ? (
                            <FileText className="w-4 h-4 text-warning" />
                          ) : (
                            <File className="w-4 h-4 text-mutedText" />
                          )}
                          <span>{f.name}</span>
                        </div>
                      )}
                    </td>
                    <td className="py-2.5 text-mutedText">{f.isDir ? '--' : formatBytes(f.sizeBytes)}</td>
                    <td className="py-2.5 text-mutedText">{new Date(f.modifiedAt).toLocaleString()}</td>
                    <td className="py-2.5 pr-2 text-right space-x-2 font-sans">
                      {f.isEditable && (
                        <button
                          onClick={() => handleEdit(f)}
                          className="p-1 rounded hover:bg-secondary text-secondaryText hover:text-accent transition-colors"
                          title="Edit File"
                        >
                          <Edit className="w-3.5 h-3.5" />
                        </button>
                      )}
                      <button
                        onClick={() => handleDelete(f)}
                        className="p-1 rounded hover:bg-secondary text-mutedText hover:text-danger transition-colors"
                        title="Delete"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Code Editor Modal */}
      {editFile && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-card border border-border rounded-xl w-full max-w-4xl max-h-[90vh] flex flex-col shadow-2xl overflow-hidden">
            <div className="h-12 border-b border-border px-4 flex items-center justify-between bg-secondary">
              <span className="font-mono text-xs font-semibold text-white flex items-center gap-2">
                <FileText className="w-4 h-4 text-accent" />
                {editFile.name}
              </span>
              <button
                onClick={() => setEditFile(null)}
                className="p-1 rounded hover:bg-card text-mutedText hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="flex-1 p-4 bg-background overflow-hidden">
              <textarea
                value={editContent}
                onChange={(e) => setEditContent(e.target.value)}
                className="w-full h-96 bg-secondary border border-border rounded-lg p-3 font-mono text-xs text-white focus:outline-none focus:border-accent resize-none leading-relaxed"
              />
            </div>

            <div className="h-14 border-t border-border px-4 flex items-center justify-end gap-3 bg-secondary">
              <button
                onClick={() => setEditFile(null)}
                className="px-3 py-1.5 rounded-lg text-xs font-medium text-secondaryText hover:text-white"
              >
                Cancel
              </button>
              <button
                onClick={handleSaveFile}
                disabled={saving}
                className="px-4 py-1.5 bg-accent text-black font-semibold text-xs rounded-lg hover:bg-accent-hover transition-colors flex items-center gap-1.5"
              >
                <Save className="w-3.5 h-3.5" />
                <span>{saving ? 'Saving...' : 'Save File'}</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

