'use client';

import { QrCode } from 'lucide-react';

export default function IconPreviewPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-100">
      <div className="bg-white p-8 rounded-xl shadow-lg flex flex-col items-center gap-4">
        <p className="text-sm text-slate-600">
          在下方藍色圖示上按右鍵 → 另存圖片為 PNG，作為 favicon 圖檔使用。
        </p>
        <div
          style={{ width: 256, height: 256 }}
          className="bg-blue-600 rounded-3xl flex items-center justify-center"
        >
          <QrCode className="w-40 h-40 text-white" />
        </div>
      </div>
    </div>
  );
}
