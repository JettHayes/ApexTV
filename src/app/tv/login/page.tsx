'use client';

import { formatAppError, readJsonResponse, reportAppError } from '@/lib/app-error';


import { Loader2, Smartphone } from 'lucide-react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useCallback, useEffect, useRef, useState } from 'react';

import TVLayout from '@/components/tv/TVLayout';

type QrState = { token: string; qrUrl: string; expiresAt: number; ttl: number };

export default function TVLoginPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const redirect = searchParams.get('redirect') || '/tv';
  const [qr, setQr] = useState<QrState | null>(null);
  const [status, setStatus] = useState('正在生成二维码...');
  const [left, setLeft] = useState(0);
  const [creating, setCreating] = useState(false);
  const creatingRef = useRef(false);
  const generationRef = useRef(0);
  const createControllerRef = useRef<AbortController | null>(null);
  const pollControllerRef = useRef<AbortController | null>(null);

  const create = useCallback(async () => {
    if (creatingRef.current) return;
    creatingRef.current = true;
    setCreating(true);
    const generation = ++generationRef.current;
    pollControllerRef.current?.abort();
    const controller = new AbortController();
    createControllerRef.current = controller;
    setQr(null);
    setLeft(0);
    setStatus('正在生成二维码...');
    try {
      const res = await fetch('/api/auth/qr/create', { method: 'POST', signal: controller.signal });
      if (!res.ok) await readJsonResponse(res, "电视端");
      const data = await readJsonResponse<any>(res, "电视端");
      if (controller.signal.aborted || generation !== generationRef.current) return;
      const qrUrl = `${window.location.origin}/qr-login?token=${encodeURIComponent(data.token)}`;
      setQr({ ...data, qrUrl });
      setLeft(Math.max(0, Math.ceil((data.expiresAt - Date.now()) / 1000)));
      setStatus('请使用手机扫码登录');
    } catch (error) {
      if (!controller.signal.aborted && generation === generationRef.current) {
        setStatus(formatAppError(reportAppError(error, "电视端"), "电视端"));
      }
    } finally {
      if (generation === generationRef.current) {
        creatingRef.current = false;
        createControllerRef.current = null;
        setCreating(false);
      }
    }
  }, []);

  useEffect(() => {
    void create();
    return () => {
      generationRef.current += 1;
      createControllerRef.current?.abort();
      pollControllerRef.current?.abort();
      creatingRef.current = false;
    };
  }, [create]);

  useEffect(() => {
    if (!qr) return;
    const timer = window.setInterval(() => {
      const remaining = Math.max(0, Math.ceil((qr.expiresAt - Date.now()) / 1000));
      setLeft(remaining);
      if (remaining <= 0) {
        window.clearInterval(timer);
        void create();
      }
    }, 1000);
    return () => window.clearInterval(timer);
  }, [create, qr]);

  useEffect(() => {
    if (!qr) return;
    const generation = generationRef.current;
    const controller = new AbortController();
    pollControllerRef.current = controller;
    let polling = false;
    const timer = window.setInterval(async () => {
      if (polling) return;
      polling = true;
      try {
        const res = await fetch(`/api/auth/qr/status?token=${encodeURIComponent(qr.token)}`, { cache: 'no-store', signal: controller.signal });
        if (!res.ok) await readJsonResponse(res, '电视登录状态检查');
        const data = await readJsonResponse<any>(res, "电视端");
        if (controller.signal.aborted || generation !== generationRef.current) return;
        if (data.status === 'scanned') setStatus('已扫码，请在手机上确认');
        if (data.status === 'confirmed') {
          setStatus('登录成功，正在进入电视端');
          window.clearInterval(timer);
          router.replace(redirect);
        }
        if (data.status === 'expired') setStatus('二维码已过期，请刷新');
        if (data.status === 'cancelled') setStatus('已取消，请刷新二维码');
      } catch (error) {
        if (!controller.signal.aborted && generation === generationRef.current) setStatus(formatAppError(reportAppError(error, '电视登录状态检查'), '电视登录状态检查'));
      } finally {
        polling = false;
      }
    }, 2000);
    return () => {
      window.clearInterval(timer);
      controller.abort();
      if (pollControllerRef.current === controller) pollControllerRef.current = null;
    };
  }, [qr, redirect, router]);

  const qrImg = qr ? `/api/auth/qr/image?data=${encodeURIComponent(qr.qrUrl)}` : '';

  return (
    <TVLayout showNav={false}>
      <section className='f1-tv-login-panel'>
        <div className='f1-tv-login-title'><Smartphone /><div><h1>扫码登录</h1><p>使用手机扫描二维码，在手机上完成登录</p></div></div>
        <div className='f1-tv-login-content'>
          <div className='f1-tv-login-qr'>
            {qrImg ? <img src={qrImg} alt='扫码登录二维码' /> : <Loader2 className='animate-spin' />}
          </div>
          <ol><li>打开手机浏览器扫码</li><li>登录你的账号</li><li>在手机上确认授权</li><li>登录成功后电视端自动进入</li></ol>
          <div className='f1-tv-login-status'><strong>设备状态</strong><p>{status}</p><span>二维码有效期：{left} 秒</span>
            <button type='button' onClick={create} disabled={creating} className='tv-focusable'>重新生成</button></div>
        </div>
      </section>
    </TVLayout>
  );
}
