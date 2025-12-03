import Link from 'next/link';
import { SiteFooter } from '@/components/SiteFooter';

export const metadata = {
  title: '隱私權聲明 - EasyCheck',
};

export default function PrivacyPage() {
  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
      <main className="max-w-3xl mx-auto px-4 py-10 flex-1">
        <h1 className="text-2xl font-bold text-slate-900 mb-6">隱私權聲明</h1>
        <div className="space-y-4 text-sm leading-relaxed text-slate-700 bg-white rounded-lg border border-slate-200 p-6 shadow-sm">
          <p>
            EasyCheck 活動點名系統僅於活動報到與出席紀錄之目的下，使用您在報名時所提供的基本資料（例如：姓名、報名序號）。
          </p>
          <p>
            這些資料僅供主辦單位用於：
          </p>
          <ul className="list-disc pl-6 space-y-1">
            <li>現場報到與身份確認</li>
            <li>統計出席人數與活動行政紀錄</li>
            <li>必要時與您聯繫活動相關事宜</li>
          </ul>
          <p>
            我們不會將您的個人資料提供給與本活動無關之第三方，亦不作為商業行銷使用。資料主要儲存在由主辦單位管理的 Google
            試算表中，存取權限僅限相關負責同工。
          </p>
          <p>
            若您對個人資料的使用有任何疑問或希望請求更正、刪除，請直接聯絡主辦單位負責人，同工將盡速為您處理。
          </p>
        </div>

        <div className="mt-8">
          <Link
            href="/"
            className="inline-flex items-center px-4 py-2 rounded-md border border-slate-300 bg-white text-sm text-slate-700 hover:bg-slate-100"
          >
            返回首頁
          </Link>
        </div>
      </main>
      <SiteFooter />
    </div>
  );
}
