import React, { useEffect, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import {
  FolderClosed,
  Search,
  ArrowLeft,
  HardDrive,
  Folder,
  FileText,
  ChevronRight,
  Download,
  Upload,
  UploadCloud,
  Loader,
  RefreshCw,
  X,
} from 'lucide-react';
import { ScreenHeader } from '../../components/ScreenHeader';
import { ConnectBanner } from '../../components/ConnectBanner';
import { ClipboardPanel } from '../control/ClipboardPanel';
import { Skeleton } from '../../components/Skeleton';
import { quickAccess } from '../../constants';
import { useOrbit } from '../../state/OrbitContext';
import { useFiles } from '../pc/useFiles';
import type { FileEntry } from '../../types';

const spring = { type: 'spring', stiffness: 360, damping: 32, mass: 0.85 } as const;

function formatSize(bytes: number): string {
  if (!bytes) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);
  return `${(bytes / 1024 ** i).toFixed(i === 0 ? 0 : 1)} ${units[i]}`;
}

function gb(bytes: number): string {
  return `${Math.round(bytes / 1024 ** 3)} GB`;
}

export function FilesTab() {
  const { request } = useOrbit();
  const {
    currentPath,
    files,
    isLoading,
    isUploading,
    uploads,
    list,
    open,
    goBack,
    download,
    uploadMultiple,
    clearUploads,
  } = useFiles();
  const [folders, setFolders] = useState<Record<string, string>>({});
  const [query, setQuery] = useState('');
  const [dragOver, setDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const quickSendRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    request('/api/v1/files/quick')
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => data && setFolders(data.folders || {}))
      .catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files?.length && currentPath) uploadMultiple(e.target.files, currentPath);
    if (e.target) e.target.value = '';
  };

  // Prefer the Desktop for one-tap sends — most discoverable place to land a file.
  const quickSendDest = folders.Desktop || folders.Documents || Object.values(folders)[0] || null;
  const quickSendLabel = quickSendDest ? quickSendDest.split('\\').filter(Boolean).pop() : null;

  const handleQuickSend = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files?.length && quickSendDest) uploadMultiple(e.target.files, quickSendDest);
    if (e.target) e.target.value = '';
  };

  const handleDrop = (e: React.DragEvent<HTMLButtonElement>) => {
    e.preventDefault();
    setDragOver(false);
    if (e.dataTransfer.files?.length && quickSendDest) uploadMultiple(e.dataTransfer.files, quickSendDest);
  };

  const atRoot = !currentPath;
  const visible = query.trim()
    ? files.filter((f) => f.name.toLowerCase().includes(query.trim().toLowerCase()))
    : files;
  const title = atRoot ? 'Transfer' : currentPath!.split('\\').filter(Boolean).pop() || 'Browse';

  return (
    <motion.div
      key="files"
      className="screen"
      initial={{ opacity: 0, y: 18 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -12 }}
      transition={spring}
    >
      <ScreenHeader
        icon={FolderClosed}
        title={title}
        subtitle={atRoot ? 'Send & browse files' : currentPath!}
        action={
          !atRoot ? (
            <button type="button" className="h-act" onClick={goBack} aria-label="Back">
              <ArrowLeft size={18} />
            </button>
          ) : undefined
        }
      />

      <ConnectBanner />

      <div className="search-box">
        <Search size={18} />
        <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search files on PC..." />
      </div>

      {/* Drop zone — one tap or drag, no need to browse into a folder first */}
      {atRoot && (
        <>
          <button
            type="button"
            className={`dropzone ${dragOver ? 'drag-over' : ''}`}
            disabled={!quickSendDest || isUploading}
            onClick={() => quickSendRef.current?.click()}
            onDragOver={(e) => {
              e.preventDefault();
              setDragOver(true);
            }}
            onDragLeave={() => setDragOver(false)}
            onDrop={handleDrop}
          >
            <span className="dropzone-ico">
              <UploadCloud size={26} />
            </span>
            <strong>Drop files here</strong>
            <span>{quickSendDest ? `or tap to choose · lands in ${quickSendLabel}` : 'No destination folder found'}</span>
          </button>
          <input type="file" multiple ref={quickSendRef} onChange={handleQuickSend} style={{ display: 'none' }} />

          {/* Clipboard sync lives next to file drop — both are "send stuff to the PC" */}
          <div className="card clip-card">
            <span className="w-title">Clipboard</span>
            <ClipboardPanel />
          </div>
        </>
      )}

      {/* Upload progress — visible wherever it was triggered from */}
      {uploads.length > 0 && (
        <div className="card upload-list">
          <div className="flex justify-between items-center mb-2 px-1">
            <strong className="text-xs font-black text-var-ink">
              {isUploading ? `Uploading ${uploads.length} file${uploads.length > 1 ? 's' : ''}…` : 'Upload complete'}
            </strong>
            {!isUploading && (
              <button type="button" className="link" onClick={clearUploads} aria-label="Dismiss">
                <X size={14} />
              </button>
            )}
          </div>
          <div className="flex flex-col gap-2">
            {uploads.map((u, i) => (
              <div key={`${u.name}-${i}`} className="upload-row">
                {u.thumbUrl ? (
                  <img src={u.thumbUrl} className="upload-thumb" alt="" />
                ) : (
                  <span className="upload-thumb upload-thumb-generic">
                    <FileText size={14} />
                  </span>
                )}
                <span className="upload-name truncate">{u.name}</span>
                <div className="upload-bar">
                  <i style={{ width: `${u.progress}%` }} className={u.status === 'error' ? 'error' : ''} />
                </div>
                <span className="upload-pct">
                  {u.status === 'error' ? 'Failed' : u.status === 'done' ? 'Done' : `${u.progress}%`}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Quick access (root only) */}
      {atRoot && (
        <>
          <div className="sect">
            <h2>Quick Access</h2>
          </div>
          <div className="access-grid">
            {quickAccess.map(({ label, folder, icon: Icon, tone }) => (
              <button
                key={label}
                type="button"
                className="access-tile"
                disabled={!folders[folder]}
                style={{ opacity: folders[folder] ? 1 : 0.45 }}
                onClick={() => folders[folder] && list(folders[folder])}
              >
                <span className="a-ico" style={{ background: tone }}>
                  <Icon size={20} />
                </span>
                <strong>{label}</strong>
              </button>
            ))}
          </div>
        </>
      )}

      {/* Drives (root) */}
      {atRoot && (
        <>
          <div className="sect">
            <h2>Drives</h2>
            <button type="button" className="link" onClick={() => list(null)} aria-label="Refresh drives">
              <RefreshCw size={15} className={isLoading ? 'spin' : ''} />
            </button>
          </div>
          <div className="flex flex-col gap-3">
            {isLoading ? (
              [0, 1].map((i) => (
                <div key={i} className="card drive-card">
                  <Skeleton style={{ width: 44, height: 44, borderRadius: 14 }} />
                  <div className="d-copy flex flex-col gap-2">
                    <Skeleton style={{ width: '55%', height: 14 }} />
                    <Skeleton style={{ width: '100%', height: 6, borderRadius: 99 }} />
                    <Skeleton style={{ width: '40%', height: 11 }} />
                  </div>
                </div>
              ))
            ) : visible.length > 0 ? (
              visible.map((drive) => {
                const total = drive.total || 0;
                const free = drive.free || 0;
                const used = total - free;
                const pct = total ? Math.min(100, Math.round((used / total) * 100)) : 0;
                return (
                  <button key={drive.path} type="button" className="card drive-card" onClick={() => open(drive)}>
                    <div className="d-ico">
                      <HardDrive size={22} />
                    </div>
                    <div className="d-copy">
                      <strong>{drive.name}</strong>
                      <div className="d-bar">
                        <i style={{ width: `${pct}%` }} />
                      </div>
                      <small>{total ? `${gb(free)} free of ${gb(total)}` : 'Capacity unknown'}</small>
                    </div>
                    <ChevronRight size={18} className="text-[#9aa3b0]" />
                  </button>
                );
              })
            ) : (
              <div className="empty-state">No drives found</div>
            )}
          </div>
        </>
      )}

      {/* Browse view */}
      {!atRoot && (
        <div className="list-panel">
          <div className="flex justify-between items-center px-2 py-1 mb-2">
            <h2 className="m-0 text-lg font-black text-var-ink">Files</h2>
            <input type="file" multiple ref={fileInputRef} onChange={handleUpload} style={{ display: 'none' }} />
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={isUploading}
              className="flex items-center gap-1.5 bg-[#007aff] text-white px-3 py-1.5 rounded-xl text-xs font-bold shadow-md shadow-blue-500/10 active:scale-95 transition-all disabled:opacity-50"
            >
              {isUploading ? <Loader size={13} className="spin" /> : <Upload size={13} />}
              <span>Upload</span>
            </button>
          </div>

          {isLoading ? (
            <div className="flex flex-col gap-2 p-1">
              {[0, 1, 2, 3, 4].map((i) => (
                <div key={i} className="file-row" style={{ pointerEvents: 'none' }}>
                  <Skeleton style={{ width: 40, height: 40, borderRadius: 14 }} />
                  <span className="min-w-0 flex-1 pr-2 flex flex-col gap-1.5">
                    <Skeleton style={{ width: '65%', height: 12 }} />
                    <Skeleton style={{ width: '35%', height: 10 }} />
                  </span>
                </div>
              ))}
            </div>
          ) : visible.length > 0 ? (
            <div className="flex flex-col gap-0.5">
              {visible.map((file: FileEntry) => (
                <button key={file.path} type="button" className="file-row" onClick={() => open(file)}>
                  <span className="row-icon">{file.is_dir ? <Folder size={19} /> : <FileText size={19} />}</span>
                  <span className="min-w-0 flex-1 pr-2">
                    <strong className="truncate">{file.name}</strong>
                    <small className="block truncate text-left">{file.is_dir ? 'Folder' : formatSize(file.size)}</small>
                  </span>
                  {!file.is_dir ? (
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        download(file);
                      }}
                      className="grid h-8 w-8 place-items-center rounded-xl hover:bg-black/5 active:scale-95 text-[#6e7682] transition-all"
                      aria-label={`Download ${file.name}`}
                    >
                      <Download size={16} />
                    </button>
                  ) : (
                    <ChevronRight size={19} className="text-[#6e7682]" />
                  )}
                </button>
              ))}
            </div>
          ) : (
            <div className="empty-state">No files in this location</div>
          )}
        </div>
      )}
    </motion.div>
  );
}
