'use client';

import { type FormEvent, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Loader2, Plus } from 'lucide-react';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import type { SaaSPlanCode } from '@/lib/config/saas-plans';

const PLAN_OPTIONS: Array<{ value: SaaSPlanCode; label: string }> = [
  { value: 'basic', label: 'Basic' },
  { value: 'growth', label: 'Growth' },
  { value: 'pro', label: 'Pro' },
  { value: 'enterprise', label: 'Enterprise' },
];

function slugify(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 64);
}

function dateToIsoEndOfDay(value: string): string | undefined {
  if (!value) return undefined;
  return new Date(`${value}T23:59:59.000Z`).toISOString();
}

export function ManualBetaOrgForm() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [orgName, setOrgName] = useState('');
  const [slug, setSlug] = useState('');
  const [ownerEmail, setOwnerEmail] = useState('');
  const [plan, setPlan] = useState<SaaSPlanCode>('basic');
  const [billingEmail, setBillingEmail] = useState('');
  const [taxId, setTaxId] = useState('');
  const [trialEnd, setTrialEnd] = useState('');

  const canSubmit = useMemo(
    () => Boolean(orgName.trim() && slug.trim() && ownerEmail.trim() && !isSubmitting),
    [orgName, slug, ownerEmail, isSubmitting]
  );

  function resetForm() {
    setOrgName('');
    setSlug('');
    setOwnerEmail('');
    setPlan('basic');
    setBillingEmail('');
    setTaxId('');
    setTrialEnd('');
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!canSubmit) return;

    setIsSubmitting(true);
    try {
      const response = await fetch('/api/internal/saas/orgs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          orgName: orgName.trim(),
          slug: slug.trim(),
          ownerEmail: ownerEmail.trim(),
          plan,
          billingEmail: billingEmail.trim() || undefined,
          taxId: taxId.trim() || undefined,
          trialEnd: dateToIsoEndOfDay(trialEnd),
        }),
      });

      const payload = await response.json().catch(() => null);
      if (!response.ok || !payload?.success) {
        throw new Error(payload?.error || '建立租戶失敗');
      }

      toast.success('已建立 Manual Beta 租戶');
      resetForm();
      setOpen(false);
      router.refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : '建立租戶失敗');
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>
          <Plus className="size-4" />
          手動開通
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-xl">
        <form onSubmit={handleSubmit} className="grid gap-5">
          <DialogHeader>
            <DialogTitle>手動開通 Manual Beta 租戶</DialogTitle>
            <DialogDescription>
              建立 SaaS 組織、owner membership 與 manual trial subscription。送出前請確認這是 SaaS 專用測試或 Beta 客戶。
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="grid gap-2 sm:col-span-2">
              <Label htmlFor="manual-beta-org-name">組織名稱</Label>
              <Input
                id="manual-beta-org-name"
                value={orgName}
                onChange={(event) => {
                  const nextName = event.target.value;
                  setOrgName(nextName);
                  if (!slug) setSlug(slugify(nextName));
                }}
                placeholder="例如：Smart Return Beta"
                required
              />
            </div>

            <div className="grid gap-2">
              <Label htmlFor="manual-beta-slug">Slug</Label>
              <Input
                id="manual-beta-slug"
                value={slug}
                onChange={(event) => setSlug(slugify(event.target.value))}
                placeholder="smart-return-beta"
                required
              />
            </div>

            <div className="grid gap-2">
              <Label htmlFor="manual-beta-plan">方案</Label>
              <Select value={plan} onValueChange={(value) => setPlan(value as SaaSPlanCode)}>
                <SelectTrigger id="manual-beta-plan">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {PLAN_OPTIONS.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="grid gap-2 sm:col-span-2">
              <Label htmlFor="manual-beta-owner-email">Owner Email</Label>
              <Input
                id="manual-beta-owner-email"
                type="email"
                value={ownerEmail}
                onChange={(event) => setOwnerEmail(event.target.value)}
                placeholder="owner@example.com"
                required
              />
            </div>

            <div className="grid gap-2">
              <Label htmlFor="manual-beta-billing-email">帳務 Email</Label>
              <Input
                id="manual-beta-billing-email"
                type="email"
                value={billingEmail}
                onChange={(event) => setBillingEmail(event.target.value)}
                placeholder="billing@example.com"
              />
            </div>

            <div className="grid gap-2">
              <Label htmlFor="manual-beta-tax-id">統編</Label>
              <Input
                id="manual-beta-tax-id"
                inputMode="numeric"
                maxLength={8}
                value={taxId}
                onChange={(event) => setTaxId(event.target.value.replace(/\D/g, '').slice(0, 8))}
                placeholder="12345678"
              />
            </div>

            <div className="grid gap-2 sm:col-span-2">
              <Label htmlFor="manual-beta-trial-end">試用結束日</Label>
              <Input
                id="manual-beta-trial-end"
                type="date"
                value={trialEnd}
                onChange={(event) => setTrialEnd(event.target.value)}
              />
            </div>
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setOpen(false)}
              disabled={isSubmitting}
            >
              取消
            </Button>
            <Button type="submit" disabled={!canSubmit}>
              {isSubmitting ? <Loader2 className="size-4 animate-spin" /> : <Plus className="size-4" />}
              建立租戶
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
