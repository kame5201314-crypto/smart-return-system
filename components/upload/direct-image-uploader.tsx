'use client';

import { useState, useCallback } from 'react';
import { useDropzone } from 'react-dropzone';
import { Upload, X, AlertCircle, Loader2, CheckCircle } from 'lucide-react';

import { Alert, AlertDescription } from '@/components/ui/alert';

interface UploadedImage {
  id: string;
  file?: File;
  preview: string;
  publicUrl: string;
  storagePath: string;
  status: 'uploading' | 'success' | 'error';
}

interface DirectImageUploaderProps {
  images: UploadedImage[];
  onImagesChange: (images: UploadedImage[]) => void;
  disabled?: boolean;
  maxImages?: number;
  maxFileSizeMB?: number;
  folder?: string;
}

// Compress image before upload for faster speed
async function compressImage(file: File, maxWidth = 1200, quality = 0.7): Promise<File> {
  // Skip compression for small files (< 200KB)
  if (file.size < 200 * 1024) {
    return file;
  }

  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      // Calculate new dimensions
      let width = img.width;
      let height = img.height;

      if (width > maxWidth) {
        height = (height * maxWidth) / width;
        width = maxWidth;
      }

      // Create canvas and compress
      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;

      const ctx = canvas.getContext('2d');
      if (!ctx) {
        resolve(file); // Fallback to original
        return;
      }

      ctx.drawImage(img, 0, 0, width, height);

      canvas.toBlob(
        (blob) => {
          if (blob) {
            const compressedFile = new File([blob], file.name, {
              type: 'image/jpeg',
              lastModified: Date.now(),
            });
            resolve(compressedFile);
          } else {
            resolve(file); // Fallback to original
          }
        },
        'image/jpeg',
        quality
      );
    };

    img.onerror = () => reject(new Error('Failed to load image'));
    img.src = URL.createObjectURL(file);
  });
}

async function uploadImageDirect(
  file: File,
  folder?: string
): Promise<{ publicUrl: string; storagePath: string }> {
  // Compress image before upload
  const compressedFile = await compressImage(file);

  // 1. Get signed URL from our API
  const signedUrlResponse = await fetch('/api/v1/upload/signed-url', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      fileName: compressedFile.name,
      fileType: file.type,
      folder,
    }),
  });

  if (!signedUrlResponse.ok) {
    const error = await signedUrlResponse.json();
    throw new Error(error.error || '無法獲取上傳連結');
  }

  const { signedUrl, path, publicUrl } = await signedUrlResponse.json();

  // 2. Upload file directly to Supabase Storage using signed URL
  const uploadResponse = await fetch(signedUrl, {
    method: 'PUT',
    headers: {
      'Content-Type': compressedFile.type,
    },
    body: compressedFile,
  });

  if (!uploadResponse.ok) {
    throw new Error('上傳檔案失敗');
  }

  return { publicUrl, storagePath: path };
}

export function DirectImageUploader({
  images,
  onImagesChange,
  disabled,
  maxImages = 5,
  maxFileSizeMB = 10,
  folder,
}: DirectImageUploaderProps) {
  const [error, setError] = useState<string | null>(null);
  const maxFileSizeBytes = maxFileSizeMB * 1024 * 1024;

  const onDrop = useCallback(
    async (acceptedFiles: File[]) => {
      setError(null);

      // Check if adding these would exceed max
      const successfulImages = images.filter((img) => img.status === 'success');
      if (successfulImages.length + acceptedFiles.length > maxImages) {
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

      // Create placeholder images with uploading status
      const newImages: UploadedImage[] = acceptedFiles.map((file) => ({
        id: crypto.randomUUID(),
        file,
        preview: URL.createObjectURL(file),
        publicUrl: '',
        storagePath: '',
        status: 'uploading' as const,
      }));

      // Add new images immediately (showing uploading state)
      const updatedImages = [...images, ...newImages];
      onImagesChange(updatedImages);

      // Upload each image in parallel
      const uploadPromises = newImages.map(async (newImage) => {
        try {
          const result = await uploadImageDirect(newImage.file!, folder);
          return {
            ...newImage,
            publicUrl: result.publicUrl,
            storagePath: result.storagePath,
            status: 'success' as const,
          };
        } catch (uploadError) {
          console.error('Upload error:', uploadError);
          setError(
            uploadError instanceof Error ? uploadError.message : '上傳失敗'
          );
          return { ...newImage, status: 'error' as const };
        }
      });

      const uploadedImages = await Promise.all(uploadPromises);

      // Update with final results
      onImagesChange([
        ...images,
        ...uploadedImages,
      ]);
    },
    [images, onImagesChange, maxImages, maxFileSizeBytes, maxFileSizeMB, folder]
  );

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'image/jpeg': ['.jpg', '.jpeg'],
      'image/png': ['.png'],
      'image/webp': ['.webp'],
      'image/heic': ['.heic'],
    },
    disabled:
      disabled || images.filter((img) => img.status !== 'error').length >= maxImages,
    maxSize: maxFileSizeBytes,
  });

  const removeImage = (id: string) => {
    const image = images.find((img) => img.id === id);
    if (image?.preview) {
      URL.revokeObjectURL(image.preview);
    }
    onImagesChange(images.filter((img) => img.id !== id));
  };

  const successfulCount = images.filter((img) => img.status === 'success').length;
  const uploadingCount = images.filter((img) => img.status === 'uploading').length;

  return (
    <div className="space-y-4">
      {/* Upload area */}
      <div
        {...getRootProps()}
        className={`border-2 border-dashed rounded-lg p-6 text-center transition-colors cursor-pointer
          ${isDragActive ? 'border-teal-500 bg-teal-50' : 'border-gray-300 hover:border-teal-400'}
          ${disabled || successfulCount >= maxImages ? 'opacity-50 cursor-not-allowed' : ''}
        `}
      >
        <input {...getInputProps()} />
        <Upload className="w-8 h-8 mx-auto mb-3 text-gray-400" />
        {isDragActive ? (
          <p className="text-teal-600 font-medium">放開以上傳照片...</p>
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
              <div className="aspect-square rounded-lg overflow-hidden bg-gray-100 border relative">
                <img
                  src={image.preview}
                  alt="Preview"
                  className={`w-full h-full object-cover ${
                    image.status === 'uploading' ? 'opacity-50' : ''
                  }`}
                />

                {/* Uploading overlay */}
                {image.status === 'uploading' && (
                  <div className="absolute inset-0 flex items-center justify-center bg-black/30">
                    <Loader2 className="w-6 h-6 text-white animate-spin" />
                  </div>
                )}

                {/* Success indicator */}
                {image.status === 'success' && (
                  <div className="absolute bottom-1 right-1 bg-green-500 rounded-full p-0.5">
                    <CheckCircle className="w-4 h-4 text-white" />
                  </div>
                )}

                {/* Error indicator */}
                {image.status === 'error' && (
                  <div className="absolute inset-0 flex items-center justify-center bg-red-500/30">
                    <AlertCircle className="w-6 h-6 text-red-600" />
                  </div>
                )}
              </div>

              {/* Remove button - always enabled */}
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
          已上傳 {successfulCount} / {maxImages} 張
          {uploadingCount > 0 && (
            <span className="text-teal-600 ml-2">
              ({uploadingCount} 張上傳中...)
            </span>
          )}
        </span>
        {successfulCount > 0 && successfulCount < maxImages && (
          <span className="text-teal-600">
            還可上傳 {maxImages - successfulCount} 張
          </span>
        )}
      </div>
    </div>
  );
}

export type { UploadedImage };
