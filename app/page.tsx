import Link from 'next/link';
import { Package, ArrowRight, Shield, BarChart3, Users } from 'lucide-react';

export default function Home() {
  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-50 to-white">
      {/* Hero Section */}
      <header className="container mx-auto px-4 py-16 text-center">
        <div className="flex items-center justify-center gap-3 mb-6">
          <Package className="w-12 h-12 text-primary" />
          <h1 className="text-4xl font-bold">智慧退貨管理系統</h1>
        </div>
        <p className="text-xl text-muted-foreground max-w-2xl mx-auto mb-8">
          整合多通路退貨流程，運用 AI 分析優化營運效率
        </p>
        <div className="flex gap-4 justify-center">
          <Link
            href="/portal"
            className="inline-flex items-center gap-2 px-6 py-3 bg-primary text-white rounded-lg hover:bg-primary/90 transition-colors"
          >
            客戶退貨申請
            <ArrowRight className="w-4 h-4" />
          </Link>
          <Link
            href="/dashboard"
            className="inline-flex items-center gap-2 px-6 py-3 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
          >
            管理員後台
            <ArrowRight className="w-4 h-4" />
          </Link>
        </div>
      </header>

      {/* Features */}
      <section className="container mx-auto px-4 py-16">
        <h2 className="text-2xl font-bold text-center mb-12">核心功能</h2>
        <div className="grid md:grid-cols-3 gap-8">
          <div className="p-6 bg-white rounded-xl shadow-sm border">
            <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center mb-4">
              <Users className="w-6 h-6 text-blue-600" />
            </div>
            <h3 className="text-lg font-semibold mb-2">客戶自助服務</h3>
            <p className="text-muted-foreground">
              客戶可自行上傳退貨照片、選擇退回方式，並即時追蹤退貨進度
            </p>
          </div>
          <div className="p-6 bg-white rounded-xl shadow-sm border">
            <div className="w-12 h-12 bg-green-100 rounded-lg flex items-center justify-center mb-4">
              <Package className="w-6 h-6 text-green-600" />
            </div>
            <h3 className="text-lg font-semibold mb-2">看板式管理</h3>
            <p className="text-muted-foreground">
              直覺的 Kanban 視圖，一眼掌握所有退貨單處理進度
            </p>
          </div>
          <div className="p-6 bg-white rounded-xl shadow-sm border">
            <div className="w-12 h-12 bg-purple-100 rounded-lg flex items-center justify-center mb-4">
              <BarChart3 className="w-6 h-6 text-purple-600" />
            </div>
            <h3 className="text-lg font-semibold mb-2">AI 智能分析</h3>
            <p className="text-muted-foreground">
              運用 AI 分析退貨數據，產生核心痛點診斷與優化建議
            </p>
          </div>
        </div>
      </section>

      {/* Security */}
      <section className="bg-gray-50 py-16">
        <div className="container mx-auto px-4">
          <div className="flex items-center justify-center gap-3 mb-6">
            <Shield className="w-8 h-8 text-green-600" />
            <h2 className="text-2xl font-bold">安全第一</h2>
          </div>
          <div className="grid md:grid-cols-2 gap-8 max-w-3xl mx-auto">
            <div className="flex gap-4">
              <div className="w-2 h-2 bg-green-500 rounded-full mt-2" />
              <div>
                <h3 className="font-semibold mb-1">多租戶架構</h3>
                <p className="text-sm text-muted-foreground">
                  資料完全隔離，預留 org_id 支援未來擴展
                </p>
              </div>
            </div>
            <div className="flex gap-4">
              <div className="w-2 h-2 bg-green-500 rounded-full mt-2" />
              <div>
                <h3 className="font-semibold mb-1">環境變數加密</h3>
                <p className="text-sm text-muted-foreground">
                  所有敏感資訊透過 .env.local 管理，不進版控
                </p>
              </div>
            </div>
            <div className="flex gap-4">
              <div className="w-2 h-2 bg-green-500 rounded-full mt-2" />
              <div>
                <h3 className="font-semibold mb-1">Server Actions</h3>
                <p className="text-sm text-muted-foreground">
                  敏感邏輯僅在伺服器端執行，避免暴露於客戶端
                </p>
              </div>
            </div>
            <div className="flex gap-4">
              <div className="w-2 h-2 bg-green-500 rounded-full mt-2" />
              <div>
                <h3 className="font-semibold mb-1">Row Level Security</h3>
                <p className="text-sm text-muted-foreground">
                  Supabase RLS 確保資料存取權限控管
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="container mx-auto px-4 py-8 text-center text-sm text-muted-foreground">
        <p>Smart Return System (ORS) - Built with Next.js, Supabase, and AI</p>
      </footer>
    </div>
  );
}
