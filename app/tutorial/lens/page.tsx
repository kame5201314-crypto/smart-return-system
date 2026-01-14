'use client';

import { useEffect } from 'react';

export default function LensTutorialRedirect() {
  useEffect(() => {
    window.location.href = 'https://mefu.s3.ap-southeast-1.amazonaws.com/_MEFU%E5%AE%98%E7%B6%B2/APEXEL%E6%89%8B%E6%A9%9F%E9%8F%A1%E9%A0%AD%E7%B5%84%E8%A3%9D%E6%95%99%E5%AD%B8.html';
  }, []);

  return (
    <div className="min-h-screen flex items-center justify-center">
      <p className="text-gray-500">正在跳轉至鏡頭組裝教學...</p>
    </div>
  );
}
