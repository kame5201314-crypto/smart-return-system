'use client';

import { useState, useEffect } from 'react';
import { format } from 'date-fns';
import { zhTW } from 'date-fns/locale';
import {
  Download,
  Trash2,
  Database,
  Clock,
  HardDrive,
  RefreshCw,
  FileJson,
  FileSpreadsheet,
  CheckCircle2,
  AlertCircle,
} from 'lucide-react';
import { toast } from 'sonner';
import ExcelJS from 'exceljs';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';

import {
  getBackupHistory,
  createBackup,
  downloadBackup,
  deleteBackup,
  type BackupRecord,
  type BackupData,
} from '@/lib/actions/backup.actions';

// 備份的表配置
const BACKUP_TABLES = {
  return_management: {
    label: '退貨管理',
    tables: ['return_requests', 'return_items', 'return_images'],
  },
  shopee_returns: {
    label: '蝦皮退貨',
    tables: ['shopee_returns'],
  },
  pickup: {
    label: '派車收件',
    tables: ['pickup_records'],
  },
} as const;

const PICKUP_STORAGE_KEY = 'pickup-records';

export default function BackupPage() {
  const [backupHistory, setBackupHistory] = useState<BackupRecord[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isBackingUp, setIsBackingUp] = useState(false);
  const [selectedTables, setSelectedTables] = useState<string[]>([
    'return_management',
    'shopee_returns',
    'pickup',
  ]);

  useEffect(() => {
    loadBackupHistory();
  }, []);

  async function loadBackupHistory() {
    setIsLoading(true);
    const result = await getBackupHistory();
    if (result.success && result.data) {
      setBackupHistory(result.data);
    }
    setIsLoading(false);
  }

  function toggleTable(tableKey: string) {
    setSelectedTables((prev) =>
      prev.includes(tableKey)
        ? prev.filter((t) => t !== tableKey)
        : [...prev, tableKey]
    );
  }

  // 獲取 localStorage 中的派車收件數據
  function getPickupRecords(): unknown[] {
    if (typeof window === 'undefined') return [];
    const data = localStorage.getItem(PICKUP_STORAGE_KEY);
    return data ? JSON.parse(data) : [];
  }

  // 手動備份 - 下載 JSON
  async function handleManualBackupJson() {
    if (selectedTables.length === 0) {
      toast.error('請至少選擇一個備份項目');
      return;
    }

    setIsBackingUp(true);
    try {
      const pickupRecords = selectedTables.includes('pickup') ? getPickupRecords() : undefined;
      const result = await createBackup(selectedTables, 'manual', pickupRecords);

      if (result.success && result.data) {
        // 下載 JSON 文件
        const jsonString = JSON.stringify(result.data.data, null, 2);
        const blob = new Blob([jsonString], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `backup_${format(new Date(), 'yyyy-MM-dd_HHmmss')}.json`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);

        toast.success('備份完成，已下載 JSON 檔案');
      } else {
        toast.error(result.error || '備份失敗');
      }
    } catch (error) {
      console.error('Backup error:', error);
      toast.error('備份失敗');
    } finally {
      setIsBackingUp(false);
    }
  }

  // 手動備份 - 下載 Excel
  async function handleManualBackupExcel() {
    if (selectedTables.length === 0) {
      toast.error('請至少選擇一個備份項目');
      return;
    }

    setIsBackingUp(true);
    try {
      const pickupRecords = selectedTables.includes('pickup') ? getPickupRecords() : undefined;
      const result = await createBackup(selectedTables, 'manual', pickupRecords);

      if (result.success && result.data) {
        const backupData = result.data.data as BackupData;
        const workbook = new ExcelJS.Workbook();

        // 為每個表創建工作表
        if (backupData.data.return_requests && backupData.data.return_requests.length > 0) {
          const ws = workbook.addWorksheet('退貨申請');
          const data = backupData.data.return_requests as Record<string, unknown>[];
          if (data.length > 0) {
            ws.columns = Object.keys(data[0]).map(key => ({ header: key, key }));
            ws.addRows(data);
          }
        }
        if (backupData.data.return_items && backupData.data.return_items.length > 0) {
          const ws = workbook.addWorksheet('退貨商品');
          const data = backupData.data.return_items as Record<string, unknown>[];
          if (data.length > 0) {
            ws.columns = Object.keys(data[0]).map(key => ({ header: key, key }));
            ws.addRows(data);
          }
        }
        if (backupData.data.return_images && backupData.data.return_images.length > 0) {
          const ws = workbook.addWorksheet('退貨照片');
          const data = backupData.data.return_images as Record<string, unknown>[];
          if (data.length > 0) {
            ws.columns = Object.keys(data[0]).map(key => ({ header: key, key }));
            ws.addRows(data);
          }
        }
        if (backupData.data.shopee_returns && backupData.data.shopee_returns.length > 0) {
          const ws = workbook.addWorksheet('蝦皮退貨');
          const data = backupData.data.shopee_returns as Record<string, unknown>[];
          if (data.length > 0) {
            ws.columns = Object.keys(data[0]).map(key => ({ header: key, key }));
            ws.addRows(data);
          }
        }
        if (backupData.data.pickup_records && backupData.data.pickup_records.length > 0) {
          const ws = workbook.addWorksheet('派車收件');
          const data = backupData.data.pickup_records as Record<string, unknown>[];
          if (data.length > 0) {
            ws.columns = Object.keys(data[0]).map(key => ({ header: key, key }));
            ws.addRows(data);
          }
        }

        // 添加備份資訊工作表
        const metaSheet = workbook.addWorksheet('備份資訊');
        metaSheet.columns = [
          { header: '備份時間', key: 'time' },
          { header: '備份類型', key: 'type' },
          { header: '包含表格', key: 'tables' },
        ];
        metaSheet.addRow({
          time: backupData.metadata.created_at,
          type: backupData.metadata.backup_type === 'manual' ? '手動' : '自動',
          tables: backupData.metadata.tables.join(', '),
        });

        // 下載
        const buffer = await workbook.xlsx.writeBuffer();
        const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `backup_${format(new Date(), 'yyyy-MM-dd_HHmmss')}.xlsx`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);

        toast.success('備份完成，已下載 Excel 檔案');
      } else {
        toast.error(result.error || '備份失敗');
      }
    } catch (error) {
      console.error('Backup error:', error);
      toast.error('備份失敗');
    } finally {
      setIsBackingUp(false);
    }
  }

  // 下載歷史備份
  async function handleDownloadBackup(record: BackupRecord) {
    const result = await downloadBackup(record.file_path);
    if (result.success && result.data) {
      window.open(result.data.url, '_blank');
      toast.success('開始下載備份');
    } else {
      toast.error(result.error || '下載失敗');
    }
  }

  // 刪除備份
  async function handleDeleteBackup(record: BackupRecord) {
    const result = await deleteBackup(record.id, record.file_path);
    if (result.success) {
      setBackupHistory((prev) => prev.filter((b) => b.id !== record.id));
      toast.success('備份已刪除');
    } else {
      toast.error(result.error || '刪除失敗');
    }
  }

  function formatFileSize(bytes: number): string {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Database className="w-6 h-6" />
            資料備份
          </h1>
          <p className="text-muted-foreground mt-1">
            管理系統資料的備份與還原
          </p>
        </div>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        {/* 手動備份 */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <HardDrive className="w-5 h-5" />
              手動備份
            </CardTitle>
            <CardDescription>
              選擇要備份的資料，立即下載到電腦
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-3">
              <Label className="text-sm font-medium">選擇備份項目</Label>
              {Object.entries(BACKUP_TABLES).map(([key, config]) => (
                <div key={key} className="flex items-center space-x-2">
                  <Checkbox
                    id={key}
                    checked={selectedTables.includes(key)}
                    onCheckedChange={() => toggleTable(key)}
                  />
                  <Label htmlFor={key} className="text-sm cursor-pointer">
                    {config.label}
                    <span className="text-muted-foreground ml-1">
                      ({config.tables.join(', ')})
                    </span>
                  </Label>
                </div>
              ))}
            </div>

            <div className="flex gap-2 pt-2">
              <Button
                onClick={handleManualBackupExcel}
                disabled={isBackingUp || selectedTables.length === 0}
                className="flex-1"
              >
                {isBackingUp ? (
                  <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                ) : (
                  <FileSpreadsheet className="w-4 h-4 mr-2" />
                )}
                下載 Excel
              </Button>
              <Button
                variant="outline"
                onClick={handleManualBackupJson}
                disabled={isBackingUp || selectedTables.length === 0}
                className="flex-1"
              >
                {isBackingUp ? (
                  <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                ) : (
                  <FileJson className="w-4 h-4 mr-2" />
                )}
                下載 JSON
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* 自動備份設定 */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <Clock className="w-5 h-5" />
              自動備份
            </CardTitle>
            <CardDescription>
              系統每日自動備份到雲端儲存
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <div className="flex items-center justify-between py-2 border-b">
                <span className="text-sm">備份頻率</span>
                <Badge variant="secondary">每日 03:00</Badge>
              </div>
              <div className="flex items-center justify-between py-2 border-b">
                <span className="text-sm">備份項目</span>
                <span className="text-sm text-muted-foreground">退貨管理、蝦皮退貨</span>
              </div>
              <div className="flex items-center justify-between py-2 border-b">
                <span className="text-sm">保留天數</span>
                <Badge variant="secondary">30 天</Badge>
              </div>
              <div className="flex items-center justify-between py-2">
                <span className="text-sm">儲存位置</span>
                <span className="text-sm text-muted-foreground">Supabase Storage</span>
              </div>
            </div>

            <div className="bg-blue-50 text-blue-700 p-3 rounded-lg text-sm flex items-start gap-2">
              <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
              <div>
                <p className="font-medium">自動備份說明</p>
                <p className="text-blue-600 mt-1">
                  系統會在每日凌晨 3:00 自動執行備份，備份檔案保存在 Supabase Storage，超過 30 天的舊備份會自動清理。
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* 備份歷史 */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle className="text-lg flex items-center gap-2">
              <Clock className="w-5 h-5" />
              備份歷史
            </CardTitle>
            <CardDescription>
              最近 30 天的自動備份記錄
            </CardDescription>
          </div>
          <Button variant="outline" size="sm" onClick={loadBackupHistory}>
            <RefreshCw className="w-4 h-4 mr-2" />
            重新整理
          </Button>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <RefreshCw className="w-6 h-6 animate-spin text-muted-foreground" />
            </div>
          ) : backupHistory.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <Database className="w-12 h-12 mx-auto mb-3 opacity-50" />
              <p>尚無備份記錄</p>
              <p className="text-sm mt-1">自動備份將在每日凌晨 3:00 執行</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>備份時間</TableHead>
                  <TableHead>類型</TableHead>
                  <TableHead>大小</TableHead>
                  <TableHead>包含資料</TableHead>
                  <TableHead className="text-right">操作</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {backupHistory.map((record) => (
                  <TableRow key={record.id}>
                    <TableCell>
                      {format(new Date(record.created_at), 'yyyy-MM-dd HH:mm', { locale: zhTW })}
                    </TableCell>
                    <TableCell>
                      <Badge variant={record.backup_type === 'auto' ? 'secondary' : 'outline'}>
                        {record.backup_type === 'auto' ? '自動' : '手動'}
                      </Badge>
                    </TableCell>
                    <TableCell>{formatFileSize(record.file_size)}</TableCell>
                    <TableCell>
                      <div className="flex gap-1 flex-wrap">
                        {record.tables_included.map((table) => (
                          <Badge key={table} variant="outline" className="text-xs">
                            {BACKUP_TABLES[table as keyof typeof BACKUP_TABLES]?.label || table}
                          </Badge>
                        ))}
                      </div>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex gap-1 justify-end">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleDownloadBackup(record)}
                        >
                          <Download className="w-4 h-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="text-red-600"
                          onClick={() => {
                            if (confirm('確定要刪除此備份？此操作無法復原。')) {
                              handleDeleteBackup(record);
                            }
                          }}
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* 設定提示 */}
      <Card className="bg-amber-50 border-amber-200">
        <CardContent className="pt-6">
          <div className="flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
            <div className="text-sm">
              <p className="font-medium text-amber-800">首次使用需完成以下設定：</p>
              <ol className="list-decimal list-inside mt-2 space-y-1 text-amber-700">
                <li>在 Supabase Dashboard 創建 Storage Bucket：<code className="bg-amber-100 px-1 rounded">backups</code></li>
                <li>在 Supabase 執行 SQL 創建備份記錄表（見下方）</li>
                <li>在 Vercel 環境變數設定 <code className="bg-amber-100 px-1 rounded">CRON_SECRET</code></li>
              </ol>
              <details className="mt-3">
                <summary className="cursor-pointer text-amber-800 font-medium">查看 SQL 語句</summary>
                <pre className="mt-2 bg-amber-100 p-3 rounded text-xs overflow-x-auto">
{`-- 創建備份記錄表
CREATE TABLE backup_records (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  backup_name TEXT NOT NULL,
  backup_type TEXT NOT NULL CHECK (backup_type IN ('manual', 'auto')),
  file_path TEXT NOT NULL,
  file_size INTEGER NOT NULL,
  tables_included TEXT[] NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 創建索引
CREATE INDEX idx_backup_records_created_at ON backup_records(created_at DESC);`}
                </pre>
              </details>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
