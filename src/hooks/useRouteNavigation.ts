import { useState, useEffect, useCallback } from 'react';

export type AdminSection = 'orders' | 'whatsapp' | 'products' | 'clients' | 'financials' | 'future' | 'settings';

export interface RouteInfo {
  isCustomerTrackingPage: boolean;
  trackingCode: string;
  isAdminRoute: boolean;
  adminSection: AdminSection;
}

export const parseCurrentRoute = (): RouteInfo => {
  if (typeof window === 'undefined') {
    return {
      isCustomerTrackingPage: false,
      trackingCode: '',
      isAdminRoute: false,
      adminSection: 'orders',
    };
  }

  const pathname = window.location.pathname;
  const hash = window.location.hash || '';
  const searchParams = new URLSearchParams(window.location.search);

  // 1. Direct path: /acompanhar/:code, /track/:code, /rastreio/:code, /r/:code, /encomenda/:code, /pedido/:code
  const trackingPrefixes = ['/acompanhar/', '/track/', '/rastreio/', '/r/', '/encomenda/', '/pedido/'];
  for (const prefix of trackingPrefixes) {
    if (pathname.startsWith(prefix)) {
      const rawCode = pathname.substring(prefix.length).split('/')[0].split('?')[0];
      const code = rawCode ? decodeURIComponent(rawCode).trim().toUpperCase() : '';
      if (code) {
        return {
          isCustomerTrackingPage: true,
          trackingCode: code,
          isAdminRoute: false,
          adminSection: 'orders',
        };
      }
    }
  }

  // 1.1 Direct root code path: /AO-451023 or /A0-451023
  if (/^\/A[O0]-\d+/i.test(pathname)) {
    const rawCode = pathname.replace(/^\//, '').split('/')[0].split('?')[0];
    const code = rawCode ? decodeURIComponent(rawCode).trim().toUpperCase() : '';
    if (code) {
      return {
        isCustomerTrackingPage: true,
        trackingCode: code,
        isAdminRoute: false,
        adminSection: 'orders',
      };
    }
  }

  // 2. Hash routing fallback: /#/acompanhar/:code, /#/track/:code, /#AO-123456 or /#code=AO-123456
  if (hash) {
    const cleanHash = hash.replace(/^#\/?/, '');
    const hashPrefixes = ['acompanhar/', 'track/', 'rastreio/', 'r/', 'encomenda/', 'pedido/'];
    for (const prefix of hashPrefixes) {
      if (cleanHash.startsWith(prefix)) {
        const rawCode = cleanHash.substring(prefix.length).split('?')[0].split('/')[0];
        const code = rawCode ? decodeURIComponent(rawCode).trim().toUpperCase() : '';
        if (code) {
          return {
            isCustomerTrackingPage: true,
            trackingCode: code,
            isAdminRoute: false,
            adminSection: 'orders',
          };
        }
      }
    }
    if (cleanHash.startsWith('AO-') || cleanHash.startsWith('A0-') || cleanHash.includes('code=') || cleanHash.includes('track=')) {
      let code = '';
      if (cleanHash.startsWith('AO-') || cleanHash.startsWith('A0-')) {
        code = cleanHash.split('?')[0].trim().toUpperCase();
      } else {
        const hashParams = new URLSearchParams(cleanHash.includes('?') ? cleanHash.split('?')[1] : cleanHash);
        code = (hashParams.get('code') || hashParams.get('track') || hashParams.get('c'))?.trim().toUpperCase() || '';
      }
      if (code) {
        return {
          isCustomerTrackingPage: true,
          trackingCode: code,
          isAdminRoute: false,
          adminSection: 'orders',
        };
      }
    }
  }

  // 3. Query param ?code=... or ?c=... or ?track=... or ?tracking=... or ?t=...
  if (
    (searchParams.has('code') ||
      searchParams.has('c') ||
      searchParams.has('track') ||
      searchParams.has('tracking') ||
      searchParams.has('t')) &&
    !pathname.startsWith('/admin')
  ) {
    const code = (
      searchParams.get('code') ||
      searchParams.get('track') ||
      searchParams.get('c') ||
      searchParams.get('tracking') ||
      searchParams.get('t')
    )?.trim().toUpperCase();
    if (code) {
      return {
        isCustomerTrackingPage: true,
        trackingCode: code,
        isAdminRoute: false,
        adminSection: 'orders',
      };
    }
  }

  // 4. Admin routes: /admin, /admin/login, /admin/encomendas, /admin/clientes, etc.
  if (pathname.startsWith('/admin') || hash.startsWith('#/admin') || hash.startsWith('#admin')) {
    let section: AdminSection = 'orders';
    const targetPath = (pathname.startsWith('/admin') ? pathname : hash).toLowerCase();

    if (targetPath.includes('/client') || targetPath.includes('/cliente')) {
      section = 'clients';
    } else if (targetPath.includes('/financial') || targetPath.includes('/financeir') || targetPath.includes('/relatorio')) {
      section = 'financials';
    } else if (targetPath.includes('/product') || targetPath.includes('/produto')) {
      section = 'products';
    } else if (targetPath.includes('/whatsapp')) {
      section = 'whatsapp';
    } else if (targetPath.includes('/setting') || targetPath.includes('/config') || targetPath.includes('/senha') || targetPath.includes('/ajuste')) {
      section = 'settings';
    } else if (targetPath.includes('/future') || targetPath.includes('/futur')) {
      section = 'future';
    } else if (targetPath.includes('/order') || targetPath.includes('/encomenda')) {
      section = 'orders';
    }

    return {
      isCustomerTrackingPage: false,
      trackingCode: '',
      isAdminRoute: true,
      adminSection: section,
    };
  }

  // 5. Default public consultation (home page / or /consulta)
  return {
    isCustomerTrackingPage: false,
    trackingCode: searchParams.get('code')?.trim().toUpperCase() || '',
    isAdminRoute: false,
    adminSection: 'orders',
  };
};

export function useRouteNavigation(
  isAdminAuthenticated: boolean,
  adminConfigured: boolean,
  onRequireAuthModal: () => void,
  onRequireSetupModal: () => void
) {
  const [routeInfo, setRouteInfo] = useState<RouteInfo>(() => parseCurrentRoute());
  const [activeTab, setActiveTab] = useState<'public' | 'admin'>(() => {
    const initial = parseCurrentRoute();
    return initial.isAdminRoute ? 'admin' : 'public';
  });
  const [adminSubTab, setAdminSubTab] = useState<AdminSection>(() => {
    const initial = parseCurrentRoute();
    return initial.adminSection;
  });

  const navigate = useCallback(
    (newPath: string) => {
      if (typeof window !== 'undefined') {
        window.history.pushState({}, '', newPath);
        const updated = parseCurrentRoute();
        setRouteInfo(updated);
        if (updated.isCustomerTrackingPage) {
          setActiveTab('public');
        } else if (updated.isAdminRoute) {
          if (isAdminAuthenticated) {
            setActiveTab('admin');
            setAdminSubTab(updated.adminSection);
          } else {
            if (!adminConfigured) {
              onRequireSetupModal();
            } else {
              onRequireAuthModal();
            }
          }
        } else {
          setActiveTab('public');
        }
      }
    },
    [isAdminAuthenticated, adminConfigured, onRequireAuthModal, onRequireSetupModal]
  );

  useEffect(() => {
    const handlePopState = () => {
      const updated = parseCurrentRoute();
      setRouteInfo(updated);
      if (updated.isCustomerTrackingPage) {
        setActiveTab('public');
      } else if (updated.isAdminRoute) {
        if (isAdminAuthenticated) {
          setActiveTab('admin');
          setAdminSubTab(updated.adminSection);
        } else {
          onRequireAuthModal();
        }
      } else {
        setActiveTab('public');
      }
    };

    window.addEventListener('popstate', handlePopState);
    window.addEventListener('hashchange', handlePopState);
    return () => {
      window.removeEventListener('popstate', handlePopState);
      window.removeEventListener('hashchange', handlePopState);
    };
  }, [isAdminAuthenticated, onRequireAuthModal]);

  return {
    routeInfo,
    activeTab,
    setActiveTab,
    adminSubTab,
    setAdminSubTab,
    navigate,
  };
}
