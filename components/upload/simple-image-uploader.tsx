'use client';

import { useState, useCallback } from 'react';
import { useDropzone } from 'react-dropzone';
import { Upload, X, AlertCircle } from 'lucide-react';

import { Alert, AlertDescription } from '@/components/ui/alert';

interface UploadedImage {
  id: string;
  file: File;
  preview: string;
}

interface SimpleImageUploaderProps {
  images: UploadedImage[];
  onImagesChange: (images: UploadedImage[]) => void;
  disabled?: boolean;
  maxImages?: number;
  maxFileSizeMB?: number;
}

export function SimpleImageUploader({
  images,
  onImagesChange,
  disabled,
  maxImages = 5,
  maxFileSizeMB = 10,
}: SimpleImageUploaderProps) {
  const [error, setError] = useState<string | null>(null);
  const maxFileSizeBytes = maxFileSizeMB * 1024 * 1024;

  const onDrop = useCallback(
    (acceptedFiles: File[]) => {
      setError(null);

      // Check if adding these would exceed max
      if (images.length + acceptedFiles.length > maxImages) {
        setError(`最多只能上傳 ${maxImages} 張照片`);
        return;
      }

      // Check file sizes
      const oversizedFiles = acceptedFiles.filter(
        (f) => f.size > maxFileSizeBytes
      );
      if (oversizedFiles.length > 0) {
        setError(`檔案大小不得超過 ${maxFileSizeMB}MB`);
        return;
      }

      // Add new images
      const newImages: UploadedImage[] = acceptedFiles.map((file) => ({
        id: crypto.randomUUID(),
        file,
        preview: URL.createObjectURL(file),
      }));

      onImagesChange([...images, ...newImages]);
    },
    [images, onImagesChange, maxImages, maxFileSizeBytes, maxFileSizeMB]
  );

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'image/jpeg': ['.jpg', '.jpeg'],
      'image/png': ['.png'],
      'image/webp': ['.webp'],
      'image/heic': ['.heic'],
    },
    disabled: disabled || images.length >= maxImages,
    maxSize: maxFileSizeBytes,
  });

  const removeImage = (id: string) => {
    const image = images.find((img) => img.id === id);
    if (image) {
      URL.revokeObjectURL(image.preview);
    }
    onImagesChange(images.filter((img) => img.id !== id));
  };

  return (
    <div className="space-y-4">
      {/* Upload area */}
      <div
        {...getRootProps()}
        className={`border-2 border-dashed rounded-lg p-6 text-center transition-colors cursor-pointer
          ${isDragActive ? 'border-purple-500 bg-purple-50' : 'border-gray-300 hover:border-purple-400'}
          ${disabled || images.length >= maxImages ? 'opacity-50 cursor-not-allowed' : ''}
        `}
      >
        <input {...getInputProps()} />
        <Upload className="w-8 h-8 mx-auto mb-3 text-gray-400" />
        {isDragActive ? (
          <p className="text-purple-600 font-medium">放開以上傳照片...</p>
        ) : (
          <div>
            <p className="font-medium text-gray-700">點擊或拖曳照片到此處</p>
            <p className="text-sm text-gray-500 mt-1">
              支援 JPG, PNG, WebP, HEIC (最大 {maxFileSizeMB}MB)
            </p>
          </div>
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
        <div className="grid grid-cols-3 gap-3">
          {images.map((image) => (
            <div key={image.id} className="relative group">
              <div className="aspect-square rounded-lg overflow-hidden bg-gray-100 border">
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
                className="absolute -top-2 -right-2 p-1 bg-red-500 text-white rounded-full shadow-md hover:bg-red-600 transition-colors"
                disabled={disabled}
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Count indicator */}
      <div className="flex items-center justify-between text-sm">
        <span className="text-gray-500">
          已上傳 {images.length} / {maxImages} 張
        </span>
        {images.length > 0 && images.length < maxImages && (
          <span className="text-purple-600">
            還可上傳 {maxImages - images.length} 張
          </span>
        )}
      </div>
    </div>
  );
}
