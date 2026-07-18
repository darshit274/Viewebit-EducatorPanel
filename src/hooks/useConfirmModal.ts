import { useState, useCallback } from 'react';

interface ConfirmModalState<T = any> {
  isOpen: boolean;
  item: T | null;
  action: string;
  loading: boolean;
}

interface UseConfirmModalReturn<T = any> {
  confirmModal: ConfirmModalState<T>;
  openConfirmModal: (item: T | null, action?: string) => void;
  closeConfirmModal: () => void;
  setConfirmModalLoading: (loading: boolean) => void;
}

export function useConfirmModal<T = any>(
  defaultAction = 'delete'
): UseConfirmModalReturn<T> {
  const [confirmModal, setConfirmModal] = useState<ConfirmModalState<T>>({
    isOpen: false,
    item: null,
    action: defaultAction,
    loading: false,
  });

  const openConfirmModal = useCallback((item: T | null, action = defaultAction) => {
    setConfirmModal({
      isOpen: true,
      item,
      action,
      loading: false,
    });
  }, [defaultAction]);

  const closeConfirmModal = useCallback(() => {
    setConfirmModal({
      isOpen: false,
      item: null,
      action: defaultAction,
      loading: false,
    });
  }, [defaultAction]);

  const setConfirmModalLoading = useCallback((loading: boolean) => {
    setConfirmModal(prev => ({ ...prev, loading }));
  }, []);

  return {
    confirmModal,
    openConfirmModal,
    closeConfirmModal,
    setConfirmModalLoading,
  };
}