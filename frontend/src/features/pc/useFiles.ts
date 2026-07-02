import { useCallback, useEffect, useState } from 'react';
import { useOrbit } from '../../state/OrbitContext';
import { buildAuthParams } from '../../api/client';
import type { Device, FileEntry } from '../../types';

export interface UploadItem {
  name: string;
  progress: number;
  status: 'uploading' | 'done' | 'error';
  thumbUrl?: string;
}

/** Uploads one file via XHR (for upload-progress events, unavailable on fetch). */
function uploadOne(device: Device, file: File, destPath: string, onProgress: (pct: number) => void): Promise<boolean> {
  return new Promise((resolve) => {
    const { client_id, timestamp, signature } = buildAuthParams(device);
    const formData = new FormData();
    formData.append('file', file);

    const xhr = new XMLHttpRequest();
    xhr.open('POST', `${device.ipAddress}/api/v1/files/upload?path=${encodeURIComponent(destPath)}`);
    xhr.setRequestHeader('Authorization', `Orbit-HMAC ${client_id}:${timestamp}:${signature}`);
    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable) onProgress(Math.round((e.loaded / e.total) * 100));
    };
    xhr.onload = () => resolve(xhr.status >= 200 && xhr.status < 300);
    xhr.onerror = () => resolve(false);
    xhr.send(formData);
  });
}

/** File-system browsing, opening, upload and download against the agent. */
export function useFiles() {
  const { activeDevice, request } = useOrbit();
  const [currentPath, setCurrentPath] = useState<string | null>(null);
  const [files, setFiles] = useState<FileEntry[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [uploads, setUploads] = useState<UploadItem[]>([]);
  const isUploading = uploads.some((u) => u.status === 'uploading');

  const list = useCallback(
    async (path: string | null = null) => {
      if (!activeDevice) return;
      setIsLoading(true);
      try {
        const query = path ? `?path=${encodeURIComponent(path)}` : '';
        const res = await request(`/api/v1/files/list${query}`);
        if (res.ok) {
          const data = await res.json();
          setFiles(data.files || []);
          setCurrentPath(path);
        }
      } catch (err) {
        console.error('Unable to load files:', err);
      } finally {
        setIsLoading(false);
      }
    },
    [activeDevice, request]
  );

  // Initial listing (drives / recent) once a device is available.
  useEffect(() => {
    if (activeDevice) list(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeDevice?.uuid]);

  const open = useCallback(
    async (file: FileEntry) => {
      if (file.is_dir) {
        list(file.path);
        return;
      }
      if (!activeDevice) return;
      try {
        await request('/api/v1/files/open', {
          method: 'POST',
          body: JSON.stringify({ path: file.path }),
        });
      } catch (err) {
        console.error('Unable to open file:', err);
      }
    },
    [activeDevice, request, list]
  );

  const goBack = useCallback(() => {
    if (!currentPath) return;
    const trimmed = currentPath.endsWith('\\') ? currentPath.slice(0, -1) : currentPath;
    const slash = trimmed.lastIndexOf('\\');
    list(slash > -1 ? trimmed.slice(0, slash + 1) : null);
  }, [currentPath, list]);

  const download = useCallback(
    async (file: FileEntry) => {
      if (!activeDevice) return;
      try {
        const res = await request(`/api/v1/files/download?path=${encodeURIComponent(file.path)}`);
        if (res.ok) {
          const blob = await res.blob();
          const url = window.URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.href = url;
          a.download = file.name;
          document.body.appendChild(a);
          a.click();
          a.remove();
          window.URL.revokeObjectURL(url);
        } else {
          alert('Failed to download file');
        }
      } catch (err) {
        console.error(err);
        alert('Download error');
      }
    },
    [activeDevice, request]
  );

  const uploadMultiple = useCallback(
    async (fileList: FileList | File[], destPath: string) => {
      if (!activeDevice || !destPath) return;
      const filesArr = Array.from(fileList);
      if (filesArr.length === 0) return;

      setUploads((cur) => {
        cur.forEach((u) => u.thumbUrl && URL.revokeObjectURL(u.thumbUrl));
        return filesArr.map((f) => ({
          name: f.name,
          progress: 0,
          status: 'uploading' as const,
          thumbUrl: f.type.startsWith('image/') ? URL.createObjectURL(f) : undefined,
        }));
      });

      await Promise.all(
        filesArr.map((file, idx) =>
          uploadOne(activeDevice, file, destPath, (pct) =>
            setUploads((cur) => cur.map((u, i) => (i === idx ? { ...u, progress: pct } : u)))
          ).then((ok) => {
            setUploads((cur) =>
              cur.map((u, i) => (i === idx ? { ...u, progress: 100, status: ok ? 'done' : 'error' } : u))
            );
          })
        )
      );

      if (destPath === currentPath) list(currentPath);
    },
    [activeDevice, currentPath, list]
  );

  const clearUploads = useCallback(() => {
    setUploads((cur) => {
      cur.forEach((u) => u.thumbUrl && URL.revokeObjectURL(u.thumbUrl));
      return [];
    });
  }, []);

  return {
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
  };
}
