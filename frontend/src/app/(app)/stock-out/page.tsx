'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { Suspense, useEffect, useState } from 'react';

import { MovementList } from '@/components/inventory/movement-list';
import { StockOutModal } from '@/components/inventory/stock-out-modal';
import { Button } from '@/components/ui/button';
import { Alert, LoadingState, PageHeader } from '@/components/ui/states';
import { useAuth } from '@/lib/auth';

export default function StockOutPage() {
  return (
    <Suspense fallback={<LoadingState label="Loading stock out…" />}>
      <StockOutView />
    </Suspense>
  );
}

function StockOutView() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { can } = useAuth();

  const [modalOpen, setModalOpen] = useState(false);
  const [initialProductId, setInitialProductId] = useState<number | null>(null);
  const [refreshToken, setRefreshToken] = useState(0);

  useEffect(() => {
    if (searchParams.get('new') !== '1' || !can('inventory.stock-out')) return;

    const product = searchParams.get('product');
    setInitialProductId(product ? Number(product) : null);
    setModalOpen(true);
    router.replace('/stock-out');
  }, [searchParams, can, router]);

  return (
    <div className="space-y-5">
      <PageHeader
        title="Stock out"
        description="Withdrawals of inventory, consumed oldest batch first."
        actions={
          can('inventory.stock-out') ? (
            <Button
              icon="arrow-up-right"
              onClick={() => {
                setInitialProductId(null);
                setModalOpen(true);
              }}
            >
              Record stock out
            </Button>
          ) : null
        }
      />

      <Alert tone="info" icon="layers">
        Which batches a withdrawal consumes is decided by the FIFO engine, and the allocation is
        recorded permanently. Availability is re-checked as the write happens, so stock can never go
        negative.
      </Alert>

      <MovementList
        type="stock_out"
        showAllocations
        filterKeys={['search', 'dates', 'product', 'category']}
        emptyTitle="No withdrawals recorded yet"
        emptyDescription="Once you have stock on hand, record a withdrawal to see FIFO consumption in action."
        emptyAction={
          can('inventory.stock-out')
            ? {
                label: 'Record stock out',
                icon: 'arrow-up-right',
                onClick: () => {
                  setInitialProductId(null);
                  setModalOpen(true);
                },
              }
            : undefined
        }
        refreshToken={refreshToken}
      />

      <StockOutModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        onRecorded={() => setRefreshToken((token) => token + 1)}
        initialProductId={initialProductId}
      />
    </div>
  );
}
