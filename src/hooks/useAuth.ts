import { useState, useEffect, useCallback } from 'react';
import { apiService } from '../services/api';

export function useAuth(onLogoutRedirect?: () => void) {
  const [isAdminAuthenticated, setIsAdminAuthenticated] = useState<boolean>(false);
  const [isPinModalOpen, setIsPinModalOpen] = useState<boolean>(false);
  const [isInitialSetupModalOpen, setIsInitialSetupModalOpen] = useState<boolean>(false);
  const [isCheckingAuth, setIsCheckingAuth] = useState<boolean>(true);

  // Check active session cookie on mount
  useEffect(() => {
    let isMounted = true;
    apiService
      .checkAuthStatus()
      .then((status) => {
        if (isMounted && status && status.isAuthenticated) {
          setIsAdminAuthenticated(true);
        }
      })
      .catch(() => {})
      .finally(() => {
        if (isMounted) {
          setIsCheckingAuth(false);
        }
      });

    return () => {
      isMounted = false;
    };
  }, []);

  const handleAdminLogout = useCallback(async () => {
    await apiService.logout();
    setIsAdminAuthenticated(false);
    if (onLogoutRedirect) {
      onLogoutRedirect();
    }
  }, [onLogoutRedirect]);

  const openPinModal = useCallback(() => {
    setIsPinModalOpen(true);
  }, []);

  const closePinModal = useCallback(() => {
    setIsPinModalOpen(false);
  }, []);

  const openInitialSetupModal = useCallback(() => {
    setIsInitialSetupModalOpen(true);
  }, []);

  const closeInitialSetupModal = useCallback(() => {
    setIsInitialSetupModalOpen(false);
  }, []);

  return {
    isAdminAuthenticated,
    setIsAdminAuthenticated,
    isPinModalOpen,
    setIsPinModalOpen,
    isInitialSetupModalOpen,
    setIsInitialSetupModalOpen,
    isCheckingAuth,
    handleAdminLogout,
    openPinModal,
    closePinModal,
    openInitialSetupModal,
    closeInitialSetupModal,
  };
}
