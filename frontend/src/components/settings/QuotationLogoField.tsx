import { useRef } from 'react';
import { Field } from '../Modal';

const MAX_LOGO_BYTES = 400_000;

type Props = {
  value: string;
  onChange: (url: string) => void;
  disabled?: boolean;
};

export function QuotationLogoField({ value, onChange, disabled }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);

  async function onFileSelect(file: File | null) {
    if (!file || disabled) return;
    if (!file.type.startsWith('image/')) {
      window.alert('Please choose a PNG, JPG, WebP, or SVG image.');
      return;
    }
    if (file.size > MAX_LOGO_BYTES) {
      window.alert('Logo must be under 400 KB.');
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      const result = typeof reader.result === 'string' ? reader.result : '';
      onChange(result);
    };
    reader.readAsDataURL(file);
  }

  return (
    <div className="quote-logo-field">
      <Field label="Logo for invoice & quotation">
        <p className="quote-logo-hint">
          Upload your company logo (PNG, JPG, WebP, or SVG). Appears on quotation and invoice headers.
        </p>
        <div className="quote-logo-upload-row">
          <button
            type="button"
            className="quote-logo-choose-btn"
            disabled={disabled}
            onClick={() => inputRef.current?.click()}
          >
            Choose image
          </button>
          {value ? (
            <button
              type="button"
              className="quote-logo-remove-btn"
              disabled={disabled}
              onClick={() => onChange('')}
            >
              Remove logo
            </button>
          ) : null}
          <input
            ref={inputRef}
            type="file"
            accept="image/png,image/jpeg,image/webp,image/svg+xml"
            className="sr-only"
            disabled={disabled}
            onChange={(e) => void onFileSelect(e.target.files?.[0] ?? null)}
          />
        </div>
      </Field>
      {value ? (
        <div className="quote-logo-preview">
          <p className="quote-logo-preview-label">Preview</p>
          <img src={value} alt="Company logo preview" />
        </div>
      ) : (
        <div className="quote-logo-placeholder">
          <span>No logo uploaded</span>
        </div>
      )}
    </div>
  );
}
