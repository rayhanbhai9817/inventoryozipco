'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { Suspense, useEffect, useState } from 'react';

import { MovementList } from '@/components/inventory/movement-list';
import { StockInModal } from '@/components/inventory/stock-in-modal';
import { Button } from '@/components/ui/button';
import { Alert, LoadingState, PageHeader } from '@/components/ui/states';
import { useAuth } from '@/lib/auth';

export default function StockInPage() {
  return (
    <Suspense fallback={<LoadingState label="Loading stock in…" />}>
      <StockInView />
    </Suspense>
  );
}

function StockInView() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { can } = useAuth();

  const [modalOpen, setModalOpen] = useState(false);
  const [initialProductId, setInitialProductId] = useState<number | null>(null);
  const [refreshToken, setRefreshToken] = useState(0);

  // `?new=1&product=12` lets other screens deep-link into the form with a
  // product already chosen.
  useEffect(() => {
    if (searchParams.get('new') !== '1' || !can('inventory.stock-in')) return;

    const product = searchParams.get('product');
    setInitialProductId(product ? Number(product) : null);
    setModalOpen(true);
    router.replace('/stock-in');
  }, [searchParams, can, router]);

  return (
    <div className="space-y-5">
      <PageHeader
        title="Stock in"
        description="Receipts of inventory. Each one opens a dated batch that stock out will consume in order."
        actions={
          can('inventory.stock-in') ? (
            <Button
              icon="arrow-down-right"
              onClick={() => {
                setInitialProductId(null);
                setModalOpen(true);
              }}
            >
              Record stock in
            </Button>
          ) : null
        }
      />

      <Alert tone="info" icon="info">
        A receipt attaches its supplier and reference to the batch, not just to the total — so the
        units on your shelf can always be traced back to where they came from.
      </Alert>

      <MovementList
        type="stock_in"
        filterKeys={['search', 'dates', 'product', 'supplier', 'category']}
        emptyTitle="No receipts recorded yet"
        emptyDescription="Record your first stock in to open a batch and start tracking quantity."
        emptyAction={
          can('inventory.stock-in')
            ? {
                label: 'Record stock in',
                icon: 'arrow-down-right',
                onClick: () => {
                  setInitialProductId(null);
                  setModalOpen(true);
                },
              }
            : undefined
        }
        refreshToken={refreshToken}
      />

      <StockInModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        onRecorded={() => setRefreshToken((token) => token + 1)}
        initialProductId={initialProductId}
      />
    </div>
  );
}
