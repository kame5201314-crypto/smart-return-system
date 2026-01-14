import { createClient } from '@supabase/supabase-js';
import 'dotenv/config';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !serviceRoleKey) {
  console.error('❌ 請設定環境變數 NEXT_PUBLIC_SUPABASE_URL 和 SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, serviceRoleKey);

async function checkStorage() {
  console.log('檢查 Storage Buckets...\n');

  const { data: buckets, error } = await supabase.storage.listBuckets();

  if (error) {
    console.error('錯誤:', error.message);
    return;
  }

  console.log('現有 Buckets:', buckets.map(b => b.name));

  // Check if return-images bucket exists
  const returnImagesBucket = buckets.find(b => b.name === 'return-images');

  if (!returnImagesBucket) {
    console.log('\n建立 return-images bucket...');
    const { error: createError } = await supabase.storage.createBucket('return-images', {
      public: true,
      fileSizeLimit: 10485760, // 10MB
      allowedMimeTypes: ['image/jpeg', 'image/png', 'image/webp', 'image/gif']
    });

    if (createError) {
      console.error('建立失敗:', createError.message);
    } else {
      console.log('✅ return-images bucket 建立成功');
    }
  } else {
    console.log('✅ return-images bucket 已存在');
  }

  // Test upload with image MIME type
  console.log('\n測試圖片上傳...');
  // Create a minimal valid PNG (1x1 transparent pixel)
  const pngData = Buffer.from([
    0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A, // PNG signature
    0x00, 0x00, 0x00, 0x0D, 0x49, 0x48, 0x44, 0x52, // IHDR chunk
    0x00, 0x00, 0x00, 0x01, 0x00, 0x00, 0x00, 0x01,
    0x08, 0x06, 0x00, 0x00, 0x00, 0x1F, 0x15, 0xC4,
    0x89, 0x00, 0x00, 0x00, 0x0A, 0x49, 0x44, 0x41, // IDAT chunk
    0x54, 0x78, 0x9C, 0x63, 0x00, 0x01, 0x00, 0x00,
    0x05, 0x00, 0x01, 0x0D, 0x0A, 0x2D, 0xB4, 0x00,
    0x00, 0x00, 0x00, 0x49, 0x45, 0x4E, 0x44, 0xAE, // IEND chunk
    0x42, 0x60, 0x82
  ]);

  const { error: uploadError } = await supabase.storage
    .from('return-images')
    .upload('test-image.png', pngData, {
      contentType: 'image/png',
      upsert: true
    });

  if (uploadError) {
    console.error('上傳測試失敗:', uploadError.message);
  } else {
    console.log('✅ 圖片上傳測試成功');

    // Get public URL
    const { data: urlData } = supabase.storage
      .from('return-images')
      .getPublicUrl('test-image.png');
    console.log('Public URL:', urlData.publicUrl);

    // Clean up
    await supabase.storage.from('return-images').remove(['test-image.png']);
    console.log('✅ 測試檔案已清除');
  }
}

checkStorage();
