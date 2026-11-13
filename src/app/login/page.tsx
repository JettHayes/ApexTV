/* eslint-disable @typescript-eslint/no-explicit-any */

'use client';

import { AlertCircle, ArrowRight, CheckCircle, Eye, EyeOff, Lock,Send, User } from 'lucide-react';
import Image from 'next/image';
import { useRouter, useSearchParams } from 'next/navigation';
import { Suspense, useEffect, useState } from 'react';

import { CURRENT_VERSION } from '@/lib/version';
import { checkForUpdates, UpdateStatus } from '@/lib/version_check';

import { useSite } from '@/components/SiteProvider';
import { ThemeToggle } from '@/components/ThemeToggle';

// 版本显示组件
function VersionDisplay() {
  const [updateStatus, setUpdateStatus] = useState<UpdateStatus | null>(null);
  const [isChecking, setIsChecking] = useState(true);

  useEffect(() => {
    const checkUpdate = async () => {
      try {
        const status = await checkForUpdates();
        setUpdateStatus(status);
      } catch (_) {
        // do nothing
      } finally {
        setIsChecking(false);
      }
    };

    checkUpdate();
  }, []);

  return (
    <button
      onClick={() =>
        window.open('https://github.com/JettHayes/ApexTV', '_blank')
      }
      className='ptv-login-version z-10 cursor-pointer'
    >
      <span className='font-mono'>v{CURRENT_VERSION}</span>
      {!isChecking && updateStatus !== UpdateStatus.FETCH_FAILED && (
        <div
          className={`flex items-center gap-1.5 ${updateStatus === UpdateStatus.HAS_UPDATE
            ? 'text-yellow-600 dark:text-yellow-400'
            : updateStatus === UpdateStatus.NO_UPDATE
              ? 'text-green-600 dark:text-green-400'
              : ''
            }`}
        >
          {updateStatus === UpdateStatus.HAS_UPDATE && (
            <>
              <AlertCircle className='w-3.5 h-3.5' />
              <span className='font-semibold text-xs'>有新版本</span>
            </>
          )}
          {updateStatus === UpdateStatus.NO_UPDATE && (
            <>
              <CheckCircle className='w-3.5 h-3.5' />
              <span className='font-semibold text-xs'>已是最新</span>
            </>
          )}
        </div>
      )}
    </button>
  );
}

// 根据按钮文本识别OIDC提供商并返回对应的图标
function getOIDCProviderIcon(buttonText: string) {
  const text = buttonText.toLowerCase();

  const providers = [
    { keywords: ['linuxdo'], icon: '/icons/linuxdo.png', alt: 'LinuxDo' },
    { keywords: ['github'], icon: '/icons/github.png', alt: 'GitHub' },
    { keywords: ['google'], icon: '/icons/google.png', alt: 'Google' },
    { keywords: ['microsoft', 'azure', 'entra'], icon: '/icons/microsoft.png', alt: 'Microsoft' },
    { keywords: ['gitlab'], icon: '/icons/gitlab.png', alt: 'GitLab' },
  ];

  for (const provider of providers) {
    if (provider.keywords.some(keyword => text.includes(keyword))) {
      return <img src={provider.icon} alt={provider.alt} className='w-5 h-5' />;
    }
  }

  // 默认图标
  return (
    <svg className='w-5 h-5' fill='currentColor' viewBox='0 0 20 20'>
      <path fillRule='evenodd' d='M10 9a3 3 0 100-6 3 3 0 000 6zm-7 9a7 7 0 1114 0H3z' clipRule='evenodd' />
    </svg>
  );
}

function LoginPageClient() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [password, setPassword] = useState('');
  const [username, setUsername] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [shouldAskUsername, setShouldAskUsername] = useState(false);
  const [rememberPassword, setRememberPassword] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [turnstileToken, setTurnstileToken] = useState<string | null>(null);
  const [turnstileLoaded, setTurnstileLoaded] = useState(false);
  const [siteConfig, setSiteConfig] = useState<any>(null);
  const [turnstileWidgetId, setTurnstileWidgetId] = useState<string | null>(null);
  const [backgroundImage, setBackgroundImage] = useState<string>('');
  const [telegramLoginEnabled, setTelegramLoginEnabled] = useState(false);
  const [telegramLoginLoading, setTelegramLoginLoading] = useState(false);
  const [telegramLoginHint, setTelegramLoginHint] = useState<string | null>(null);

  const { siteName } = useSite();

  // 处理URL中的error参数
  useEffect(() => {
    const errorParam = searchParams.get('error');
    if (errorParam) {
      setError(decodeURIComponent(errorParam));
    }
  }, [searchParams]);

  // 在客户端挂载后设置配置
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const runtimeConfig = (window as any).RUNTIME_CONFIG;
      const storageType = runtimeConfig?.STORAGE_TYPE;
      const shouldAsk = storageType && storageType !== 'localstorage';
      setShouldAskUsername(shouldAsk);

      // 设置背景图（支持多张随机选择）
      const loginBg = runtimeConfig?.LOGIN_BACKGROUND_IMAGE;
      if (loginBg) {
        const urls = loginBg
          .split('\n')
          .map((url: string) => url.trim())
          .filter((url: string) => url !== '');

        if (urls.length > 0) {
          // 随机选择一张背景图
          const randomIndex = Math.floor(Math.random() * urls.length);
          setBackgroundImage(urls[randomIndex]);
        }
      }

      // 设置站点配置
      setSiteConfig({
        LoginRequireTurnstile: runtimeConfig?.LOGIN_REQUIRE_TURNSTILE || false,
        TurnstileSiteKey: runtimeConfig?.TURNSTILE_SITE_KEY || '',
        EnableRegistration: runtimeConfig?.ENABLE_REGISTRATION || false,
        EnableOIDCLogin: runtimeConfig?.ENABLE_OIDC_LOGIN || false,
        OIDCButtonText: runtimeConfig?.OIDC_BUTTON_TEXT || '',
      });
      setTelegramLoginEnabled(Boolean(runtimeConfig?.ENABLE_TELEGRAM_LOGIN));

      // 从localStorage读取记住的密码信息
      const rememberedCredentials = localStorage.getItem('rememberedCredentials');
      if (rememberedCredentials) {
        try {
          const credentials = JSON.parse(rememberedCredentials);
          if (credentials.password) {
            setPassword(credentials.password);
          }
          if (credentials.username && shouldAsk) {
            setUsername(credentials.username);
          }
          setRememberPassword(true);
        } catch (error) {
          // 清除无效的数据
          localStorage.removeItem('rememberedCredentials');
        }
      }
    }
  }, []);

  // 加载Cloudflare Turnstile脚本
  useEffect(() => {
    if (!siteConfig?.LoginRequireTurnstile || !siteConfig?.TurnstileSiteKey) {
      return;
    }

    const script = document.createElement('script');
    script.src = 'https://challenges.cloudflare.com/turnstile/v0/api.js';
    script.async = true;
    script.defer = true;
    script.onload = () => {
      setTurnstileLoaded(true);
    };
    document.body.appendChild(script);

    return () => {
      document.body.removeChild(script);
    };
  }, [siteConfig]);

  // 渲染Turnstile组件
  useEffect(() => {
    if (!turnstileLoaded || !siteConfig?.TurnstileSiteKey) {
      return;
    }

    const container = document.getElementById('turnstile-container');
    if (container && (window as any).turnstile) {
      const widgetId = (window as any).turnstile.render('#turnstile-container', {
        sitekey: siteConfig.TurnstileSiteKey,
        callback: (token: string) => {
          setTurnstileToken(token);
        },
      });
      setTurnstileWidgetId(widgetId);
    }
  }, [turnstileLoaded, siteConfig]);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError(null);

    if (!password || (shouldAskUsername && !username)) return;

    // 检查Turnstile验证
    if (siteConfig?.LoginRequireTurnstile && !turnstileToken) {
      setError('请完成人机验证');
      return;
    }

    try {
      setLoading(true);
      const res = await fetch('/api/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          password,
          ...(shouldAskUsername ? { username } : {}),
          ...(siteConfig?.LoginRequireTurnstile ? { turnstileToken } : {}),
        }),
      });

      if (res.ok) {
        // 处理记住密码逻辑
        if (rememberPassword) {
          const credentials: any = { password };
          // 如果需要用户名且有用户名，就保存用户名
          if (shouldAskUsername && username) {
            credentials.username = username;
          }
          localStorage.setItem('rememberedCredentials', JSON.stringify(credentials));
        } else {
          // 如果不记住密码，清除已存储的信息
          localStorage.removeItem('rememberedCredentials');
        }

        const redirect = searchParams.get('redirect') || '/';
        window.location.replace(redirect);
      } else {
        // 登录失败，重置Turnstile
        if (siteConfig?.LoginRequireTurnstile && turnstileWidgetId !== null && (window as any).turnstile) {
          (window as any).turnstile.reset(turnstileWidgetId);
          setTurnstileToken(null);
        }

        if (res.status === 401) {
          setError('密码错误');
        } else {
          const data = await res.json().catch(() => ({}));
          setError(data.error ?? '服务器错误');
        }
      }
    } catch (error) {
      // 网络错误，重置Turnstile
      if (siteConfig?.LoginRequireTurnstile && turnstileWidgetId !== null && (window as any).turnstile) {
        (window as any).turnstile.reset(turnstileWidgetId);
        setTurnstileToken(null);
      }
      setError('网络错误，请稍后重试');
    } finally {
      setLoading(false);
    }
  };

  const handleTelegramLogin = async () => {
    setError(null);
    setTelegramLoginHint(null);

    try {
      setTelegramLoginLoading(true);
      const createRes = await fetch('/api/telegram/login/create', { method: 'POST' });
      const createData = await createRes.json().catch(() => ({}));
      if (!createRes.ok) {
        const configDetail = createData.config
          ? `（enabled=${String(createData.config.enabled)}, loginEnabled=${String(createData.config.loginEnabled)}, hasBotToken=${String(createData.config.hasBotToken)}, hasBotUsername=${String(createData.config.hasBotUsername)}, botUsername=${createData.config.botUsername || '-'}）`
          : `（HTTP ${createRes.status}）`;
        setError(`${createData.error || 'Telegram 登录接口不可用'}${configDetail}`);
        return;
      }

      setTelegramLoginHint('请在 Telegram 中确认登录');
      window.open(createData.deepLink, '_blank', 'noopener,noreferrer');

      const startedAt = Date.now();
      const timer = window.setInterval(async () => {
        if (Date.now() - startedAt > 5 * 60 * 1000) {
          window.clearInterval(timer);
          setTelegramLoginLoading(false);
          setTelegramLoginHint(null);
          setError('Telegram 登录已超时，请重试');
          return;
        }

        const statusRes = await fetch(`/api/telegram/login/status?token=${encodeURIComponent(createData.token)}`);
        const statusData = await statusRes.json().catch(() => ({}));
        if (statusData.status === 'confirmed') {
          window.clearInterval(timer);
          const redirect = searchParams.get('redirect') || '/';
          window.location.replace(redirect);
        } else if (statusData.status === 'denied') {
          window.clearInterval(timer);
          setTelegramLoginLoading(false);
          setTelegramLoginHint(null);
          setError('已拒绝 Telegram 登录');
        } else if (statusData.status === 'expired') {
          window.clearInterval(timer);
          setTelegramLoginLoading(false);
          setTelegramLoginHint(null);
          setError('Telegram 登录已过期');
        }
      }, 2000);
    } catch (error) {
      setError('Telegram 登录请求失败，请稍后重试');
      setTelegramLoginLoading(false);
      setTelegramLoginHint(null);
    }
  };




  return (
    <div
      className='ptv-auth relative min-h-screen flex items-center justify-center px-4 overflow-hidden'
      style={backgroundImage ? {
        backgroundImage: `url(${backgroundImage})`,
        backgroundSize: 'cover',
        backgroundPosition: 'center',
        backgroundRepeat: 'no-repeat'
      } : undefined}
      data-has-bg={backgroundImage ? 'true' : undefined}
    >
      <div className='absolute top-4 right-4 z-20'>
        <ThemeToggle />
      </div>
      <div className='ptv-auth-panel ptv-login-panel z-10 w-full max-w-md'>
        <div className='ptv-login-brand'>
          <Image src='/favicon.ico' alt='' width={44} height={44} unoptimized priority />
          <p className='ptv-login-eyebrow'>SIGN IN</p>
          <h1>{siteName}</h1>
          <p className='ptv-login-subtitle'>登录后继续你的观影进度</p>
        </div>
        <form onSubmit={handleSubmit} className='ptv-login-form'>
          {shouldAskUsername && (
            <div className='ptv-field'>
              <label htmlFor='username' className='ptv-field-label'>
                <span>01</span>用户名
              </label>
              <div className='ptv-field-control'>
                <User aria-hidden='true' />
                <input
                  id='username'
                  type='text'
                  autoComplete='username'
                  placeholder='输入用户名'
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                />
              </div>
            </div>
          )}

          <div className='ptv-field'>
            <label htmlFor='password' className='ptv-field-label'>
              <span>{shouldAskUsername ? '02' : '01'}</span>密码
            </label>
            <div className='ptv-field-control'>
              <Lock aria-hidden='true' />
              <input
                id='password'
                type={showPassword ? 'text' : 'password'}
                autoComplete='current-password'
                placeholder='输入访问密码'
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
              <button
                type='button'
                aria-label={showPassword ? '隐藏密码' : '显示密码'}
                aria-pressed={showPassword}
                className='ptv-field-toggle'
                onClick={() => setShowPassword(!showPassword)}
              >
                {showPassword ? (
                  <EyeOff className='h-5 w-5' />
                ) : (
                  <Eye className='h-5 w-5' />
                )}
              </button>
            </div>
          </div>

          {/* Cloudflare Turnstile */}
          {siteConfig?.LoginRequireTurnstile && siteConfig?.TurnstileSiteKey && (
            <div id='turnstile-container' className='flex justify-center'></div>
          )}

          {error && (
            <p role='alert' className='ptv-login-error'>
              <AlertCircle className='mt-0.5 h-4 w-4 shrink-0' aria-hidden='true' />
              <span>{error}</span>
            </p>
          )}

          {/* 记住密码开关 */}
          <label htmlFor='remember-password' className='ptv-switch'>
            <input
              id='remember-password'
              type='checkbox'
              role='switch'
              checked={rememberPassword}
              onChange={(e) => setRememberPassword(e.target.checked)}
            />
            <span className='ptv-switch-track' aria-hidden='true' />
            记住密码
          </label>

          {/* 登录按钮 */}
          <button
            type='submit'
            disabled={
              !password || loading || (shouldAskUsername && !username) ||
              (siteConfig?.LoginRequireTurnstile && !turnstileToken)
            }
            className='ptv-login-submit'
          >
            {loading ? (
              <>
                <span className='ptv-login-spinner' aria-hidden='true' />
                登录中...
              </>
            ) : (
              <>
                登录
                <ArrowRight className='h-5 w-5' aria-hidden='true' />
              </>
            )}
          </button>

          {/* 注册按钮 */}
          {siteConfig?.EnableRegistration && shouldAskUsername && (
            <div className='text-center'>
              <button
                type='button'
                onClick={() => router.push('/register')}
                className='ptv-login-link'
              >
                还没有账号？立即注册
              </button>
            </div>
          )}
        </form>

        {/* 第三方登录区域 */}
        {shouldAskUsername && (telegramLoginEnabled || siteConfig?.EnableOIDCLogin) && (
          <div>
            <div className='ptv-login-divider'>或</div>
            <div className='space-y-3'>
              {/* Telegram登录按钮 */}
              {telegramLoginEnabled && (
                <button
                  type='button'
                  disabled={telegramLoginLoading}
                  onClick={handleTelegramLogin}
                  className='ptv-login-alt'
                >
                  <Send className='h-5 w-5' aria-hidden='true' />
                  {telegramLoginLoading ? '等待 Telegram 确认...' : '使用 Telegram 登录'}
                </button>
              )}
              {telegramLoginHint && (
                <p className='ptv-login-subtitle text-center'>
                  {telegramLoginHint}
                </p>
              )}
              {/* OIDC登录按钮 */}
              {siteConfig?.EnableOIDCLogin && (
                <button
                  type='button'
                  onClick={() => window.location.href = '/api/auth/oidc/login'}
                  className='ptv-login-alt'
                >
                  {getOIDCProviderIcon(siteConfig?.OIDCButtonText || '')}
                  {siteConfig?.OIDCButtonText || '使用OIDC登录'}
                </button>
              )}
            </div>
          </div>
        )}
      </div>

      {/* 版本信息显示 */}
      <VersionDisplay />
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={<div>Loading...</div>}>
      <LoginPageClient />
    </Suspense>
  );
}
