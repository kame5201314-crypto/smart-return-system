import { act, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useState } from 'react';

let capturedOnDrop: ((acceptedFiles: File[]) => Promise<void> | void) | null = null;

vi.mock('react-dropzone', () => ({
  useDropzone: (options: { onDrop: (acceptedFiles: File[]) => Promise<void> | void }) => {
    capturedOnDrop = options.onDrop;
    return {
      getRootProps: () => ({}),
      getInputProps: () => ({}),
      isDragActive: false,
    };
  },
}));

import { DirectImageUploader, type UploadedImage } from '@/components/upload/direct-image-uploader';

const getUploadSessionMock = vi.fn(async () => ({
  draftId: 'd7f16050-16d8-4d7f-ae4c-ec89b6a31f5c',
  sessionToken: 'session-token',
  expiresAt: Date.now() + 60_000,
}));

function UploaderHarness() {
  const [images, setImages] = useState<UploadedImage[]>([]);
  return (
    <DirectImageUploader
      images={images}
      onImagesChange={setImages}
      maxImages={5}
      maxFileSizeMB={10}
      folder="product-photos"
      getUploadSession={getUploadSessionMock}
    />
  );
}

async function triggerDrop(files: File[]) {
  if (!capturedOnDrop) {
    throw new Error('Drop handler was not captured');
  }
  await capturedOnDrop(files);
}

describe('DirectImageUploader UI', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    capturedOnDrop = null;
    getUploadSessionMock.mockClear();
  });

  it('uploads a selected file and renders a preview', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          signedUrl: 'https://storage.example/upload',
          path: 'product-photos/123_file.jpg',
          imageUrl: 'storage://return-images/product-photos/123_file.jpg',
        }),
      })
      .mockResolvedValueOnce({ ok: true });

    vi.stubGlobal('fetch', fetchMock as unknown as typeof fetch);

    render(<UploaderHarness />);

    const file = new File(['hello'], 'small.jpg', { type: 'image/jpeg' });
    await act(async () => {
      await triggerDrop([file]);
    });

    expect(await screen.findByAltText('Preview')).toBeInTheDocument();
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(getUploadSessionMock).toHaveBeenCalledTimes(1);
  });

  it('sends the compressed MIME type to signed-url API and upload PUT request', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          signedUrl: 'https://storage.example/upload',
          path: 'product-photos/123_file.jpg',
          imageUrl: 'storage://return-images/product-photos/123_file.jpg',
        }),
      })
      .mockResolvedValueOnce({ ok: true });

    vi.stubGlobal('fetch', fetchMock as unknown as typeof fetch);

    const originalCreateElement = document.createElement.bind(document);
    const createElementSpy = vi
      .spyOn(document, 'createElement')
      .mockImplementation(((tagName: string, options?: ElementCreationOptions) => {
        if (tagName === 'canvas') {
          return {
            width: 0,
            height: 0,
            getContext: () => ({ drawImage: vi.fn() }),
            toBlob: (callback: BlobCallback, type?: string) => {
              callback(new Blob(['compressed'], { type: type ?? 'image/jpeg' }));
            },
          } as unknown as HTMLCanvasElement;
        }
        return originalCreateElement(tagName, options);
      }) as Document['createElement']);

    class MockImage {
      onload: (() => void) | null = null;
      onerror: (() => void) | null = null;
      width = 2000;
      height = 1000;

      set src(_value: string) {
        this.onload?.();
      }
    }

    vi.stubGlobal('Image', MockImage as unknown as typeof Image);

    render(<UploaderHarness />);

    const largePng = new File([new Uint8Array(250 * 1024)], 'large.png', {
      type: 'image/png',
    });

    await act(async () => {
      await triggerDrop([largePng]);
    });

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledTimes(2);
    });

    const signedUrlCall = fetchMock.mock.calls[0];
    const signedUrlPayload = JSON.parse(signedUrlCall?.[1]?.body as string) as {
      fileType: string;
      draftId: string;
      sessionToken: string;
      fileSize: number;
    };
    expect(signedUrlPayload.fileType).toBe('image/jpeg');
    expect(signedUrlPayload.draftId).toBe('d7f16050-16d8-4d7f-ae4c-ec89b6a31f5c');
    expect(signedUrlPayload.sessionToken).toBe('session-token');
    expect(signedUrlPayload.fileSize).toBeGreaterThan(0);

    const uploadCall = fetchMock.mock.calls[1];
    expect(uploadCall?.[1]?.headers).toEqual(
      expect.objectContaining({
        'Content-Type': 'image/jpeg',
      })
    );

    createElementSpy.mockRestore();
  });
});
