"use client";

import { useState } from "react";
import { Header } from "@/components/shared/header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Plus,
  Edit,
  Trash2,
  Package,
  Ban,
  Image,
  CheckCircle,
} from "lucide-react";

// 模擬規則資料
const mockRules = {
  product_spec: [
    {
      id: "1",
      name: "產品 A 規格",
      product_name: "無線滑鼠 A1",
      product_model: "WM-A1-2024",
      correct_price: 899,
      correct_specs: { 尺寸: "12cm x 6cm", 重量: "85g", 電池: "AA x 2" },
      is_active: true,
    },
    {
      id: "2",
      name: "產品 B 規格",
      product_name: "機械鍵盤 K1",
      product_model: "MK-K1-PRO",
      correct_price: 2999,
      correct_specs: { 軸體: "Cherry MX", 按鍵數: "104", 背光: "RGB" },
      is_active: true,
    },
  ],
  forbidden_word: [
    {
      id: "3",
      name: "廣告禁用詞",
      forbidden_words: ["最低價", "第一名", "絕對", "保證有效", "永久"],
      replacement_suggestions: {
        最低價: "超值優惠",
        第一名: "人氣推薦",
        保證有效: "深受好評",
      },
      is_active: true,
    },
    {
      id: "4",
      name: "醫療相關禁用詞",
      forbidden_words: ["治療", "療效", "醫療級", "臨床證實"],
      is_active: true,
    },
  ],
  brand_guideline: [
    {
      id: "5",
      name: "Logo 使用規範",
      description: "Logo 必須放置於右上角，最小尺寸 50px",
      logo_requirements: { 位置: "右上角", 最小尺寸: "50px", 間距: "20px" },
      is_active: true,
    },
  ],
};

export default function RulesPage() {
  const [isDialogOpen, setIsDialogOpen] = useState(false);

  return (
    <div className="flex flex-col">
      <Header
        title="規則庫管理"
        description="管理產品規格、禁用詞彙與品牌規範"
      />

      <div className="flex-1 space-y-6 p-6">
        {/* 統計 */}
        <div className="grid gap-4 md:grid-cols-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">產品規格</CardTitle>
              <Package className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {mockRules.product_spec.length}
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">禁用詞彙</CardTitle>
              <Ban className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {mockRules.forbidden_word.reduce(
                  (acc, r) => acc + r.forbidden_words.length,
                  0
                )}
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">品牌規範</CardTitle>
              <Image className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {mockRules.brand_guideline.length}
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">啟用中</CardTitle>
              <CheckCircle className="h-4 w-4 text-green-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-green-600">
                {Object.values(mockRules)
                  .flat()
                  .filter((r) => r.is_active).length}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* 規則列表 */}
        <Tabs defaultValue="product_spec">
          <div className="flex items-center justify-between">
            <TabsList>
              <TabsTrigger value="product_spec">產品規格</TabsTrigger>
              <TabsTrigger value="forbidden_word">禁用詞彙</TabsTrigger>
              <TabsTrigger value="brand_guideline">品牌規範</TabsTrigger>
            </TabsList>

            <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
              <DialogTrigger asChild>
                <Button>
                  <Plus className="mr-2 h-4 w-4" />
                  新增規則
                </Button>
              </DialogTrigger>
              <DialogContent className="sm:max-w-[500px]">
                <DialogHeader>
                  <DialogTitle>新增規則</DialogTitle>
                  <DialogDescription>
                    建立新的檢查規則，AI 將依據這些規則進行自動檢查
                  </DialogDescription>
                </DialogHeader>
                <div className="grid gap-4 py-4">
                  <div className="grid gap-2">
                    <Label>規則類型</Label>
                    <Select>
                      <SelectTrigger>
                        <SelectValue placeholder="選擇規則類型" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="product_spec">產品規格</SelectItem>
                        <SelectItem value="forbidden_word">禁用詞彙</SelectItem>
                        <SelectItem value="brand_guideline">品牌規範</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="grid gap-2">
                    <Label>規則名稱</Label>
                    <Input placeholder="輸入規則名稱" />
                  </div>
                  <div className="grid gap-2">
                    <Label>說明</Label>
                    <Input placeholder="輸入規則說明" />
                  </div>
                </div>
                <DialogFooter>
                  <Button variant="outline" onClick={() => setIsDialogOpen(false)}>
                    取消
                  </Button>
                  <Button onClick={() => setIsDialogOpen(false)}>建立</Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </div>

          <TabsContent value="product_spec" className="mt-4">
            <Card>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>規則名稱</TableHead>
                    <TableHead>產品名稱</TableHead>
                    <TableHead>型號</TableHead>
                    <TableHead>正確價格</TableHead>
                    <TableHead>狀態</TableHead>
                    <TableHead className="w-24">操作</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {mockRules.product_spec.map((rule) => (
                    <TableRow key={rule.id}>
                      <TableCell className="font-medium">{rule.name}</TableCell>
                      <TableCell>{rule.product_name}</TableCell>
                      <TableCell>{rule.product_model}</TableCell>
                      <TableCell>${rule.correct_price?.toLocaleString()}</TableCell>
                      <TableCell>
                        <Badge
                          variant={rule.is_active ? "default" : "secondary"}
                        >
                          {rule.is_active ? "啟用" : "停用"}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <div className="flex gap-1">
                          <Button variant="ghost" size="icon">
                            <Edit className="h-4 w-4" />
                          </Button>
                          <Button variant="ghost" size="icon" className="text-red-600">
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </Card>
          </TabsContent>

          <TabsContent value="forbidden_word" className="mt-4">
            <Card>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>規則名稱</TableHead>
                    <TableHead>禁用詞彙</TableHead>
                    <TableHead>狀態</TableHead>
                    <TableHead className="w-24">操作</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {mockRules.forbidden_word.map((rule) => (
                    <TableRow key={rule.id}>
                      <TableCell className="font-medium">{rule.name}</TableCell>
                      <TableCell>
                        <div className="flex flex-wrap gap-1">
                          {rule.forbidden_words.slice(0, 5).map((word) => (
                            <Badge key={word} variant="destructive">
                              {word}
                            </Badge>
                          ))}
                          {rule.forbidden_words.length > 5 && (
                            <Badge variant="secondary">
                              +{rule.forbidden_words.length - 5}
                            </Badge>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant={rule.is_active ? "default" : "secondary"}
                        >
                          {rule.is_active ? "啟用" : "停用"}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <div className="flex gap-1">
                          <Button variant="ghost" size="icon">
                            <Edit className="h-4 w-4" />
                          </Button>
                          <Button variant="ghost" size="icon" className="text-red-600">
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </Card>
          </TabsContent>

          <TabsContent value="brand_guideline" className="mt-4">
            <Card>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>規則名稱</TableHead>
                    <TableHead>說明</TableHead>
                    <TableHead>狀態</TableHead>
                    <TableHead className="w-24">操作</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {mockRules.brand_guideline.map((rule) => (
                    <TableRow key={rule.id}>
                      <TableCell className="font-medium">{rule.name}</TableCell>
                      <TableCell>{rule.description}</TableCell>
                      <TableCell>
                        <Badge
                          variant={rule.is_active ? "default" : "secondary"}
                        >
                          {rule.is_active ? "啟用" : "停用"}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <div className="flex gap-1">
                          <Button variant="ghost" size="icon">
                            <Edit className="h-4 w-4" />
                          </Button>
                          <Button variant="ghost" size="icon" className="text-red-600">
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
