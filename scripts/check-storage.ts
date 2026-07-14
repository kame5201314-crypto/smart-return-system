import { createClient } from '@supabase/supabase-js';
import 'dotenv/config';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !serviceRoleKey) {
  console.error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY.');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, serviceRoleKey);

async function checkStorage() {
  console.log('Checking Supabase Storage buckets...');

  const { data: buckets, error } = await supabase.storage.listBuckets();

  if (error) {
    console.error('Bucket list error:', error.message);
    process.exitCode = 1;
    return;
  }

  console.log('Buckets:', buckets.map((bucket) => bucket.name).join(', ') || '(none)');

  const returnImagesBucket = buckets.find((bucket) => bucket.name === 'return-images');

  if (!returnImagesBucket) {
    console.log('Creating private return-images bucket...');
    const { error: createError } = await supabase.storage.createBucket('return-images', {
      public: false,
      fileSizeLimit: 10 * 1024 * 1024,
      allowedMimeTypes: [
        'image/jpeg',
        'image/png',
        'image/webp',
        'image/gif',
        'image/heic',
        'image/heif',
      ],
    });

    if (createError) {
      console.error('Create return-images bucket error:', createError.message);
      process.exitCode = 1;
      return;
    }

    console.log('return-images bucket created.');
  } else {
    console.log('return-images bucket exists.');
    if ((returnImagesBucket as { public?: boolean }).public) {
      console.warn('return-images bucket is currently public. After signed URL rollout is deployed, set it to private in Supabase.');
    }
  }

  const pngData = Buffer.from([
    0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A,
    0x00, 0x00, 0x00, 0x0D, 0x49, 0x48, 0x44, 0x52,
    0x00, 0x00, 0x00, 0x01, 0x00, 0x00, 0x00, 0x01,
    0x08, 0x06, 0x00, 0x00, 0x00, 0x1F, 0x15, 0xC4,
    0x89, 0x00, 0x00, 0x00, 0x0A, 0x49, 0x44, 0x41,
    0x54, 0x78, 0x9C, 0x63, 0x00, 0x01, 0x00, 0x00,
    0x05, 0x00, 0x01, 0x0D, 0x0A, 0x2D, 0xB4, 0x00,
    0x00, 0x00, 0x00, 0x49, 0x45, 0x4E, 0x44, 0xAE,
    0x42, 0x60, 0x82,
  ]);
  const testPath = `storage-check/${Date.now()}-test-image.png`;

  const { error: uploadError } = await supabase.storage
    .from('return-images')
    .upload(testPath, pngData, {
      contentType: 'image/png',
      upsert: false,
    });

  if (uploadError) {
    console.error('Upload smoke test error:', uploadError.message);
    process.exitCode = 1;
    return;
  }

  const { data: signedUrlData, error: signedUrlError } = await supabase.storage
    .from('return-images')
    .createSignedUrl(testPath, 60);

  if (signedUrlError || !signedUrlData?.signedUrl) {
    console.error('Signed URL smoke test error:', signedUrlError?.message || 'missing signed URL');
    process.exitCode = 1;
  } else {
    console.log('Signed URL smoke test passed.');
  }

  await supabase.storage.from('return-images').remove([testPath]);
  console.log('Storage smoke test file removed.');
}

checkStorage().catch((error: unknown) => {
  console.error('Storage check failed:', error);
  process.exit(1);
});
