/* eslint-disable no-console,@typescript-eslint/no-explicit-any, @typescript-eslint/no-non-null-assertion */

'use client';

import {
  Bell,
  Copy,
  Download,
  ExternalLink,
  LogOut,
  Monitor,
  Rss,
  Settings,
  Shield,
  Sliders,
  Smartphone,
  Tablet,
  User,
  X,
} from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';

import './UserMenu.css';

import { formatAppError, readJsonResponse, reportAppError } from '@/lib/app-error';
import { getAuthInfoFromBrowserCookie } from '@/lib/auth';

import { DeviceManagementPanel } from './DeviceManagementPanel';
import { DownloadManagementPanel } from './DownloadManagementPanel';
import { EmailSettingsPanel } from './EmailSettingsPanel';
import { LocalSettingsPanel } from './LocalSettingsPanel';
import { NotificationPanel } from './NotificationPanel';
import { OfflineDownloadPanel } from './OfflineDownloadPanel';
import { PersonalCenterPanel } from './PersonalCenterPanel';
import TVRemotePanel from './tv/TVRemotePanel';

interface AuthInfo {
  username?: string;
  role?: 'owner' | 'admin' | 'user';
}

export const UserMenu: React.FC<{ quickActions?: boolean }> = ({ quickActions = false }) => {
  const router = useRouter();
  const [isOpen, setIsOpen] = useState(false);
  const [isProfileCenterOpen, setIsProfileCenterOpen] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isChangePasswordOpen, setIsChangePasswordOpen] = useState(false);
  const [isSubscribeOpen, setIsSubscribeOpen] = useState(false);
  const [isOfflineDownloadPanelOpen, setIsOfflineDownloadPanelOpen] =
    useState(false);
  const [isNotificationPanelOpen, setIsNotificationPanelOpen] = useState(false);
  const [isEmailSettingsOpen, setIsEmailSettingsOpen] = useState(false);
  const [isDeviceManagementOpen, setIsDeviceManagementOpen] = useState(false);
  const [isDownloadManagementOpen, setIsDownloadManagementOpen] =
    useState(false);
  const [isTVRemoteOpen, setIsTVRemoteOpen] = useState(false);
  const [authInfo, setAuthInfo] = useState<AuthInfo | null>(null);
  const [storageType, setStorageType] = useState<string>('localstorage');
  const [mounted, setMounted] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);

  // 订阅相关状态
  const [subscribeEnabled, setSubscribeEnabled] = useState(false);
  const [tvModeEnabled, setTvModeEnabled] = useState(true);
  const [tvRemoteAvailable, setTvRemoteAvailable] = useState(false);
  const [subscribeUrl, setSubscribeUrl] = useState('');
  const [copySuccess, setCopySuccess] = useState(false);
  const [orionBaseUrlCopySuccess, setOrionBaseUrlCopySuccess] = useState(false);
  const [tvboxToken, setTvboxToken] = useState('');
  const [isResettingToken, setIsResettingToken] = useState(false);
  const [isLoadingSubscribeUrl, setIsLoadingSubscribeUrl] = useState(false);
  const [subscribeAdFilterEnabled, setSubscribeAdFilterEnabled] =
    useState(false);
  const [subscribeYellowFilterEnabled, setSubscribeYellowFilterEnabled] =
    useState(false);

  // Web 电视扫码登录入口（手机摄像头扫描电视端二维码）
  const [isTvQrScannerOpen, setIsTvQrScannerOpen] = useState(false);
  const [tvQrScannerStatus, setTvQrScannerStatus] = useState('');
  const [tvQrScannerError, setTvQrScannerError] = useState('');
  const tvQrVideoRef = useRef<HTMLVideoElement | null>(null);
  const tvQrStreamRef = useRef<MediaStream | null>(null);
  const tvQrScanStopRef = useRef(false);
  const [tvAccessTab, setTvAccessTab] = useState<'tvbox' | 'orion' | 'web'>('tvbox');

  // Body 滚动锁定 - 使用 overflow 方式避免布局问题
  useEffect(() => {
    if (
      isProfileCenterOpen ||
      isChangePasswordOpen ||
      isSubscribeOpen ||
      isOfflineDownloadPanelOpen ||
      isEmailSettingsOpen ||
      isDeviceManagementOpen ||
      isDownloadManagementOpen ||
      isTvQrScannerOpen ||
      isTVRemoteOpen
    ) {
      const body = document.body;
      const html = document.documentElement;

      // 保存原始样式
      const originalBodyOverflow = body.style.overflow;
      const originalHtmlOverflow = html.style.overflow;

      // 只设置 overflow 来阻止滚动
      body.style.overflow = 'hidden';
      html.style.overflow = 'hidden';

      return () => {
        // 恢复所有原始样式
        body.style.overflow = originalBodyOverflow;
        html.style.overflow = originalHtmlOverflow;
      };
    }
  }, [
    isProfileCenterOpen,
    isChangePasswordOpen,
    isSubscribeOpen,
    isOfflineDownloadPanelOpen,
    isEmailSettingsOpen,
    isDeviceManagementOpen,
    isDownloadManagementOpen,
    isTvQrScannerOpen,
    isTVRemoteOpen,
  ]);

  // 通知设置
  const [userEmail, setUserEmail] = useState('');
  const [emailNotifications, setEmailNotifications] = useState(false);
  const [pushNotifications, setPushNotifications] = useState(false);
  const [pushNotificationsConfigured, setPushNotificationsConfigured] = useState(false);
  const [pushNotificationsSupported, setPushNotificationsSupported] = useState(false);
  const [pushNotificationsBusy, setPushNotificationsBusy] = useState(false);
  const [emailSettingsLoading, setEmailSettingsLoading] = useState(false);
  const [emailSettingsSaving, setEmailSettingsSaving] = useState(false);
  const [emailSettingsMessage, setEmailSettingsMessage] = useState('');
  const [emailSettingsMessageType, setEmailSettingsMessageType] = useState<
    'success' | 'error' | null
  >(null);
  const [telegramEnabled, setTelegramEnabled] = useState(false);
  const [telegramBound, setTelegramBound] = useState(false);
  const [telegramUsername, setTelegramUsername] = useState('');
  const [telegramBindCode, setTelegramBindCode] = useState('');
  const [telegramDeepLink, setTelegramDeepLink] = useState('');
  const [telegramBindingBusy, setTelegramBindingBusy] = useState(false);

  // 设备管理状态
  const [devices, setDevices] = useState<any[]>([]);
  const [devicesLoading, setDevicesLoading] = useState(false);
  const [revoking, setRevoking] = useState<string | null>(null);

  // 确认对话框状态
  const [confirmDialog, setConfirmDialog] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    onConfirm: () => void;
  }>({
    isOpen: false,
    title: '',
    message: '',
    onConfirm: () => undefined,
  });

  // 修改密码相关状态
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [passwordLoading, setPasswordLoading] = useState(false);
  const [passwordError, setPasswordError] = useState('');

  // 确保组件已挂载
  useEffect(() => {
    setMounted(true);
  }, []);

  // 加载未读通知数量
  const loadUnreadCount = async () => {
    try {
      const response = await fetch('/api/notifications');
      if (response.ok) {
        const data = await response.json();
        const count = data.unreadCount || 0;
        setUnreadCount(count);
        // 同步到全局，让其他 UserMenu 实例也能获取
        if (typeof window !== 'undefined') {
          (window as any).__unreadNotificationCount = count;
        }
      }
    } catch (error) {
      console.error('加载未读通知数量失败:', error);
    }
  };

  // 首次加载时检查未读通知数量（使用全局标记避免多个实例重复请求）
  useEffect(() => {
    if (typeof window === 'undefined') return;

    // 检查是否已经有其他实例在加载
    const globalWindow = window as any;
    if (globalWindow.__loadingNotifications) {
      // 如果正在加载，等待加载完成后获取结果
      const checkInterval = setInterval(() => {
        if (
          !globalWindow.__loadingNotifications &&
          globalWindow.__unreadNotificationCount !== undefined
        ) {
          setUnreadCount(globalWindow.__unreadNotificationCount);
          clearInterval(checkInterval);
        }
      }, 100);
      return () => clearInterval(checkInterval);
    }

    // 检查是否已经加载过
    if (globalWindow.__unreadNotificationCount !== undefined) {
      setUnreadCount(globalWindow.__unreadNotificationCount);
      return;
    }

    // 标记正在加载
    globalWindow.__loadingNotifications = true;
    loadUnreadCount().finally(() => {
      globalWindow.__loadingNotifications = false;
    });
  }, []);

  // 监听通知更新事件
  useEffect(() => {
    const handleNotificationsUpdated = () => {
      // 清除缓存，强制重新加载
      if (typeof window !== 'undefined') {
        delete (window as any).__unreadNotificationCount;
      }
      loadUnreadCount();
    };

    window.addEventListener('notificationsUpdated', handleNotificationsUpdated);
    return () => {
      window.removeEventListener(
        'notificationsUpdated',
        handleNotificationsUpdated
      );
    };
  }, []);

  // 从运行时配置读取订阅是否启用
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const enabled =
        (window as any).RUNTIME_CONFIG?.ENABLE_TVBOX_SUBSCRIBE || false;
      setSubscribeEnabled(enabled);
      setTvModeEnabled((window as any).RUNTIME_CONFIG?.ENABLE_TV_MODE !== false);
    }
  }, []);

  useEffect(() => {
    if (!isSubscribeOpen) return;
    let active = true;
    setTvRemoteAvailable(false);
    fetch('/api/server-config')
      .then((response) => response.ok ? response.json() : null)
      .then((config) => {
        if (active) setTvRemoteAvailable(config?.TV_REMOTE_AVAILABLE === true);
      })
      .catch(() => {
        if (active) setTvRemoteAvailable(false);
      });
    return () => { active = false; };
  }, [isSubscribeOpen]);

  // 懒加载订阅 URL - 只在打开订阅面板时请求
  const fetchSubscribeUrl = async () => {
    setIsLoadingSubscribeUrl(true);
    try {
      // 获取用户的 TVBox token
      const response = await fetch('/api/user/tvbox-token');
      if (response.ok) {
        const data = await response.json();
        const token = data.token;
        setTvboxToken(token);

        setSubscribeUrl(
          buildSubscribeUrl(
            token,
            subscribeAdFilterEnabled,
            subscribeYellowFilterEnabled
          )
        );
      }
    } catch (error) {
      console.error('获取订阅URL失败:', error);
    } finally {
      setIsLoadingSubscribeUrl(false);
    }
  };

  // 重置 TVBox token
  const handleResetToken = async () => {
    setConfirmDialog({
      isOpen: true,
      title: '重置订阅Token',
      message: '确定要重置订阅token吗？重置后旧的订阅链接将失效。',
      onConfirm: async () => {
        setConfirmDialog({ ...confirmDialog, isOpen: false });
        setIsResettingToken(true);

        try {
          const response = await fetch('/api/user/tvbox-token/reset', {
            method: 'POST',
          });

          const messageEl = document.getElementById('tvbox-token-message');
          if (response.ok) {
            const data = await response.json();
            const token = data.token;
            setTvboxToken(token);

            setSubscribeUrl(
              buildSubscribeUrl(
                token,
                subscribeAdFilterEnabled,
                subscribeYellowFilterEnabled
              )
            );

            if (messageEl) {
              messageEl.textContent = '订阅token已重置！';
              messageEl.className =
                'text-xs text-center text-green-600 dark:text-green-400 mt-2';
              messageEl.classList.remove('hidden');
              setTimeout(() => {
                messageEl.classList.add('hidden');
              }, 3000);
            }
          } else {
            const data = await response.json();
            if (messageEl) {
              messageEl.textContent = data.error || '重置失败，请重试';
              messageEl.className =
                'text-xs text-center text-red-600 dark:text-red-400 mt-2';
              messageEl.classList.remove('hidden');
            }
          }
        } catch (error) {
          console.error('重置token失败:', error);
          const messageEl = document.getElementById('tvbox-token-message');
          if (messageEl) {
            messageEl.textContent = '重置失败，请重试';
            messageEl.className =
              'text-xs text-center text-red-600 dark:text-red-400 mt-2';
            messageEl.classList.remove('hidden');
          }
        } finally {
          setIsResettingToken(false);
        }
      },
    });
  };

  const buildSubscribeUrl = (
    token: string,
    adFilter: boolean,
    yellowFilter: boolean
  ) => {
    const currentOrigin = window.location.origin;
    const url = new URL('/api/tvbox/subscribe', currentOrigin);
    url.searchParams.set('token', token);
    if (adFilter) {
      url.searchParams.set('adFilter', 'true');
    }
    if (yellowFilter) {
      url.searchParams.set('yellowFilter', 'true');
    }
    return url.toString();
  };

  // 获取认证信息和存储类型
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const auth = getAuthInfoFromBrowserCookie();
      setAuthInfo(auth);

      const runtimeConfig = (window as any).RUNTIME_CONFIG || {};
      const type = runtimeConfig.STORAGE_TYPE || 'localstorage';
      setStorageType(type);
    }
  }, []);

  // 加载通知设置
  const loadEmailSettings = async () => {
    setEmailSettingsLoading(true);
    setEmailSettingsMessage('');
    setEmailSettingsMessageType(null);
    try {
      const response = await fetch('/api/user/email-settings');
      if (response.ok) {
        const data = await response.json();
        setUserEmail(data.email || '');
        setEmailNotifications(data.emailNotifications || false);
      }

      const pushResponse = await fetch('/api/notifications/push');
      if (pushResponse.ok) {
        const pushData = await pushResponse.json();
        setPushNotificationsConfigured(Boolean(pushData.configured && pushData.publicKey));
        setPushNotificationsSupported(
          Boolean(
            pushData.configured &&
            pushData.publicKey &&
            pushData.hasDeviceToken &&
            typeof window !== 'undefined' &&
            'Notification' in window &&
            'serviceWorker' in navigator &&
            'PushManager' in window
          )
        );
        setPushNotifications(Boolean(pushData.pushNotifications));
      }

      const telegramResponse = await fetch('/api/telegram/bind');
      if (telegramResponse.ok) {
        const telegramData = await telegramResponse.json();
        setTelegramEnabled(Boolean(telegramData.enabled));
        setTelegramBound(Boolean(telegramData.binding));
        setTelegramUsername(telegramData.binding?.telegramUsername || '');
      }
    } catch (error) {
      console.error('加载通知设置失败:', error);
    } finally {
      setEmailSettingsLoading(false);
    }
  };

  const handleCreateTelegramBindCode = async () => {
    setTelegramBindingBusy(true);
    setEmailSettingsMessage('');
    setEmailSettingsMessageType(null);
    try {
      const response = await fetch('/api/telegram/bind', { method: 'POST' });
      const data = await readJsonResponse<{ code?: string; deepLink?: string }>(response, '生成 Telegram 绑定码');
      setTelegramBindCode(data.code || '');
      setTelegramDeepLink(data.deepLink || '');
      setEmailSettingsMessage('Telegram 绑定码已生成，请在 10 分钟内完成绑定');
      setEmailSettingsMessageType('success');
    } catch (error) {
      reportAppError(error, '生成 Telegram 绑定码');
      setEmailSettingsMessage(formatAppError(error, '生成 Telegram 绑定码'));
      setEmailSettingsMessageType('error');
    } finally {
      setTelegramBindingBusy(false);
    }
  };

  const urlBase64ToUint8Array = (base64String: string) => {
    const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
    const base64 = (base64String + padding)
      .replace(/-/g, '+')
      .replace(/_/g, '/');
    const rawData = window.atob(base64);
    const outputArray = new Uint8Array(rawData.length);
    for (let i = 0; i < rawData.length; i++) {
      outputArray[i] = rawData.charCodeAt(i);
    }
    return outputArray;
  };

  const arrayBufferToBase64Url = (buffer: ArrayBuffer | null) => {
    if (!buffer) return '';
    const bytes = new Uint8Array(buffer);
    let binary = '';
    for (let i = 0; i < bytes.byteLength; i++) {
      binary += String.fromCharCode(bytes[i]);
    }
    return window
      .btoa(binary)
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=+$/g, '');
  };

  const isSubscriptionUsingPublicKey = (
    subscription: PushSubscription,
    publicKey: string
  ) => {
    const subscriptionKey = arrayBufferToBase64Url(
      subscription.options?.applicationServerKey || null
    );
    return subscriptionKey === publicKey;
  };

  const waitForServiceWorkerActivation = async (
    registration: ServiceWorkerRegistration
  ) => {
    let pendingWorker = registration.installing || registration.waiting;

    if (!pendingWorker) {
      await registration.update();
      pendingWorker = registration.installing || registration.waiting;
    }

    // 没有新的 installing/waiting worker 时，说明当前 active registration 可直接使用。
    if (!pendingWorker) {
      if (registration.active) return registration;
      throw new Error('Service Worker 注册失败，请刷新页面后重试');
    }

    const activatingWorker = pendingWorker;
    if (activatingWorker.state === 'activated') return registration;

    await new Promise<void>((resolve, reject) => {
      const handleStateChange = () => {
        if (activatingWorker.state === 'activated') {
          activatingWorker.removeEventListener('statechange', handleStateChange);
          resolve();
        } else if (activatingWorker.state === 'redundant') {
          activatingWorker.removeEventListener('statechange', handleStateChange);
          reject(new Error('Service Worker 激活失败，请刷新页面后重试'));
        }
      };

      activatingWorker.addEventListener('statechange', handleStateChange);
      handleStateChange();
    });

    return registration;
  };

  const getReadyServiceWorkerRegistration = async () => {
    if (!('serviceWorker' in navigator)) {
      throw new Error('当前浏览器不支持 Service Worker');
    }

    // 开启系统通知时明确使用带 push 事件处理器的 Service Worker。
    // 如果浏览器里已有旧 /sw.js 注册，重新注册同一 scope 的 /push-sw.js 会更新该注册；
    // push-sw.js 内部会 skipWaiting + clients.claim，激活后再订阅，确保 Push 到达能展示通知。
    const registration = await navigator.serviceWorker.register('/push-sw.js', {
      scope: '/',
      updateViaCache: 'none',
    });

    return waitForServiceWorkerActivation(registration);
  };

  const handlePushNotificationsChange = async (enabled: boolean) => {
    if (!enabled) {
      setPushNotificationsBusy(true);
      try {
        const registration =
          'serviceWorker' in navigator
            ? await navigator.serviceWorker.getRegistration()
            : undefined;
        const subscription = await registration?.pushManager.getSubscription();
        const endpoint = subscription?.endpoint;
        await subscription?.unsubscribe();
        await fetch('/api/notifications/push', {
          method: 'DELETE',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ endpoint }),
        });
        setPushNotifications(false);
      } catch (error) {
        console.error('关闭浏览器通知失败:', error);
        setEmailSettingsMessage('关闭浏览器通知失败，请重试');
        setEmailSettingsMessageType('error');
      } finally {
        setPushNotificationsBusy(false);
      }
      return;
    }

    setPushNotificationsBusy(true);
    setEmailSettingsMessage('');
    setEmailSettingsMessageType(null);
    try {
      const statusResponse = await fetch('/api/notifications/push');
      const status = statusResponse.ok ? await statusResponse.json() : null;
      if (!status?.configured || !status?.publicKey) {
        throw new Error('管理员尚未配置 Web Push VAPID 密钥');
      }

      const permission = await Notification.requestPermission();
      if (permission !== 'granted') {
        throw new Error('浏览器通知权限未授权');
      }

      const registration = await getReadyServiceWorkerRegistration();

      let subscription = await registration.pushManager.getSubscription();
      if (subscription && !isSubscriptionUsingPublicKey(subscription, status.publicKey)) {
        await subscription.unsubscribe();
        subscription = null;
      }

      if (!subscription) {
        subscription = await registration.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: urlBase64ToUint8Array(status.publicKey),
        });
      }

      const response = await fetch('/api/notifications/push', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          enabled: true,
          subscription: subscription.toJSON(),
        }),
      });

      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        throw new Error(data.error || '保存浏览器通知订阅失败');
      }

      setPushNotifications(true);
      setEmailSettingsMessage('浏览器系统通知已开启');
      setEmailSettingsMessageType('success');
    } catch (error) {
      reportAppError(error, '开启浏览器通知');
      setPushNotifications(false);
      setEmailSettingsMessage(formatAppError(error, '开启浏览器通知'));
      setEmailSettingsMessageType('error');
    } finally {
      setPushNotificationsBusy(false);
    }
  };

  // 保存通知设置
  const handleSaveEmailSettings = async () => {
    setEmailSettingsSaving(true);
    setEmailSettingsMessage('');
    setEmailSettingsMessageType(null);
    try {
      const response = await fetch('/api/user/email-settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: userEmail,
          emailNotifications,
        }),
      });

      await readJsonResponse(response, '保存通知设置');
      {
        setEmailSettingsMessage('保存成功！');
        setEmailSettingsMessageType('success');
        setTimeout(() => {
          setEmailSettingsMessage('');
          setEmailSettingsMessageType(null);
        }, 3000);
      }
    } catch (error) {
      reportAppError(error, '保存通知设置');
      setEmailSettingsMessage(formatAppError(error, '保存通知设置'));
      setEmailSettingsMessageType('error');
    } finally {
      setEmailSettingsSaving(false);
    }
  };

  // 加载设备列表
  const loadDevices = async () => {
    setDevicesLoading(true);
    try {
      const response = await fetch('/api/auth/devices');
      if (response.ok) {
        const data = await response.json();
        setDevices(data.devices || []);
      }
    } catch (error) {
      console.error('加载设备列表失败:', error);
    } finally {
      setDevicesLoading(false);
    }
  };

  // 撤销单个设备
  const handleRevokeDevice = async (tokenId: string) => {
    setConfirmDialog({
      isOpen: true,
      title: '撤销设备登录',
      message: '确定要撤销该设备的登录吗？',
      onConfirm: async () => {
        setConfirmDialog({ ...confirmDialog, isOpen: false });
        setRevoking(tokenId);
        try {
          const response = await fetch('/api/auth/devices', {
            method: 'DELETE',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ tokenId }),
          });

          if (response.ok) {
            // 撤销成功后不重新加载列表，仅移除当前撤销的设备项
            setDevices((prevDevices) =>
              prevDevices.filter((device) => device.tokenId !== tokenId)
            );
          } else {
            alert('撤销失败，请重试');
          }
        } catch (error) {
          console.error('撤销设备失败:', error);
          alert('撤销失败，请重试');
        } finally {
          setRevoking(null);
        }
      },
    });
  };

  // 撤销所有设备
  const handleRevokeAllDevices = async () => {
    setConfirmDialog({
      isOpen: true,
      title: '登出所有设备',
      message:
        '确定要登出所有设备吗？这将清除所有设备的登录状态（包括当前设备）。',
      onConfirm: async () => {
        setConfirmDialog({ ...confirmDialog, isOpen: false });
        try {
          const response = await fetch('/api/auth/devices', {
            method: 'POST',
          });

          if (response.ok) {
            // 登出所有设备后，重定向到首页
            window.location.href = '/';
          } else {
            alert('操作失败，请重试');
          }
        } catch (error) {
          console.error('登出所有设备失败:', error);
          alert('操作失败，请重试');
        }
      },
    });
  };

  // 根据设备类型返回对应的图标
  const getDeviceIcon = (deviceInfo: string) => {
    const info = deviceInfo.toLowerCase();

    if (
      info.includes('mobile') ||
      info.includes('iphone') ||
      info.includes('android')
    ) {
      return Smartphone;
    }

    if (info.includes('tablet') || info.includes('ipad')) {
      return Tablet;
    }

    return Monitor;
  };

  const handleMenuClick = () => {
    setIsOpen(!isOpen);
  };

  const handleCloseMenu = () => {
    setIsOpen(false);
  };

  const handleLogout = async () => {
    try {
      await fetch('/api/logout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });
    } catch (error) {
      console.error('注销请求失败:', error);
    }
    window.location.href = '/';
  };

  const handleAdminPanel = () => {
    router.push('/admin');
  };

  const handleChangePassword = () => {
    setIsOpen(false);
    setIsChangePasswordOpen(true);
    setNewPassword('');
    setConfirmPassword('');
    setPasswordError('');
  };

  const handleCloseChangePassword = () => {
    setIsChangePasswordOpen(false);
    setNewPassword('');
    setConfirmPassword('');
    setPasswordError('');
  };

  const stopTvQrScanner = useCallback(() => {
    tvQrScanStopRef.current = true;
    if (tvQrStreamRef.current) {
      tvQrStreamRef.current.getTracks().forEach((track) => track.stop());
      tvQrStreamRef.current = null;
    }
    if (tvQrVideoRef.current) {
      tvQrVideoRef.current.srcObject = null;
    }
  }, []);

  const closeTvQrScanner = useCallback(() => {
    stopTvQrScanner();
    setIsTvQrScannerOpen(false);
    setTvQrScannerStatus('');
    setTvQrScannerError('');
  }, [stopTvQrScanner]);

  const handleQrLoginResult = useCallback((rawValue: string) => {
    try {
      const url = new URL(rawValue, window.location.origin);

      const isLocalRemoteUrl =
        (url.protocol === 'http:' || url.protocol === 'https:') &&
        url.searchParams.has('token') &&
        (url.pathname === '/remote' || url.pathname.endsWith('/remote'));

      if (isLocalRemoteUrl) {
        setTvQrScannerStatus('识别成功，正在打开局域网遥控器...');
        stopTvQrScanner();
        window.location.href = url.href;
        return true;
      }

      if (url.origin !== window.location.origin || url.pathname !== '/qr-login') {
        setTvQrScannerError('未识别到电视登录二维码或局域网遥控二维码，请扫描电视屏幕上的二维码。');
        return false;
      }

      const token = url.searchParams.get('token');
      if (!token) {
        setTvQrScannerError('二维码缺少登录凭证，请刷新电视端二维码后重试。');
        return false;
      }

      setTvQrScannerStatus('识别成功，正在打开确认登录页...');
      stopTvQrScanner();
      window.location.href = `/qr-login?token=${encodeURIComponent(token)}`;
      return true;
    } catch {
      setTvQrScannerError('二维码内容无效，请扫描电视端显示的登录二维码或局域网遥控二维码。');
      return false;
    }
  }, [stopTvQrScanner]);

  const startTvQrScanner = useCallback(async () => {
    setIsTvQrScannerOpen(true);
    setTvQrScannerError('');
    setTvQrScannerStatus('正在打开手机摄像头...');
    tvQrScanStopRef.current = false;

    if (!navigator.mediaDevices?.getUserMedia) {
      setTvQrScannerError('当前浏览器不支持调用摄像头，请使用手机浏览器或系统相机扫描电视端二维码。');
      setTvQrScannerStatus('');
      return;
    }

    const BarcodeDetectorCtor = (window as any).BarcodeDetector;
    if (!BarcodeDetectorCtor) {
      setTvQrScannerError('当前浏览器不支持网页内二维码识别，请使用系统相机扫描电视端二维码。');
      setTvQrScannerStatus('');
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { ideal: 'environment' } },
        audio: false,
      });
      tvQrStreamRef.current = stream;

      if (!tvQrVideoRef.current) return;
      tvQrVideoRef.current.srcObject = stream;
      await tvQrVideoRef.current.play();

      const detector = new BarcodeDetectorCtor({ formats: ['qr_code'] });
      setTvQrScannerStatus('请将电视屏幕上的登录二维码或局域网遥控二维码放入取景框');

      const scan = async () => {
        if (tvQrScanStopRef.current || !tvQrVideoRef.current) return;
        try {
          const barcodes = await detector.detect(tvQrVideoRef.current);
          const rawValue = barcodes?.[0]?.rawValue;
          if (rawValue && handleQrLoginResult(rawValue)) return;
        } catch (error) {
          console.error('二维码识别失败:', error);
        }
        window.setTimeout(scan, 350);
      };

      scan();
    } catch (error) {
      console.error('打开摄像头失败:', error);
      setTvQrScannerError('无法打开摄像头，请检查浏览器相机权限后重试。');
      setTvQrScannerStatus('');
      stopTvQrScanner();
    }
  }, [handleQrLoginResult, stopTvQrScanner]);

  useEffect(() => {
    return () => stopTvQrScanner();
  }, [stopTvQrScanner]);

  const handleSubscribe = async () => {
    setIsOpen(false);
    setIsSubscribeOpen(true);
    setCopySuccess(false);
    setOrionBaseUrlCopySuccess(false);
    // 懒加载: TVBox 订阅启用时才请求订阅 URL
    if (subscribeEnabled) {
      await fetchSubscribeUrl();
    } else {
      setIsLoadingSubscribeUrl(false);
    }
  };

  const handleCloseSubscribe = () => {
    setIsSubscribeOpen(false);
    setCopySuccess(false);
    setOrionBaseUrlCopySuccess(false);
  };

  const handleCopySubscribeUrl = async () => {
    try {
      await navigator.clipboard.writeText(subscribeUrl);
      setCopySuccess(true);
      setTimeout(() => {
        setCopySuccess(false);
      }, 2000);
    } catch (error) {
      console.error('复制失败:', error);
    }
  };

  const handleCopyOrionBaseUrl = async () => {
    try {
      await navigator.clipboard.writeText(window.location.origin);
      setOrionBaseUrlCopySuccess(true);
      setTimeout(() => {
        setOrionBaseUrlCopySuccess(false);
      }, 2000);
    } catch (error) {
      console.error('复制OrionTV Base URL失败:', error);
    }
  };

  useEffect(() => {
    if (!tvboxToken || !isSubscribeOpen) return;
    setSubscribeUrl(
      buildSubscribeUrl(
        tvboxToken,
        subscribeAdFilterEnabled,
        subscribeYellowFilterEnabled
      )
    );
  }, [
    tvboxToken,
    subscribeAdFilterEnabled,
    subscribeYellowFilterEnabled,
    isSubscribeOpen,
  ]);

  const handleSubmitChangePassword = async () => {
    setPasswordError('');

    // 验证密码
    if (!newPassword) {
      setPasswordError('新密码不得为空');
      return;
    }

    if (newPassword !== confirmPassword) {
      setPasswordError('两次输入的密码不一致');
      return;
    }

    setPasswordLoading(true);

    try {
      const response = await fetch('/api/change-password', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          newPassword,
        }),
      });

      await readJsonResponse(response, '修改密码');

      // 修改成功，关闭弹窗并登出
      setIsChangePasswordOpen(false);
      await handleLogout();
    } catch (error) {
      reportAppError(error, '修改密码');
      setPasswordError(formatAppError(error, '修改密码'));
    } finally {
      setPasswordLoading(false);
    }
  };

  const handleSettings = () => {
    setIsOpen(false);
    setIsSettingsOpen(true);
  };

  const handleCloseSettings = () => {
    setIsSettingsOpen(false);
  };

  // 检查是否显示管理面板按钮
  const showAdminPanel =
    (authInfo?.role === 'owner' || authInfo?.role === 'admin') &&
    storageType !== 'localstorage';

  // 检查是否显示离线下载按钮
  const showOfflineDownload =
    (authInfo?.role === 'owner' || authInfo?.role === 'admin') &&
    typeof window !== 'undefined' &&
    (window as any).RUNTIME_CONFIG?.ENABLE_OFFLINE_DOWNLOAD === true;

  // 检查是否显示修改密码按钮
  const showChangePassword =
    authInfo?.role !== 'owner' && storageType !== 'localstorage';

  // 角色中文映射
  const getRoleText = (role?: string) => {
    switch (role) {
      case 'owner':
        return '站长';
      case 'admin':
        return '管理员';
      case 'user':
        return '用户';
      default:
        return '';
    }
  };

  const currentUsername = authInfo?.username || 'default';
  const currentRole = authInfo?.role || 'user';
  const currentRoleText = getRoleText(currentRole);
  const avatarText = currentUsername.trim().charAt(0).toUpperCase() || 'D';

  const handleOpenProfileCenter = () => {
    setIsOpen(false);
    setIsProfileCenterOpen(true);
  };

  // 菜单面板内容
  const menuPanel = (
    <>
      {/* 背景遮罩 - 普通菜单无需模糊 */}
      <div
        className='fixed inset-0 bg-transparent z-[1000]'
        onClick={handleCloseMenu}
      />

      {/* 菜单面板 */}
      <div className='ptv-menu ptv-account-menu ptv-pop-in origin-top-right fixed top-[calc(3.5rem+var(--safe-top))] right-[max(1rem,env(safe-area-inset-right))] max-h-[calc(100dvh-4.5rem-var(--safe-top)-env(safe-area-inset-bottom))] bg-white dark:bg-gray-900 rounded-lg shadow-xl z-[1001] border border-gray-200/50 dark:border-gray-700/50 overflow-y-auto'>
        {/* 用户信息区域 */}
        <div className='ptv-account-header'>
            <button
              onClick={handleOpenProfileCenter}
              className='ptv-account-profile'
            >
              <div className='ptv-account-avatar'>
                <span>{avatarText}</span>
              </div>
              <div className='ptv-account-identity'>
                <span className='ptv-account-name'>{currentUsername}</span>
                <span className='ptv-account-role'>{currentRoleText}</span>
              </div>
            </button>
        </div>

        {/* 菜单项 */}
        <div className='py-1'>
          {/* 通知按钮 */}
          {!quickActions && (
          <button
            onClick={() => {
              setIsOpen(false);
              setIsNotificationPanelOpen(true);
            }}
            className='w-full px-3 py-2 text-left flex items-center gap-2.5 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors text-sm relative'
          >
            <Bell className='w-4 h-4 text-gray-500 dark:text-gray-400' />
            <span className='font-medium'>通知中心</span>
            {unreadCount > 0 && (
              <span className='ml-auto px-2 py-0.5 text-xs font-medium bg-red-500 text-white rounded-full'>
                {unreadCount > 99 ? '99+' : unreadCount}
              </span>
            )}
          </button>
          )}

          {/* 设置按钮 */}
          <button
            onClick={handleSettings}
            className='w-full px-3 py-2 text-left flex items-center gap-2.5 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors text-sm'
          >
            <Settings className='w-4 h-4 text-gray-500 dark:text-gray-400' />
            <span className='font-medium'>个人设置</span>
          </button>

          {/* 管理面板按钮 */}
          {showAdminPanel && (
            <button
              onClick={handleAdminPanel}
              className='w-full px-3 py-2 text-left flex items-center gap-2.5 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors text-sm'
            >
              <Shield className='w-4 h-4 text-gray-500 dark:text-gray-400' />
              <span className='font-medium'>管理面板</span>
            </button>
          )}

          {showOfflineDownload && <div className='ptv-account-divider' />}
          {/* 离线下载按钮 */}
          {showOfflineDownload && (
            <button
              onClick={() => {
                setIsOfflineDownloadPanelOpen(true);
                setIsOpen(false);
              }}
              className='w-full px-3 py-2 text-left flex items-center gap-2.5 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors text-sm'
            >
              <Download className='w-4 h-4 text-gray-500 dark:text-gray-400' />
              <span className='font-medium'>离线下载</span>
            </button>
          )}

          {/* 电视访问按钮 */}
          <button
            onClick={handleSubscribe}
            className='w-full px-3 py-2 text-left flex items-center gap-2.5 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors text-sm'
          >
            <Monitor className='w-4 h-4 text-gray-500 dark:text-gray-400' />
            <span className='font-medium'>电视访问</span>
          </button>

          {/* 分割线 */}
          <div className='my-1 border-t border-gray-200 dark:border-gray-700'></div>

          {/* 登出按钮 */}
          <button
            onClick={handleLogout}
            className='w-full px-3 py-2 text-left flex items-center gap-2.5 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors text-sm'
          >
            <LogOut className='w-4 h-4' />
            <span className='font-medium'>登出</span>
          </button>

        </div>
      </div>
    </>
  );

  // 电视访问面板内容
  const subscribePanel = (
    <>
      {/* 背景遮罩 */}
      <div
        className='ptv-scrim-in fixed inset-0 bg-black/60 backdrop-blur-sm z-[1000]'
        onClick={handleCloseSubscribe}
        onTouchMove={(e) => {
          e.preventDefault();
        }}
        onWheel={(e) => {
          e.preventDefault();
        }}
        style={{
          touchAction: 'none',
        }}
      />

      {/* 电视访问面板 */}
      <div className='ptv-dialog ptv-modal-in ptv-tv-access fixed top-1/2 left-1/2 z-[1001] max-h-[92vh] w-full max-w-3xl -translate-x-1/2 -translate-y-1/2 overflow-hidden rounded-3xl border border-slate-200/70 bg-white shadow-2xl shadow-black/30 dark:border-white/10 dark:bg-slate-950'>
        <div
          className='max-h-[92vh] overflow-y-auto p-6 sm:p-7'
          data-panel-content
          onTouchMove={(e) => {
            e.stopPropagation();
          }}
          style={{
            touchAction: 'auto',
          }}
        >
          {isTvQrScannerOpen ? (
            <div className='relative -m-6 min-h-[72vh] overflow-hidden bg-black sm:-m-7'>
              <video
                ref={tvQrVideoRef}
                className='absolute inset-0 h-full w-full object-cover'
                muted
                playsInline
              />
              <div className='pointer-events-none absolute inset-0 grid place-items-center'>
                <div className="h-64 w-64 rounded-xl border-4 border-white/90 [box-shadow:0_0_0_9999px_var(--ptv-media-bg-alpha-58),0_0_30px_var(--ptv-media-bg-alpha-55)] sm:h-80 sm:w-80" />
              </div>
              <div className='absolute left-0 right-0 top-0 flex items-start justify-between gap-4 bg-gradient-to-b from-black/75 to-transparent p-5 text-white sm:p-7'>
                <div>
                  <div className='inline-flex items-center gap-2 rounded-full bg-rose-500/25 px-3 py-1 text-xs font-black text-rose-100 ring-1 ring-rose-300/20'>
                    <Smartphone className='h-4 w-4' />
                    手机相机扫码
                  </div>
                  <h3 className='mt-3 text-2xl font-black'>扫描电视二维码</h3>
                  <p className='mt-1 text-sm text-white/75'>支持扫码登录，也支持打开局域网遥控器</p>
                </div>
                <button
                  type='button'
                  onClick={closeTvQrScanner}
                  className='flex h-10 w-10 cursor-pointer items-center justify-center rounded-full bg-white/15 text-white backdrop-blur transition hover:bg-white/25 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/70'
                  aria-label='关闭扫码'
                >
                  <X className='h-5 w-5' />
                </button>
              </div>
              <div className='absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/85 to-transparent p-5 sm:p-7'>
                {tvQrScannerStatus && (
                  <p className='rounded-2xl bg-white/12 px-4 py-3 text-center text-sm font-black text-white backdrop-blur'>
                    {tvQrScannerStatus}
                  </p>
                )}
                {tvQrScannerError && (
                  <p className='mt-3 rounded-2xl bg-red-500/20 px-4 py-3 text-center text-sm font-black text-red-100 ring-1 ring-red-300/20 backdrop-blur'>
                    {tvQrScannerError}
                  </p>
                )}
              </div>
            </div>
          ) : (
            <>
          {/* 标题栏 */}
          <div className='mb-6 flex items-start justify-between gap-4'>
            <div>
              <div className='inline-flex items-center gap-2 rounded-full bg-green-500/10 px-3 py-1 text-xs font-bold text-green-600 dark:text-green-400'>
                <Monitor className='h-4 w-4' />
                TV ACCESS
              </div>
              <h3 className='mt-3 text-2xl font-black text-slate-900 dark:text-slate-50'>
                电视访问
              </h3>
            </div>
            <button
              onClick={handleCloseSubscribe}
              className="flex h-9 w-9 cursor-pointer items-center justify-center rounded-full text-slate-500 transition hover:bg-slate-100 hover:text-slate-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-apex-accent dark:hover:bg-white/10 dark:hover:text-white"
              aria-label='Close'
            >
              <X className='h-5 w-5' />
            </button>
          </div>

          <div className='mb-5 grid grid-cols-3 rounded-2xl bg-slate-100 p-1 dark:bg-white/10'>
            {[
              { key: 'tvbox' as const, label: 'TVBox 订阅', icon: Rss },
              { key: 'orion' as const, label: 'OrionTV', icon: Download },
              { key: 'web' as const, label: 'Web 电视', icon: Monitor },
            ].map((item) => {
              const Icon = item.icon;
              const active = tvAccessTab === item.key;
              return (
                <button
                  key={item.key}
                  type='button'
                  onClick={() => {
                    setTvAccessTab(item.key);
                    if (item.key !== 'web') closeTvQrScanner();
                  }}
                  className={`flex cursor-pointer items-center justify-center gap-2 rounded-xl px-3 py-3 text-sm font-black transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-green-500/70 ${
                    active
                      ? 'bg-white text-slate-950 shadow-sm dark:bg-slate-950 dark:text-white'
                      : 'text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white'
                  }`}
                >
                  <Icon className='h-4 w-4' />
                  <span className='hidden sm:inline'>{item.label}</span>
                  <span className='sm:hidden'>{item.key === 'tvbox' ? 'TVBox' : item.key === 'orion' ? 'Orion' : 'Web'}</span>
                </button>
              );
            })}
          </div>

          {tvAccessTab === 'tvbox' && (
            <section className='rounded-2xl border border-slate-200 bg-slate-50 p-5 dark:border-white/10 dark:bg-white/[0.04]'>
              <div className='flex items-center justify-between gap-3'>
                <div className='flex items-center gap-3'>
                  <div className='flex h-11 w-11 items-center justify-center rounded-2xl bg-green-500 text-white shadow-lg shadow-green-500/25'>
                    <Rss className='h-5 w-5' />
                  </div>
                  <div>
                    <h4 className='text-lg font-black text-slate-900 dark:text-slate-100'>
                      TVBox 订阅
                    </h4>
                    <p className='mt-1 text-sm text-slate-600 dark:text-slate-400'>
                      复制订阅链接到 TVBox 使用
                    </p>
                  </div>
                </div>
                <span
                  className={`rounded-full px-2.5 py-1 text-xs font-bold ${
                    subscribeEnabled
                      ? 'bg-green-500/10 text-green-600 dark:text-green-400'
                      : 'bg-slate-200 text-slate-500 dark:bg-white/10 dark:text-slate-400'
                  }`}
                >
                  {subscribeEnabled ? '已启用' : '未启用'}
                </span>
              </div>

              {!subscribeEnabled ? (
                <div className='mt-5 rounded-xl border border-dashed border-slate-300 bg-white/70 px-4 py-3 text-sm font-semibold text-slate-500 dark:border-white/10 dark:bg-white/5 dark:text-slate-400'>
                  TVBox 订阅功能未启用
                </div>
              ) : isLoadingSubscribeUrl ? (
                <div className='mt-5 space-y-3'>
                  <div className='h-14 motion-safe:animate-pulse rounded-xl bg-slate-200 dark:bg-white/10' />
                  <div className='h-14 motion-safe:animate-pulse rounded-xl bg-slate-200 dark:bg-white/10' />
                  <div className='h-10 motion-safe:animate-pulse rounded-xl bg-slate-200 dark:bg-white/10' />
                </div>
              ) : (
                <div className='mt-5 space-y-4'>
                  <div className='grid gap-3 sm:grid-cols-2'>
                    <button
                      type='button'
                      onClick={() => setSubscribeAdFilterEnabled((prev) => !prev)}
                      className='flex w-full cursor-pointer items-center justify-between rounded-xl border border-slate-200 bg-white px-4 py-3 text-left transition hover:border-green-400 dark:border-white/10 dark:bg-slate-900/70'
                    >
                      <div>
                        <div className='text-sm font-bold text-slate-800 dark:text-slate-200'>去广告</div>
                        <div className='mt-1 text-xs text-slate-500 dark:text-slate-400'>开启后通过代理处理播放链接</div>
                      </div>
                      <span className={`h-5 w-9 rounded-full p-0.5 transition ${subscribeAdFilterEnabled ? 'bg-green-500' : 'bg-slate-300 dark:bg-slate-700'}`}>
                        <span className={`block h-4 w-4 rounded-full bg-white transition ${subscribeAdFilterEnabled ? 'translate-x-4' : ''}`} />
                      </span>
                    </button>
                    <button
                      type='button'
                      onClick={() => setSubscribeYellowFilterEnabled((prev) => !prev)}
                      className='flex w-full cursor-pointer items-center justify-between rounded-xl border border-slate-200 bg-white px-4 py-3 text-left transition hover:border-yellow-400 dark:border-white/10 dark:bg-slate-900/70'
                    >
                      <div>
                        <div className='text-sm font-bold text-slate-800 dark:text-slate-200'>黄色过滤</div>
                        <div className='mt-1 text-xs text-slate-500 dark:text-slate-400'>过滤代理搜索中的黄色内容</div>
                      </div>
                      <span className={`h-5 w-9 rounded-full p-0.5 transition ${subscribeYellowFilterEnabled ? 'bg-yellow-500' : 'bg-slate-300 dark:bg-slate-700'}`}>
                        <span className={`block h-4 w-4 rounded-full bg-white transition ${subscribeYellowFilterEnabled ? 'translate-x-4' : ''}`} />
                      </span>
                    </button>
                  </div>

                  <div>
                    <h4 className='mb-2 text-sm font-medium text-slate-700 dark:text-slate-300'>
                      订阅链接
                    </h4>
                    <div className='flex gap-2'>
                      <input
                        type='text'
                        className="min-w-0 flex-1 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 outline-none focus:ring-2 focus:ring-apex-accent dark:border-white/10 dark:bg-slate-900 dark:text-slate-200"
                        value={subscribeUrl}
                        readOnly
                      />
                      <button
                        onClick={handleCopySubscribeUrl}
                        className='inline-flex cursor-pointer items-center justify-center gap-2 rounded-xl bg-green-600 px-4 py-2.5 text-sm font-black text-white transition hover:bg-green-700'
                      >
                        <Copy className='h-4 w-4' />
                        {copySuccess ? '已复制' : '复制'}
                      </button>
                    </div>
                    {(subscribeAdFilterEnabled || subscribeYellowFilterEnabled) && (
                      <p className='mt-2 rounded-xl border border-yellow-400/25 bg-yellow-400/10 px-3 py-2 text-xs font-semibold text-yellow-700 dark:text-yellow-300'>
                        💡 代理模式已开启，某些源可能因为区域或兼容问题无法播放
                      </p>
                    )}
                  </div>

                  <div className='pt-1'>
                    <button
                      onClick={handleResetToken}
                      disabled={isResettingToken}
                      className='w-full cursor-pointer rounded-xl bg-red-600 px-4 py-2.5 text-sm font-black text-white transition hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-60'
                    >
                      {isResettingToken ? '重置中...' : '重置订阅Token'}
                    </button>
                    <p className='mt-2 text-center text-xs text-slate-500 dark:text-slate-400'>
                      ⚠️ 重置后旧链接将失效
                    </p>
                    <p id='tvbox-token-message' className='hidden text-center text-xs'></p>
                  </div>
                </div>
              )}
            </section>
          )}

          {tvAccessTab === 'orion' && (
            <section className='rounded-2xl border border-slate-200 bg-slate-50 p-5 dark:border-white/10 dark:bg-white/[0.04]'>
              <div className='flex items-center gap-3'>
                <img
                  src='/icons/OrionTV.png'
                  alt='OrionTV'
                  className='h-11 w-11 rounded-2xl object-cover shadow-lg shadow-indigo-500/20'
                />
                <div>
                  <h4 className='text-lg font-black text-slate-900 dark:text-slate-100'>
                    OrionTV
                  </h4>
                  <p className='mt-1 text-sm text-slate-600 dark:text-slate-400'>
                    Android TV 专用客户端
                  </p>
                </div>
              </div>
              <p className='mt-5 text-sm leading-6 text-slate-600 dark:text-slate-400'>
                面向 Android TV 和电视盒子的第三方客户端，适合使用遥控器浏览与播放。连接本站后的兼容性待验证，界面由客户端提供。
              </p>
              <div className='mt-5'>
                <h5 className='mb-2 text-sm font-bold text-slate-700 dark:text-slate-300'>
                  Base URL
                </h5>
                <div className='flex gap-2'>
                  <input
                    type='text'
                    readOnly
                    value={typeof window !== 'undefined' ? window.location.origin : ''}
                    className='min-w-0 flex-1 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 outline-none dark:border-white/10 dark:bg-slate-900 dark:text-slate-200'
                  />
                  <button
                    type='button'
                    onClick={handleCopyOrionBaseUrl}
                    className="inline-flex cursor-pointer items-center justify-center gap-2 rounded-xl bg-apex-action px-4 py-2.5 text-sm font-black text-apex-action-ink transition hover:bg-apex-action"
                  >
                    <Copy className='h-4 w-4' />
                    {orionBaseUrlCopySuccess ? '已复制' : '复制'}
                  </button>
                </div>
                <p className='mt-2 text-xs text-slate-500 dark:text-slate-400'>
                  在 OrionTV 中填写该地址作为后端服务地址。
                </p>
              </div>
              <a
                href='https://github.com/mtvpls/OrionTV_Build/tags'
                target='_blank'
                rel='noopener noreferrer'
                className="mt-5 inline-flex cursor-pointer items-center justify-center gap-2 rounded-xl bg-apex-action px-5 py-3 text-sm font-black text-apex-action-ink transition hover:bg-apex-action"
              >
                下载 OrionTV
                <ExternalLink className='h-4 w-4' />
              </a>
            </section>
          )}

          {tvAccessTab === 'web' && (
            <section className='rounded-2xl border border-slate-200 bg-slate-50 p-5 dark:border-white/10 dark:bg-white/[0.04]'>
              <div className='flex items-center gap-3'>
                <div className='flex h-11 w-11 items-center justify-center rounded-2xl bg-rose-500 text-white shadow-lg shadow-rose-500/25'>
                  <Monitor className='h-5 w-5' />
                </div>
                <div>
                  <h4 className='text-lg font-black text-slate-900 dark:text-slate-100'>
                    Web 电视
                  </h4>
                  <p className='mt-1 text-sm text-slate-600 dark:text-slate-400'>
                    手机扫描电视屏幕二维码并确认登录
                  </p>
                </div>
              </div>
                <p className='mt-5 text-sm leading-6 text-slate-600 dark:text-slate-400'>
                {tvModeEnabled
                  ? '电视端打开 /tv 后可扫码登录；在电视端“我的”页也可扫描局域网遥控二维码。'
                  : '当前部署已关闭 TV 模式，/tv 页面和 Web 电视遥控不可用。'}
              </p>
              {!tvModeEnabled && (
                <div className='mt-5 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-bold text-amber-800 dark:border-amber-300/20 dark:bg-amber-400/10 dark:text-amber-200'>
                  TV 模式默认开启；环境变量 ENABLE_TV_MODE=false 会关闭该功能。
                </div>
              )}
              {tvModeEnabled && !tvRemoteAvailable && (
                <p className='mt-3 text-sm text-slate-600 dark:text-slate-400'>当前部署未接入站点遥控。</p>
              )}
              <p className='mt-3 text-sm text-slate-600 dark:text-slate-400'>如浏览器不支持网页扫码，可使用系统相机扫描电视端二维码。</p>
              <div className='mt-5 grid gap-2 sm:grid-cols-2'>
                {tvModeEnabled && (
                  <a
                    href='/tv'
                    target='_blank'
                    rel='noopener noreferrer'
                    className='ptv-tv-open inline-flex min-h-11 items-center justify-center gap-2 rounded-xl px-4 py-3 text-sm font-semibold sm:col-span-2'
                  >
                    <Monitor className='h-4 w-4' />
                    打开 Web 电视
                  </a>
                )}
                <button
                  type='button'
                  onClick={startTvQrScanner}
                  disabled={!tvModeEnabled}
                  className='inline-flex w-full cursor-pointer items-center justify-center gap-2 rounded-xl bg-rose-600 px-4 py-3 text-sm font-black text-white transition hover:bg-rose-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-500/70 disabled:cursor-not-allowed disabled:bg-slate-300 disabled:text-slate-500 dark:disabled:bg-white/10 dark:disabled:text-slate-500'
                >
                  打开相机扫码
                  <Smartphone className='h-4 w-4' />
                </button>
                <button
                  type='button'
                  onClick={() => {
                    if (!tvModeEnabled || !tvRemoteAvailable) return;
                    setIsSubscribeOpen(false);
                    setIsTVRemoteOpen(true);
                  }}
                  disabled={!tvModeEnabled || !tvRemoteAvailable}
                  className='inline-flex w-full cursor-pointer items-center justify-center gap-2 rounded-xl bg-slate-950 px-4 py-3 text-sm font-black text-white transition hover:bg-slate-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-500/70 disabled:cursor-not-allowed disabled:bg-slate-300 disabled:text-slate-500 dark:bg-white dark:text-slate-950 dark:hover:bg-slate-200 dark:disabled:bg-white/10 dark:disabled:text-slate-500'
                >
                  <Sliders className='h-4 w-4' />
                  远程电视遥控器
                </button>
              </div>

            </section>
          )}
            </>
          )}
        </div>
      </div>
    </>
  );

  // 修改密码面板内容
  const changePasswordPanel = (
    <>
      {/* 背景遮罩 */}
      <div
        className='ptv-scrim-in fixed inset-0 bg-black/50 backdrop-blur-sm z-[1000]'
        onClick={handleCloseChangePassword}
        onTouchMove={(e) => {
          // 只阻止滚动，允许其他触摸事件
          e.preventDefault();
        }}
        onWheel={(e) => {
          // 阻止滚轮滚动
          e.preventDefault();
        }}
        style={{
          touchAction: 'none',
        }}
      />

      {/* 修改密码面板 */}
      <div className='ptv-modal-in fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-full max-w-md bg-white dark:bg-gray-900 rounded-xl shadow-xl z-[1001] overflow-hidden'>
        {/* 内容容器 - 独立的滚动区域 */}
        <div
          className='h-full p-6'
          data-panel-content
          onTouchMove={(e) => {
            // 阻止事件冒泡到遮罩层，但允许内部滚动
            e.stopPropagation();
          }}
          style={{
            touchAction: 'auto', // 允许所有触摸操作
          }}
        >
          {/* 标题栏 */}
          <div className='flex items-center justify-between mb-6'>
            <h3 className='text-xl font-bold text-gray-800 dark:text-gray-200'>
              修改密码
            </h3>
            <button
              onClick={handleCloseChangePassword}
              className='w-8 h-8 p-1 rounded-full flex items-center justify-center text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors'
              aria-label='Close'
            >
              <X className='w-full h-full' />
            </button>
          </div>

          {/* 表单 */}
          <div className='space-y-4'>
            {/* 新密码输入 */}
            <div>
              <label className='block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2'>
                新密码
              </label>
              <input
                type='password'
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-apex-accent focus:border-transparent transition-colors bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 placeholder-gray-500 dark:placeholder-gray-400"
                placeholder='请输入新密码'
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                disabled={passwordLoading}
              />
            </div>

            {/* 确认密码输入 */}
            <div>
              <label className='block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2'>
                确认密码
              </label>
              <input
                type='password'
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-apex-accent focus:border-transparent transition-colors bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 placeholder-gray-500 dark:placeholder-gray-400"
                placeholder='请再次输入新密码'
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                disabled={passwordLoading}
              />
            </div>

            {/* 错误信息 */}
            {passwordError && (
              <div className='text-red-500 text-sm bg-red-50 dark:bg-red-900/20 p-3 rounded-md border border-red-200 dark:border-red-800'>
                {passwordError}
              </div>
            )}
          </div>

          {/* 操作按钮 */}
          <div className='flex gap-3 mt-6 pt-4 border-t border-gray-200 dark:border-gray-700'>
            <button
              onClick={handleCloseChangePassword}
              className='flex-1 px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 rounded-md transition-colors'
              disabled={passwordLoading}
            >
              取消
            </button>
            <button
              onClick={handleSubmitChangePassword}
              className='flex-1 px-4 py-2 text-sm font-medium text-white bg-green-600 hover:bg-green-700 dark:bg-green-700 dark:hover:bg-green-600 rounded-md transition-colors disabled:opacity-50 disabled:cursor-not-allowed'
              disabled={passwordLoading || !newPassword || !confirmPassword}
            >
              {passwordLoading ? '修改中...' : '确认修改'}
            </button>
          </div>

          {/* 底部说明 */}
          <div className='mt-4 pt-4 border-t border-gray-200 dark:border-gray-700'>
            <p className='text-xs text-gray-500 dark:text-gray-400 text-center'>
              修改密码后需要重新登录
            </p>
          </div>
        </div>
      </div>
    </>
  );

  return (
    <>
      {quickActions && <>
        <button type='button' className='f1-icon-button f1-top-notifications' aria-label='通知中心' title='通知中心'
          disabled={!mounted} onClick={() => { setIsOpen(false); setIsNotificationPanelOpen(true); }}>
          <Bell size={19} aria-hidden />
          {unreadCount > 0 && <span className='f1-top-unread' aria-label={String(unreadCount) + ' 条未读通知'} />}
        </button>

      </>}
      <div className='relative'>
        <button
          onClick={handleMenuClick}
          className='ptv-account-trigger w-11 h-11 shrink-0 p-0 rounded-full flex items-center justify-center text-gray-600 hover:bg-gray-200/50 dark:text-gray-300 dark:hover:bg-gray-700/50 active:scale-95 transition-[background-color,color,transform] duration-150'
          aria-label='账户菜单'
          aria-expanded={isOpen}
        >
          {quickActions ? <span className='f1-top-avatar' aria-hidden='true'>{avatarText}</span> : <User className='w-full h-full' />}
        </button>
        {/* 未读通知红点 */}
        {unreadCount > 0 && (
          <div className='ptv-fade-in absolute top-[2px] right-[2px] w-2 h-2 bg-red-500 rounded-full'></div>
        )}
      </div>

      {/* 使用 Portal 将菜单面板渲染到 document.body */}
      {isOpen && mounted && createPortal(menuPanel, document.body)}

      <PersonalCenterPanel
        isOpen={isProfileCenterOpen}
        mounted={mounted}
        onClose={() => setIsProfileCenterOpen(false)}
        username={currentUsername}
        roleText={currentRoleText}
        avatarText={avatarText}
        showDeviceManagement={storageType !== 'localstorage'}
        showChangePassword={showChangePassword}
        onOpenEmailSettings={() => {
          setIsProfileCenterOpen(false);
          setIsEmailSettingsOpen(true);
          loadEmailSettings();
        }}
        onOpenDeviceManagement={() => {
          setIsProfileCenterOpen(false);
          setIsDeviceManagementOpen(true);
          loadDevices();
        }}
        onOpenChangePassword={() => {
          setIsProfileCenterOpen(false);
          handleChangePassword();
        }}
      />

      <LocalSettingsPanel
        open={isSettingsOpen}
        onClose={handleCloseSettings}
        onOpenDownloads={() => {
          setIsSettingsOpen(false);
          setIsDownloadManagementOpen(true);
        }}
      />

      {/* 使用 Portal 将修改密码面板渲染到 document.body */}
      {isChangePasswordOpen &&
        mounted &&
        createPortal(changePasswordPanel, document.body)}

      {/* 使用 Portal 将订阅面板渲染到 document.body */}
      {isSubscribeOpen &&
        mounted &&
        createPortal(subscribePanel, document.body)}

      {/* 离线下载面板 */}
      <OfflineDownloadPanel
        isOpen={isOfflineDownloadPanelOpen}
        onClose={() => setIsOfflineDownloadPanelOpen(false)}
      />

      {/* 使用 Portal 将通知面板渲染到 document.body */}
      {isNotificationPanelOpen &&
        mounted &&
        createPortal(
          <NotificationPanel
            isOpen={isNotificationPanelOpen}
            onOpenNotificationSettings={() => {
              setIsNotificationPanelOpen(false);
              setIsEmailSettingsOpen(true);
              void loadEmailSettings();
            }}
            onClose={() => {
              setIsNotificationPanelOpen(false);
              // 不需要在这里刷新，NotificationPanel 内部会触发事件
            }}
          />,
          document.body
        )}

      {/* 使用 Portal 将下载文件管理面板渲染到 document.body */}
      {isDownloadManagementOpen &&
        mounted &&
        createPortal(
          <DownloadManagementPanel
            isOpen={isDownloadManagementOpen}
            onClose={() => setIsDownloadManagementOpen(false)}
          />,
          document.body
        )}

      <EmailSettingsPanel
        isOpen={isEmailSettingsOpen}
        mounted={mounted}
        onClose={() => setIsEmailSettingsOpen(false)}
        userEmail={userEmail}
        onUserEmailChange={setUserEmail}
        emailNotifications={emailNotifications}
        onEmailNotificationsChange={setEmailNotifications}
        pushNotifications={pushNotifications}
        onPushNotificationsChange={handlePushNotificationsChange}
        pushNotificationsSupported={pushNotificationsSupported}
        pushNotificationsConfigured={pushNotificationsConfigured}
        pushNotificationsBusy={pushNotificationsBusy}
        telegramEnabled={telegramEnabled}
        telegramBound={telegramBound}
        telegramUsername={telegramUsername}
        telegramBindCode={telegramBindCode}
        telegramDeepLink={telegramDeepLink}
        telegramBindingBusy={telegramBindingBusy}
        onCreateTelegramBindCode={handleCreateTelegramBindCode}
        emailSettingsLoading={emailSettingsLoading}
        emailSettingsSaving={emailSettingsSaving}
        onSave={handleSaveEmailSettings}
        statusMessage={emailSettingsMessage}
        statusType={emailSettingsMessageType}
      />

      <DeviceManagementPanel
        isOpen={isDeviceManagementOpen}
        mounted={mounted}
        onClose={() => setIsDeviceManagementOpen(false)}
        devices={devices}
        devicesLoading={devicesLoading}
        revoking={revoking}
        onRevokeDevice={handleRevokeDevice}
        onRevokeAllDevices={handleRevokeAllDevices}
        getDeviceIcon={getDeviceIcon}
      />

      <TVRemotePanel
        isOpen={isTVRemoteOpen}
        mounted={mounted}
        onClose={() => setIsTVRemoteOpen(false)}
      />

      {/* 确认对话框 */}
      {confirmDialog.isOpen &&
        mounted &&
        createPortal(
          <div className='ptv-scrim-in fixed inset-0 z-[10000] flex items-center justify-center bg-black/50 backdrop-blur-sm'>
            <div className='ptv-modal-in bg-white dark:bg-gray-800 rounded-lg shadow-xl w-full max-w-md m-4'>
              {/* 标题 */}
              <div className='p-6 border-b border-gray-200 dark:border-gray-700'>
                <h3 className='text-lg font-semibold text-gray-900 dark:text-gray-100'>
                  {confirmDialog.title}
                </h3>
              </div>

              {/* 内容 */}
              <div className='p-6'>
                <p className='text-gray-700 dark:text-gray-300'>
                  {confirmDialog.message}
                </p>
              </div>

              {/* 按钮 */}
              <div className='p-6 pt-0 flex gap-3 justify-end'>
                <button
                  onClick={() =>
                    setConfirmDialog({ ...confirmDialog, isOpen: false })
                  }
                  className='px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-gray-100 hover:bg-gray-200 dark:bg-gray-700 dark:hover:bg-gray-600 rounded-lg transition-colors'
                >
                  取消
                </button>
                <button
                  onClick={confirmDialog.onConfirm}
                  className='px-4 py-2 text-sm font-medium text-white bg-red-600 hover:bg-red-700 dark:bg-red-600 dark:hover:bg-red-700 rounded-lg transition-colors'
                >
                  确定
                </button>
              </div>
            </div>
          </div>,
          document.body
        )}
    </>
  );
};
