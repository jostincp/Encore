'use client';

import React, { useEffect, useState } from 'react';

type QueueEntry = {
  id: string;
  bar_id: string;
  song_id: string;
  priority_play: boolean;
  points_used: number;
  status: string;
  requested_at: string;
};

type VideoDetails = {
  id: string;
  title: string;
  artist: string;
  thumbnail: string;
  channelTitle?: string;
  publishedAt?: string;
  duration?: string;
};

export default function GuestBarQueuePage() {
  const [items, setItems] = useState<QueueEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [videoId, setVideoId] = useState('');
  const [query, setQuery] = useState('');
  const [details, setDetails] = useState<Record<string, VideoDetails>>({});

  const fetchQueue = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('http://localhost:3002/api/queue/bars/test-bar');
      const json = await res.json();
      const items: QueueEntry[] = json.data || [];
      setItems(items);

      // Fetch details for any song_id not yet cached
      const missing = items
        .map((it) => it.song_id)
        .filter((id) => !details[id]);
      if (missing.length) {
        const fetched = await Promise.all(
          missing.map(async (id) => {
            try {
              const r = await fetch(`http://localhost:3002/api/youtube/video/${encodeURIComponent(id)}`);
              const j = await r.json();
              const d: VideoDetails = j?.data || {};
              const thumb = d?.thumbnail || `https://img.youtube.com/vi/${id}/hqdefault.jpg`;
              return d?.id ? { ...d, thumbnail: thumb } : { id, title: id, artist: '', thumbnail: thumb };
            } catch {
              return { id, title: id, artist: '', thumbnail: `https://img.youtube.com/vi/${id}/hqdefault.jpg` };
            }
          })
        );
        setDetails((prev) => {
          const next = { ...prev } as Record<string, VideoDetails>;
          for (const d of fetched) next[d.id] = d;
          return next;
        });
      }
    } catch (e: any) {
      setError(e?.message || 'Error al obtener la cola');
    } finally {
      setLoading(false);
    }
  };

  const addSong = async () => {
    if (!videoId) return;
    setLoading(true);
    setError(null);
    try {
      const url = `http://localhost:3002/guest/test-bar/request?videoId=${encodeURIComponent(videoId)}`;
      const res = await fetch(url);
      if (res.status === 409) {
        setError('Esta canción ya está en la cola');
        return;
      }
      if (!res.ok) throw new Error('Error al añadir la canción');
      await fetchQueue();
    } catch (e: any) {
      setError(e?.message || 'Error al añadir');
    } finally {
      setLoading(false);
    }
  };

  const findAndRequest = async () => {
    if (!query) return;
    setLoading(true);
    setError(null);
    try {
      const url = `http://localhost:3002/guest/test-bar/find-and-request?q=${encodeURIComponent(query)}&maxResults=5`;
      const res = await fetch(url);
      if (res.status === 409) {
        setError('La primera coincidencia ya está en la cola');
        return;
      }
      if (!res.ok) throw new Error('Error al buscar y añadir');
      await fetchQueue();
    } catch (e: any) {
      setError(e?.message || 'Error en buscar y pedir');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchQueue();
  }, []);

  return (
    <div style={{ padding: 24 }}>
      <h1>Cola del bar de pruebas (test-bar)</h1>
      <p>
        Búsqueda y peticiones probadas por backend. Aquí puedes ver y añadir canciones por
        <code>videoId</code> de YouTube.
      </p>

      <div style={{ marginTop: 12, display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
        <input
          value={videoId}
          onChange={(e) => setVideoId(e.target.value)}
          placeholder="YouTube videoId (ej: TmKh7IAwnBI)"
          style={{ padding: 8, minWidth: 320 }}
        />
        <button onClick={addSong} disabled={loading} style={{ padding: '8px 12px' }}>
          Añadir a la cola
        </button>
        <button onClick={fetchQueue} disabled={loading} style={{ padding: '8px 12px' }}>
          Refrescar
        </button>

        <span style={{ marginLeft: 16, fontWeight: 600 }}>Buscar y pedir</span>
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Consulta (ej: DÁKITI)"
          style={{ padding: 8, minWidth: 240 }}
        />
        <button onClick={findAndRequest} disabled={loading} style={{ padding: '8px 12px' }}>
          Buscar y añadir primera
        </button>
      </div>

      {error && <div style={{ color: 'tomato', marginTop: 8 }}>{error}</div>}

      <div style={{ marginTop: 16 }}>
        {loading ? (
          <div>Cargando…</div>
        ) : items.length === 0 ? (
          <div>No hay canciones en cola</div>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr>
                <th style={{ textAlign: 'left' }}>#</th>
                <th style={{ textAlign: 'left' }}>Canción</th>
                <th style={{ textAlign: 'left' }}>status</th>
                <th style={{ textAlign: 'left' }}>requested_at</th>
              </tr>
            </thead>
            <tbody>
              {items.map((it, idx) => {
                const d = details[it.song_id];
                return (
                  <tr key={it.id}>
                    <td>{idx + 1}</td>
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        {d?.thumbnail ? (
                          <img src={d.thumbnail} alt={d?.title || it.song_id} width={56} height={42} style={{ borderRadius: 6, objectFit: 'cover' }} />
                        ) : (
                          <div style={{ width: 56, height: 42, background: '#eee', borderRadius: 6 }} />
                        )}
                        <div>
                          <div style={{ fontWeight: 600 }}>{d?.title || it.song_id}</div>
                          <div style={{ fontSize: 12, color: '#555' }}>{d?.artist || d?.channelTitle || ''}</div>
                        </div>
                      </div>
                    </td>
                    <td>{it.status}</td>
                    <td>{new Date(it.requested_at).toLocaleString()}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      <div style={{ marginTop: 24 }}>
        <h3>Atajos</h3>
        <ul>
          <li>
            Buscar y pedir: <a href="http://localhost:3002/guest/test-bar/find-and-request?q=queen&maxResults=3" target="_blank">find-and-request</a>
          </li>
          <li>
            Ver cola (JSON): <a href="http://localhost:3002/api/queue/bars/test-bar" target="_blank">/api/queue/bars/test-bar</a>
          </li>
        </ul>
      </div>
    </div>
  );
}
