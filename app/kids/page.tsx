'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { QrCode, ExternalLink, Settings, Copy } from 'lucide-react';
import { SiteFooter } from '@/components/SiteFooter';
import QRCode from 'qrcode';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

interface EventConfig {
  eventId: string;
  name: string;
  sheetId: string;
  note?: string;
  version?: string;
}

export default function KidsHomePage() {
  const pathname = usePathname();
  const [events, setEvents] = useState<EventConfig[]>([]);
  const [selectedEventId, setSelectedEventId] = useState('');
  const [loadingEvents, setLoadingEvents] = useState(false);
  const [qrCodeUrl, setQrCodeUrl] = useState('');
  const [checkinUrl, setCheckinUrl] = useState('');
  const [adminUrl, setAdminUrl] = useState('');
  const [managerUrl, setManagerUrl] = useState('');
  const [dashboardUrl, setDashboardUrl] = useState('');
  const [selectedEvent, setSelectedEvent] = useState<EventConfig | null>(null);
  const [copyMessage, setCopyMessage] = useState('');

  useEffect(() => {
    const loadEvents = async () => {
      setLoadingEvents(true);
      try {
        const res = await fetch('/api/events/list');
        const data = await res.json();
        if (data.success) {
          setEvents(data.data || []);
        } else {
          console.error('載入活動設定失敗：', data.message);
        }
      } catch (error) {
        console.error('載入活動設定錯誤：', error);
      } finally {
        setLoadingEvents(false);
      }
    };

    loadEvents();
  }, []);

  const generateQRCode = async () => {
    const event = events.find((e) => e.eventId === selectedEventId);

    if (!event) {
      alert('請先選擇一個活動');
      return;
    }

    if (!event.sheetId) {
      alert('此活動尚未設定試算表連結，請先在活動設定表中填寫');
      return;
    }

    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || window.location.origin;
    // 兒童版：報到頁面改為使用 kids-check 介面，由工作人員管理報到
    const checkPageUrl = `${baseUrl}/kids-check/${event.eventId}?sheet=${encodeURIComponent(event.sheetId)}`;
    const managerPageUrl = `${baseUrl}/kids-manager/${event.eventId}?sheet=${encodeURIComponent(event.sheetId)}`;
    setCheckinUrl(checkPageUrl);
    setAdminUrl(
      `${baseUrl}/kids-admin/${event.eventId}?sheet=${encodeURIComponent(event.sheetId)}`
    );
    setManagerUrl(managerPageUrl);
    setDashboardUrl(
      `${baseUrl}/kids-dashboard/${event.eventId}?sheet=${encodeURIComponent(event.sheetId)}`
    );

    try {
      const qrDataUrl = await QRCode.toDataURL(checkPageUrl, {
        width: 300,
        margin: 2,
        color: {
          dark: '#000000',
          light: '#FFFFFF',
        },
      });
      setQrCodeUrl(qrDataUrl);
    } catch (error) {
      console.error('Error generating QR code:', error);
      alert('產生 QR Code 失敗');
    }
  };

  const downloadQRCode = () => {
    if (!qrCodeUrl) return;

    const link = document.createElement('a');
    link.href = qrCodeUrl;
    link.download = `qrcode_${selectedEventId || 'event'}.png`;
    link.click();
  };

  const handleCopy = async (text: string) => {
    if (!text) return;
    try {
      await navigator.clipboard.writeText(text);
      setCopyMessage('已複製連結');
      setTimeout(() => setCopyMessage(''), 2000);
    } catch (error) {
      console.error('Copy failed:', error);
    }
  };

  // 兒童版首頁：只顯示版本為「兒童」的活動
  const filteredEvents = events.filter((ev: EventConfig) => ev.version === '兒童');

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 via-blue-50 to-indigo-100">
      {/* Header */}
      <header className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 py-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 bg-primary rounded-lg flex items-center justify-center">
                <QrCode className="w-6 h-6 text-primary-foreground" />
              </div>
              <div>
                <h1 className="text-2xl font-bold text-slate-900">EasyCheck</h1>
                <p className="text-sm text-slate-600">活動點名系統（兒童版）</p>
              </div>
            </div>
            <div className="flex items-center space-x-3">
              <nav className="flex items-center space-x-2 text-sm">
                <Link
                  href="/"
                  className={`px-3 py-1.5 rounded-full border text-xs md:text-sm transition-colors ${
                    pathname === '/'
                      ? 'bg-slate-900 text-white border-slate-900'
                      : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-100'
                  }`}
                >
                  同工版
                </Link>
                <Link
                  href="/kids"
                  className={`px-3 py-1.5 rounded-full border text-xs md:text-sm transition-colors ${
                    pathname.startsWith('/kids')
                      ? 'bg-slate-900 text-white border-slate-900'
                      : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-100'
                  }`}
                >
                  兒童版
                </Link>
              </nav>
              <a
                href="https://docs.google.com/spreadsheets/d/17SKb8HOmj23tmk7NRpIcHLEG6Dc0CXjGWIj2_cdGUAM/edit?gid=0#gid=0"
                target="_blank"
                rel="noopener noreferrer"
              >
                <Button
                  variant="outline"
                  size="sm"
                  className="hidden sm:inline-flex"
                >
                  活動設定表
                  <ExternalLink className="w-3 h-3 ml-1" />
                </Button>
              </a>
              <a
                href="https://drive.google.com/drive/u/0/folders/1YnEJHT3jx99HlOZrQEBFnYeWYbov_gwd"
                target="_blank"
                rel="noopener noreferrer"
              >
                <Button
                  variant="outline"
                  size="sm"
                  className="hidden sm:inline-flex"
                >
                  出席名單資料夾
                  <ExternalLink className="w-3 h-3 ml-1" />
                </Button>
              </a>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 py-12">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Left Column - Generator */}
          <div className="space-y-6">
            <Card className="shadow-xl">
              <CardHeader>
                <CardTitle className="text-2xl">產生活動 QR Code</CardTitle>
                <CardDescription>
                  從活動設定中選擇一個活動，產生該活動的報到相關 QR Code 與連結
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium">選擇活動</label>
                  <select
                    className="w-full h-11 rounded-md border border-slate-300 bg-white px-3 text-sm text-slate-900 shadow-sm focus:outline-none focus:ring-2 focus:ring-slate-400 focus:border-slate-400 disabled:cursor-not-allowed disabled:opacity-50"
                    value={selectedEventId}
                    onChange={(e) => {
                      const id = e.target.value;
                      setSelectedEventId(id);
                      const ev = events.find((ev) => ev.eventId === id) || null;
                      setSelectedEvent(ev);
                    }}
                    disabled={loadingEvents}
                  >
                    <option value="">
                      {loadingEvents ? '載入活動中...' : '請選擇一個活動'}
                    </option>
                    {filteredEvents.map((ev) => (
                      <option key={ev.eventId} value={ev.eventId}>
                        {ev.name || ev.eventId}
                        {ev.note ? `（${ev.note}）` : ''}
                      </option>
                    ))}
                  </select>
                  {selectedEvent && (
                    <p className="text-xs text-muted-foreground mt-1">
                      已選擇活動：
                      <span className="font-medium text-slate-800">{selectedEvent.name}</span>
                      {selectedEvent.note ? `｜${selectedEvent.note}` : ''}
                    </p>
                  )}
                  {!loadingEvents && filteredEvents.length === 0 && (
                    <p className="text-xs text-red-600 mt-1">
                      尚未在活動設定試算表中建立任何活動，請先建立後再回來選擇。
                    </p>
                  )}
                </div>

                <Button
                  onClick={generateQRCode}
                  className="w-full h-12 text-lg"
                >
                  <QrCode className="w-5 h-5 mr-2" />
                  產生 QR Code
                </Button>

                {qrCodeUrl && (
                  <div className="space-y-4 pt-4 border-t">
                    <div className="bg-white p-6 rounded-lg border-2 border-dashed border-slate-300 flex justify-center">
                      <img src={qrCodeUrl} alt="QR Code" className="w-64 h-64" />
                    </div>

                    <Button
                      onClick={downloadQRCode}
                      variant="outline"
                      className="w-full"
                    >
                      下載 QR Code
                    </Button>

                    <div className="space-y-3">
                      <div className="p-3 bg-emerald-50 rounded-lg border border-emerald-200">
                        <div className="flex items-center justify-between mb-1">
                          <p className="text-xs font-medium text-emerald-900">快速報到工具（kids-manager）</p>
                          {managerUrl && (
                            <button
                              type="button"
                              onClick={() => handleCopy(managerUrl)}
                              className="inline-flex items-center text-[11px] text-emerald-700 hover:text-emerald-900"
                            >
                              <Copy className="w-3 h-3 mr-1" /> 複製
                            </button>
                          )}
                        </div>
                        <a
                          href={managerUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-sm text-emerald-700 hover:underline flex items-center"
                        >
                          {managerUrl}
                          <ExternalLink className="w-3 h-3 ml-1" />
                        </a>
                        <p className="text-[11px] text-emerald-700 mt-1">
                          簡化介面，專注於快速搜尋和代為報到
                        </p>
                      </div>

                      <div className="p-3 bg-purple-50 rounded-lg border border-purple-200">
                        <div className="flex items-center justify-between mb-1">
                          <p className="text-xs font-medium text-purple-900">管理後台（需密碼）</p>
                          {adminUrl && (
                            <button
                              type="button"
                              onClick={() => handleCopy(adminUrl)}
                              className="inline-flex items-center text-[11px] text-purple-700 hover:text-purple-900"
                            >
                              <Copy className="w-3 h-3 mr-1" /> 複製
                            </button>
                          )}
                        </div>
                        <a
                          href={adminUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-sm text-purple-600 hover:underline flex items-center"
                        >
                          {adminUrl}
                          <ExternalLink className="w-3 h-3 ml-1" />
                        </a>
                        <p className="text-[11px] text-purple-700 mt-1">
                          包含報到管理功能 + 壓力測試工具
                        </p>
                      </div>

                      <div className="p-3 bg-blue-50 rounded-lg border border-blue-200">
                        <div className="flex items-center justify-between mb-1">
                          <p className="text-xs font-medium text-blue-900">報到管理頁面（現場工作人員專用）</p>
                          {checkinUrl && (
                            <button
                              type="button"
                              onClick={() => handleCopy(checkinUrl)}
                              className="inline-flex items-center text-[11px] text-blue-700 hover:text-blue-900"
                            >
                              <Copy className="w-3 h-3 mr-1" /> 複製
                            </button>
                          )}
                        </div>
                        <a
                          href={checkinUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-sm text-blue-600 hover:underline flex items-center"
                        >
                          {checkinUrl}
                          <ExternalLink className="w-3 h-3 ml-1" />
                        </a>
                        <p className="text-[11px] text-blue-700 mt-1">
                          可查看名單、搜尋、取消報到、標記不會出席等功能
                        </p>
                      </div>

                      <div className="p-3 bg-slate-50 rounded-lg border border-slate-200">
                        <div className="flex items-center justify-between mb-1">
                          <p className="text-xs font-medium text-slate-900">儀表板（即時資訊）</p>
                          {dashboardUrl && (
                            <button
                              type="button"
                              onClick={() => handleCopy(dashboardUrl)}
                              className="inline-flex items-center text-[11px] text-slate-700 hover:text-slate-900"
                            >
                              <Copy className="w-3 h-3 mr-1" /> 複製
                            </button>
                          )}
                        </div>
                        <a
                          href={dashboardUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-sm text-slate-700 hover:underline flex items-center"
                        >
                          {dashboardUrl}
                          <ExternalLink className="w-3 h-3 ml-1" />
                        </a>
                      </div>
                      {copyMessage && (
                        <p className="text-[11px] text-slate-500 mt-1">{copyMessage}</p>
                      )}
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Right Column - Instructions */}
          <div className="space-y-6">
            <Card className="shadow-xl">
              <CardHeader>
                <CardTitle className="text-2xl">使用說明</CardTitle>
              </CardHeader>
              <CardContent className="space-y-6">
                <div>
                  <h3 className="font-semibold text-lg mb-3 flex items-center">
                    <span className="w-8 h-8 bg-primary text-primary-foreground rounded-full flex items-center justify-center mr-2 text-sm">
                      1
                    </span>
                    準備 Google Sheet（活動設定 & 出席名單）
                  </h3>
                  <div className="ml-10 space-y-2 text-sm text-slate-600">
                    <p>• 建立一張「活動設定表」：填入活動名稱、出席名單試算表連結、event ID、備註</p>
                    <p>• 為每個活動建立對應的「出席名單試算表」</p>
                    <p>• 出席名單表第一列標題為：序號、姓名、到達時間、已到，從第二列開始填名單</p>
                  </div>
                </div>

                <div>
                  <h3 className="font-semibold text-lg mb-3 flex items-center">
                    <span className="w-8 h-8 bg-primary text-primary-foreground rounded-full flex items-center justify-center mr-2 text-sm">
                      2
                    </span>
                    選擇活動並產生 QR Code
                  </h3>
                  <div className="ml-10 space-y-2 text-sm text-slate-600">
                    <p>• 在左側從下拉選單中選擇一個已設定好的活動</p>
                    <p>• 點擊「產生 QR Code」產生報到頁、後台、Manager、儀表板的連結</p>
                    <p>• 下載並列印報到用 QR Code，其他連結提供工作人員與主持人使用</p>
                  </div>
                </div>

                <div>
                  <h3 className="font-semibold text-lg mb-3 flex items-center">
                    <span className="w-8 h-8 bg-primary text-primary-foreground rounded-full flex items-center justify-center mr-2 text-sm">
                      3
                    </span>
                    活動當天
                  </h3>
                  <div className="ml-10 space-y-2 text-sm text-slate-600">
                    <p>• 參加者掃描 QR Code 進入報到頁面</p>
                    <p>• 輸入報名序號或姓名</p>
                    <p>• 系統自動記錄報到時間</p>
                    <p>• 工作人員可透過管理後台即時查看</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="shadow-xl bg-gradient-to-br from-blue-50 to-indigo-50 border-blue-200">
              <CardHeader>
                <CardTitle className="text-xl flex items-center">
                  <Settings className="w-5 h-5 mr-2" />
                  功能特色
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ul className="space-y-2 text-sm text-slate-700">
                  <li className="flex items-start">
                    <span className="text-blue-600 mr-2">✓</span>
                    <span>單一 QR Code，所有人共用</span>
                  </li>
                  <li className="flex items-start">
                    <span className="text-blue-600 mr-2">✓</span>
                    <span>自動記錄報到時間</span>
                  </li>
                  <li className="flex items-start">
                    <span className="text-blue-600 mr-2">✓</span>
                    <span>即時查看報到狀況</span>
                  </li>
                  <li className="flex items-start">
                    <span className="text-blue-600 mr-2">✓</span>
                    <span>支援序號或姓名報到</span>
                  </li>
                  <li className="flex items-start">
                    <span className="text-blue-600 mr-2">✓</span>
                    <span>匯出 CSV 報表</span>
                  </li>
                  <li className="flex items-start">
                    <span className="text-blue-600 mr-2">✓</span>
                    <span>響應式設計，手機電腦都適用</span>
                  </li>
                </ul>
              </CardContent>
            </Card>
          </div>
        </div>
      </main>

      <SiteFooter />
    </div>
  );
}
