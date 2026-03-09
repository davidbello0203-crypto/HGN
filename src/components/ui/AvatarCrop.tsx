'use client';
import { useState, useCallback } from 'react';
import Cropper from 'react-easy-crop';
import { X, Check, ZoomIn, ZoomOut } from 'lucide-react';

type Area = { x: number; y: number; width: number; height: number };

async function getCroppedBlob(imageSrc: string, cropArea: Area): Promise<Blob> {
  const img = await new Promise<HTMLImageElement>((res, rej) => {
    const i = new Image();
    i.onload = () => res(i);
    i.onerror = rej;
    i.src = imageSrc;
  });
  const canvas = document.createElement('canvas');
  const SIZE = 400;
  canvas.width = SIZE;
  canvas.height = SIZE;
  const ctx = canvas.getContext('2d')!;
  ctx.drawImage(img, cropArea.x, cropArea.y, cropArea.width, cropArea.height, 0, 0, SIZE, SIZE);
  return new Promise((res, rej) => canvas.toBlob((b) => b ? res(b) : rej(new Error('canvas empty')), 'image/jpeg', 0.92));
}

type Props = {
  imageSrc: string;
  onConfirm: (blob: Blob) => void;
  onCancel: () => void;
};

export default function AvatarCrop({ imageSrc, onConfirm, onCancel }: Props) {
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [croppedArea, setCroppedArea] = useState<Area | null>(null);
  const [processing, setProcessing] = useState(false);

  const onCropComplete = useCallback((_: Area, croppedAreaPixels: Area) => {
    setCroppedArea(croppedAreaPixels);
  }, []);

  const handleConfirm = async () => {
    if (!croppedArea) return;
    setProcessing(true);
    try {
      const blob = await getCroppedBlob(imageSrc, croppedArea);
      onConfirm(blob);
    } catch {
      // no-op: onCancel puede ser llamado por el usuario
    } finally {
      setProcessing(false);
    }
  };

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 200, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '24px' }}>
      {/* Backdrop */}
      <div style={{ position: 'absolute', inset: 0, backgroundColor: 'rgba(8,8,8,0.92)', backdropFilter: 'blur(12px)' }} onClick={onCancel} />

      {/* Modal */}
      <div style={{ position: 'relative', zIndex: 1, width: '100%', maxWidth: '480px', backgroundColor: '#090C08', border: '1px solid #1A2418', overflow: 'hidden' }}>

        {/* Header */}
        <div style={{ padding: '20px 24px 16px', borderBottom: '1px solid #1A2418', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div>
            <p style={{ fontFamily: 'var(--font-inter)', fontSize: '10px', letterSpacing: '0.2em', textTransform: 'uppercase', color: '#F07820', marginBottom: '4px' }}>
              Foto de perfil
            </p>
            <h3 style={{ fontFamily: 'var(--font-playfair), Georgia, serif', fontSize: '18px', fontWeight: 700, color: '#F0F0F0' }}>
              Ajusta tu foto
            </h3>
          </div>
          <button onClick={onCancel}
            style={{ background: 'none', border: 'none', color: 'rgba(240,240,240,0.35)', cursor: 'pointer', padding: '4px', transition: 'color 0.2s' }}
            onMouseEnter={(e) => (e.currentTarget.style.color = '#F0F0F0')}
            onMouseLeave={(e) => (e.currentTarget.style.color = 'rgba(240,240,240,0.35)')}>
            <X size={20} />
          </button>
        </div>

        {/* Crop area */}
        <div style={{ position: 'relative', width: '100%', height: '360px', backgroundColor: '#000' }}>
          <Cropper
            image={imageSrc}
            crop={crop}
            zoom={zoom}
            aspect={1}
            cropShape="round"
            showGrid={false}
            onCropChange={setCrop}
            onZoomChange={setZoom}
            onCropComplete={onCropComplete}
            style={{
              containerStyle: { backgroundColor: '#000' },
              cropAreaStyle: { border: '2px solid #F07820', boxShadow: '0 0 0 9999px rgba(0,0,0,0.65)' },
            }}
          />
        </div>

        {/* Zoom control */}
        <div style={{ padding: '16px 24px', borderTop: '1px solid #1A2418', display: 'flex', alignItems: 'center', gap: '12px' }}>
          <button onClick={() => setZoom(Math.max(1, zoom - 0.1))}
            style={{ background: 'none', border: '1px solid #1A2418', color: 'rgba(240,240,240,0.5)', padding: '6px', cursor: 'pointer', display: 'flex', alignItems: 'center', transition: 'border-color 0.2s, color 0.2s' }}
            onMouseEnter={(e) => { e.currentTarget.style.borderColor = '#F07820'; e.currentTarget.style.color = '#F07820'; }}
            onMouseLeave={(e) => { e.currentTarget.style.borderColor = '#1A2418'; e.currentTarget.style.color = 'rgba(240,240,240,0.5)'; }}>
            <ZoomOut size={15} />
          </button>
          <input type="range" min={1} max={3} step={0.05} value={zoom}
            onChange={(e) => setZoom(Number(e.target.value))}
            style={{ flex: 1, accentColor: '#F07820', cursor: 'pointer' }} />
          <button onClick={() => setZoom(Math.min(3, zoom + 0.1))}
            style={{ background: 'none', border: '1px solid #1A2418', color: 'rgba(240,240,240,0.5)', padding: '6px', cursor: 'pointer', display: 'flex', alignItems: 'center', transition: 'border-color 0.2s, color 0.2s' }}
            onMouseEnter={(e) => { e.currentTarget.style.borderColor = '#F07820'; e.currentTarget.style.color = '#F07820'; }}
            onMouseLeave={(e) => { e.currentTarget.style.borderColor = '#1A2418'; e.currentTarget.style.color = 'rgba(240,240,240,0.5)'; }}>
            <ZoomIn size={15} />
          </button>
          <span style={{ fontFamily: 'var(--font-inter)', fontSize: '11px', color: 'rgba(240,240,240,0.3)', minWidth: '36px', textAlign: 'right' }}>
            {Math.round(zoom * 100)}%
          </span>
        </div>

        {/* Footer */}
        <div style={{ padding: '16px 24px 24px', borderTop: '1px solid #1A2418', display: 'flex', gap: '10px' }}>
          <button onClick={onCancel}
            style={{ flex: 1, padding: '12px', border: '1px solid #1A2418', background: 'transparent', color: 'rgba(240,240,240,0.5)', fontFamily: 'var(--font-inter)', fontSize: '11px', letterSpacing: '0.15em', textTransform: 'uppercase', cursor: 'pointer', transition: 'all 0.2s' }}
            onMouseEnter={(e) => { e.currentTarget.style.borderColor = '#F07820'; e.currentTarget.style.color = '#F07820'; }}
            onMouseLeave={(e) => { e.currentTarget.style.borderColor = '#1A2418'; e.currentTarget.style.color = 'rgba(240,240,240,0.5)'; }}>
            Cancelar
          </button>
          <button onClick={handleConfirm} disabled={processing}
            style={{ flex: 2, padding: '12px', border: 'none', backgroundColor: processing ? '#1A2418' : '#F07820', color: '#F0F0F0', fontFamily: 'var(--font-inter)', fontSize: '11px', letterSpacing: '0.15em', textTransform: 'uppercase', cursor: processing ? 'default' : 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', fontWeight: 600, transition: 'background-color 0.2s' }}
            onMouseEnter={(e) => { if (!processing) e.currentTarget.style.backgroundColor = '#FF8C35'; }}
            onMouseLeave={(e) => { if (!processing) e.currentTarget.style.backgroundColor = '#F07820'; }}>
            {processing ? 'Procesando...' : <><Check size={14} /> Guardar foto</>}
          </button>
        </div>
      </div>
    </div>
  );
}
