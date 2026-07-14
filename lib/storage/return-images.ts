const RETURN_IMAGES_BUCKET = 'return-images';
const STORAGE_REFERENCE_PREFIX = `storage://${RETURN_IMAGES_BUCKET}/`;
const RETURN_IMAGE_SIGNED_URL_TTL_SECONDS = 60 * 60;

type SignedUrlResult = {
  data: { signedUrl: string } | null;
  error: { message?: string } | null;
};

type ReturnImageStorageClient = {
  storage: {
    from: (bucket: string) => {
      createSignedUrl: (path: string, expiresIn: number) => Promise<SignedUrlResult>;
    };
  };
};

export type ReturnImageRecordForSigning = {
  image_url: string;
  storage_path?: string | null;
};

export function buildReturnImageStorageReference(storagePath: string): string {
  return `${STORAGE_REFERENCE_PREFIX}${storagePath}`;
}

export function getReturnImageStoragePath(image: ReturnImageRecordForSigning): string | null {
  const explicitPath = image.storage_path?.trim();
  if (explicitPath) {
    return explicitPath;
  }

  if (image.image_url.startsWith(STORAGE_REFERENCE_PREFIX)) {
    return image.image_url.slice(STORAGE_REFERENCE_PREFIX.length);
  }

  return null;
}

export async function createReturnImageSignedUrl(
  client: ReturnImageStorageClient,
  storagePath: string
): Promise<string> {
  const { data, error } = await client.storage
    .from(RETURN_IMAGES_BUCKET)
    .createSignedUrl(storagePath, RETURN_IMAGE_SIGNED_URL_TTL_SECONDS);

  if (error || !data?.signedUrl) {
    throw new Error(error?.message || 'Failed to create signed return image URL');
  }

  return data.signedUrl;
}

export async function signReturnImageUrl<T extends ReturnImageRecordForSigning>(
  client: ReturnImageStorageClient,
  image: T
): Promise<T> {
  const storagePath = getReturnImageStoragePath(image);
  if (!storagePath) {
    return image;
  }

  try {
    const signedUrl = await createReturnImageSignedUrl(client, storagePath);
    return {
      ...image,
      image_url: signedUrl,
      storage_path: storagePath,
    };
  } catch (error) {
    console.error('Create return image signed URL error:', error);
    return image;
  }
}

export async function signReturnImageUrls<T extends ReturnImageRecordForSigning>(
  client: ReturnImageStorageClient,
  images: T[] | null | undefined
): Promise<T[]> {
  if (!images || images.length === 0) {
    return [];
  }

  return Promise.all(images.map((image) => signReturnImageUrl(client, image)));
}
