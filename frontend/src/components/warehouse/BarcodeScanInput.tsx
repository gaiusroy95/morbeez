import { useCallback, useEffect, useId, useRef, useState } from 'react';
import { Btn, inputClass } from '../ui';

type Props = {
  value: string;
  onChange: (value: string) => void;
  onScan: (code: string) => void;
  placeholder?: string;
  disabled?: boolean;
};

type BarcodeDetectorLike = {
  detect: (source: ImageBitmapSource) => Promise<Array<{ rawValue: string }>>;
};

function hasBarcodeDetector(): boolean {
  return typeof window !== 'undefined' && 'BarcodeDetector' in window;
}

export function BarcodeScanInput({
  value,
  onChange,
  onScan,
  placeholder = 'Scan barcode / SKU / batch',
  disabled = false,
}: Props) {
  const videoId = useId().replace(/:/g, '');
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const rafRef = useRef<number | null>(null);
  const [cameraOn, setCameraOn] = useState(false);
  const [cameraError, setCameraError] = useState('');
  const [detectorSupported] = useState(hasBarcodeDetector());

  const stopCamera = useCallback(() => {
    if (rafRef.current != null) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    setCameraOn(false);
  }, []);

  useEffect(() => () => stopCamera(), [stopCamera]);

  const scanLoop = useCallback(async () => {
    const video = videoRef.current;
    if (!video || video.readyState < 2 || !hasBarcodeDetector()) return;
    try {
      const Detector = (window as unknown as { BarcodeDetector: new (opts: { formats: string[] }) => BarcodeDetectorLike })
        .BarcodeDetector;
      const detector = new Detector({
        formats: ['qr_code', 'code_128', 'code_39', 'ean_13', 'ean_8', 'upc_a', 'upc_e'],
      });
      const codes = await detector.detect(video);
      const hit = codes[0]?.rawValue?.trim();
      if (hit) {
        onChange(hit);
        onScan(hit);
        stopCamera();
        return;
      }
    } catch {
      /* ignore frame errors */
    }
    rafRef.current = requestAnimationFrame(() => void scanLoop());
  }, [onChange, onScan, stopCamera]);

  async function startCamera() {
    if (!detectorSupported || disabled) return;
    setCameraError('');
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { ideal: 'environment' } },
        audio: false,
      });
      streamRef.current = stream;
      const video = videoRef.current;
      if (!video) return;
      video.srcObject = stream;
      await video.play();
      setCameraOn(true);
      rafRef.current = requestAnimationFrame(() => void scanLoop());
    } catch (e) {
      setCameraError(e instanceof Error ? e.message : 'Camera access denied');
      stopCamera();
    }
  }

  return (
    <div className="barcode-scan-input">
      <div className="barcode-scan-row">
        <input
          className={inputClass}
          placeholder={placeholder}
          value={value}
          disabled={disabled}
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && value.trim()) onScan(value.trim());
          }}
        />
        <Btn size="sm" disabled={disabled || !value.trim()} onClick={() => onScan(value.trim())}>
          Submit
        </Btn>
        {detectorSupported ? (
          <Btn
            size="sm"
            variant="secondary"
            disabled={disabled}
            onClick={() => (cameraOn ? stopCamera() : void startCamera())}
          >
            {cameraOn ? 'Stop camera' : 'Scan with camera'}
          </Btn>
        ) : null}
      </div>
      {cameraError ? <p className="barcode-scan-error">{cameraError}</p> : null}
      {!detectorSupported ? (
        <p className="barcode-scan-hint text-sm text-ink-muted">
          Camera scan needs Chrome or Edge. Type or paste codes manually on this device.
        </p>
      ) : null}
      {cameraOn ? (
        <div className="barcode-scan-video-wrap">
          <video ref={videoRef} id={videoId} className="barcode-scan-video" playsInline muted />
          <p className="text-sm text-ink-muted">Point camera at barcode or QR code</p>
        </div>
      ) : null}
    </div>
  );
}
