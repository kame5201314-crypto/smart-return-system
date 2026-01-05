export * from './database.types';

import type { ReturnRequest, Order, ReturnImage, ReturnItem } from './database.types';

// Extended types with relations
export interface ReturnRequestWithRelations extends ReturnRequest {
  order?: Order | null;
  customer?: {
    id: string;
    name: string | null;
    phone: string;
  } | null;
  return_items?: ReturnItem[];
  return_images?: ReturnImage[];
}

export interface OrderWithItems extends Order {
  order_items?: {
    id: string;
    sku: string | null;
    product_name: string;
    quantity: number;
    unit_price: number | null;
  }[];
}

// Customer portal session
export interface CustomerSession {
  orderId: string;
  orderNumber: string;
  phone: string;
  customerName: string | null;
  channelSource: string | null;
  canApplyReturn: boolean;
  deliveredAt: string | null;
  isReturnEligible: boolean;
}

// Form types
export interface ReturnApplyFormData {
  orderId: string;
  reasonCategory: string;
  reasonDetail: string;
  returnShippingMethod: string;
  selectedItems: {
    orderItemId: string;
    quantity: number;
    reason: string;
  }[];
}

export interface InspectionFormData {
  result: 'passed' | 'failed' | 'partial';
  conditionGrade: 'A' | 'B' | 'C' | 'D' | 'F';
  checklist: Record<string, boolean>;
  notes: string;
  inspectorComment: string;
}

// API Response types
export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

// Analytics types
export interface ReturnAnalytics {
  totalReturns: number;
  totalRefundAmount: number;
  returnRate: number;
  storeCreditRate: number;
  byChannel: Record<string, number>;
  byReason: Record<string, number>;
  topReturnedSKUs: {
    sku: string;
    productName: string;
    count: number;
    mainReason: string;
  }[];
  monthlyTrend: {
    month: string;
    returns: number;
    amount: number;
  }[];
}

// AI Analysis types
export interface AIAnalysisResult {
  painPoints: {
    issue: string;
    frequency: number;
    impact: 'high' | 'medium' | 'low';
    affectedProducts: string[];
  }[];
  recommendations: {
    title: string;
    description: string;
    priority: 'high' | 'medium' | 'low';
    category: 'product' | 'logistics' | 'customer_service' | 'marketing';
  }[];
  skuAnalysis: {
    sku: string;
    productName: string;
    returnRate: number;
    mainIssues: string[];
    suggestion: string;
  }[];
  channelAnalysis: {
    channel: string;
    returnRate: number;
    avgRefundAmount: number;
    commonIssues: string[];
  }[];
}

// Kanban types
export interface KanbanCard {
  id: string;
  requestNumber: string;
  customerName: string | null;
  productSummary: string;
  status: string;
  createdAt: string;
  refundAmount: number | null;
  channelSource: string | null;
}
