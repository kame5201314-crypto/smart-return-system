'use client';

import { useState, useCallback } from 'react';
import { useDropzone } from 'react-dropzone';
import { Upload, X, Image as ImageIcon, AlertCircle } from 'lucide-react';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { IMAGE_UPLOAD_CONFIG, REQUIRED_IMAGE_TYPES } from '@/config/constants';

interface UploadedImage {
  id: string;
  file: File;
  preview: string;
  type: string;
}

interface ImageUploaderProps {
  images: UploadedImage[];
  onImagesChange: (images: UploadedImage[]) => void;
  disabled?: boolean;
}

export function ImageUploader({ images, onImagesChange, disabled }: ImageUploaderProps) {
  const [error, setError] = useState<string | null>(null);

  const onDrop = useCallback(
    (acceptedFiles: File[], rejectedFiles: unknown[]) => {
      setError(null);

      // Check if adding these would exceed max
      if (images.length + acceptedFiles.length > IMAGE_UPLOAD_CONFIG.MAX_ALLOWED) {
        setError(`最多只能上傳 ${IMAGE_UPLOAD_CONFIG.MAX_ALLOWED} 張照片`);
        return;
      }

      // Check file sizes
      const oversizedFiles = acceptedFiles.filter(
        (f) => f.size > IMAGE_UPLOAD_CONFIG.MAX_FILE_SIZE_BYTES
      );
      if (oversizedFiles.length > 0) {
        setError(`檔案大小不得超過 ${IMAGE_UPLOAD_CONFIG.MAX_FILE_SIZE_MB}MB`);
        return;
      }

      // Add new images
      const newImages: UploadedImage[] = acceptedFiles.map((file) => ({
        id: crypto.randomUUID(),
        file,
        preview: URL.createObjectURL(file),
        type: 'other', // Default, will be set by user
      }));

      onImagesChange([...images, ...newImages]);
    },
    [images, onImagesChange]
  );

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'image/jpeg': ['.jpg', '.jpeg'],
      'image/png': ['.png'],
      'image/webp': ['.webp'],
      'image/heic': ['.heic'],
    },
    disabled: disabled || images.length >= IMAGE_UPLOAD_CONFIG.MAX_ALLOWED,
    maxSize: IMAGE_UPLOAD_CONFIG.MAX_FILE_SIZE_BYTES,
  });

  const removeImage = (id: string) => {
    const image = images.find((img) => img.id === id);
    if (image) {
      URL.revokeObjectURL(image.preview);
    }
    onImagesChange(images.filter((img) => img.id !== id));
  };

  const updateImageType = (id: string, type: string) => {
    onImagesChange(
      images.map((img) => (img.id === id ? { ...img, type } : img))
    );
  };

  const isValid =
    images.length >= IMAGE_UPLOAD_CONFIG.MIN_REQUIRED &&
    images.length <= IMAGE_UPLOAD_CONFIG.MAX_ALLOWED;

  return (
    <div className="space-y-4">
      {/* Required types info */}
      <div className="text-sm text-muted-foreground">
        <p className="font-medium mb-1">必要照片類型：</p>
        <ul className="list-disc list-inside space-y-1">
          {REQUIRED_IMAGE_TYPES.map((type) => (
            <li key={type.type}>
              {type.label} {type.required && <span className="text-red-500">*</span>}
            </li>
          ))}
        </ul>
      </div>

      {/* Upload area */}
      <div
        {...getRootProps()}
        className={`border-2 border-dashed rounded-lg p-8 text-center transition-colors cursor-pointer
          ${isDragActive ? 'border-primary bg-primary/5' : 'border-gray-300 hover:border-gray-400'}
          ${disabled ? 'opacity-50 cursor-not-allowed' : ''}
        `}
      >
        <input {...getInputProps()} />
        <Upload className="w-10 h-10 mx-auto mb-4 text-gray-400" />
        {isDragActive ? (
          <p className="text-primary">放開以上傳照片...</p>
        ) : (
          <div>
            <p className="font-medium">點擊或拖曳照片到此處</p>
            <p className="text-sm text-muted-foreground mt-1">
              支援 JPG, PNG, WebP, HEIC (最大 {IMAGE_UPLOAD_CONFIG.MAX_FILE_SIZE_MB}MB)
            </p>
          </div>
        )}
      </div>

      {/* Validation message */}
      <div className="flex items-center justify-between text-sm">
        <span className={images.length < IMAGE_UPLOAD_CONFIG.MIN_REQUIRED ? 'text-red-500' : 'text-green-600'}>
          已上傳 {images.length} / {IMAGE_UPLOAD_CONFIG.MIN_REQUIRED}-{IMAGE_UPLOAD_CONFIG.MAX_ALLOWED} 張
        </span>
        {!isValid && images.length > 0 && (
          <span className="text-red-500">
            請上傳至少 {IMAGE_UPLOAD_CONFIG.MIN_REQUIRED} 張照片
          </span>
        )}
      </div>

      {/* Error message */}
      {error && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {/* Preview grid */}
      {images.length > 0 && (
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
          {images.map((image) => (
            <div key={image.id} className="relative group">
              <div className="aspect-square rounded-lg overflow-hidden bg-gray-100">
                <img
                  src={image.preview}
                  alt="Preview"
                  className="w-full h-full object-cover"
                />
              </div>

              {/* Remove button */}
              <button
                type="button"
                onClick={() => removeImage(image.id)}
                className="absolute top-2 right-2 p-1 bg-red-500 text-white rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
                disabled={disabled}
              >
                <X className="w-4 h-4" />
              </button>

              {/* Type selector */}
              <select
                value={image.type}
                onChange={(e) => updateImageType(image.id, e.target.value)}
                className="mt-2 w-full text-sm border rounded px-2 py-1"
                disabled={disabled}
              >
                <option value="shipping_label">物流面單</option>
                <option value="product_damage">商品狀況</option>
                <option value="outer_box">外箱狀況</option>
                <option value="other">其他</option>
              </select>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
