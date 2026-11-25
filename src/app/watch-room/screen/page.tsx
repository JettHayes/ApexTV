'use client';

import { Info, LogOut, MessageCircle, Mic, Monitor, MonitorPlay, Send, Settings2, Users } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useRef, useState } from 'react';

import PageLayout from '@/components/PageLayout';
import Toast, { ToastProps } from '@/components/Toast';
import { useWatchRoomContext } from '@/components/WatchRoomProvider';
import { screenShareQualityOptions, type ScreenShareQualityPreset, useScreenShare } from '@/hooks/useScreenShare';

const NEW_TAB_KEY_PREFIX = 'watch_room_screen_home_opened_';
const WATCH_ROOM_NO_CONNECT_KEY = 'watch_room_no_connect';
const WATCH_ROOM_NO_CONNECT_TIMESTAMP_KEY = 'watch_room_no_connect_timestamp';
const WATCH_ROOM_NO_CONNECT_TTL_MS = 10 * 60 * 1000;
const SCREEN_SHARE_QUALITY_KEY = 'watch_room_screen_quality';

function getScreenShareHostSupportError() {
  if (typeof window === 'undefined') return null;

  if (!window.isSecureContext) {
    return '当前环境不是安全上下文（HTTPS/localhost），不支持屏幕共享';
  }

  if (!navigator.mediaDevices?.getDisplayMedia) {
    return '当前浏览器不支持屏幕共享';
  }

  if (typeof window.RTCPeerConnection === 'undefined') {
    return '当前浏览器不支持实时屏幕传输';
  }

  return null;
}

function getScreenShareViewerSupportError() {
  if (typeof window === 'undefined') return null;

  if (typeof window.RTCPeerConnection === 'undefined') {
    return '当前浏览器不支持实时屏幕传输';
  }

  return null;
}

export default function WatchRoomScreenPage() {
  const router = useRouter();
  const watchRoom = useWatchRoomContext();
  const { currentRoom, members, leaveRoom } = watchRoom;
  const [toast, setToast] = useState<ToastProps | null>(null);
  const [chatDraft, setChatDraft] = useState('');
  const chatEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => { const panel = chatEndRef.current?.parentElement; if (panel) panel.scrollTop = panel.scrollHeight; }, [watchRoom.chatMessages.length]);
  const [qualityPreset, setQualityPreset] = useState<ScreenShareQualityPreset>('smooth');
  const {
    currentRoom: screenRoom,
    isOwner,
    isSharing,
    isStarting,
    error,
    captureSettings,
    localVideoRef,
    remoteVideoRef,
    startSharing,
    stopSharing,
  } = useScreenShare(qualityPreset);

  const showToast = (message: string, type: ToastProps['type'] = 'info') => {
    setToast({
      message,
      type,
      duration: 3000,
      onClose: () => setToast(null),
    });
  };

  const openDetachedPage = useCallback(() => {
    window.open('/', '_blank', 'noopener,noreferrer');
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    const saved = window.localStorage.getItem(SCREEN_SHARE_QUALITY_KEY);
    if (saved === 'smooth' || saved === 'hd' || saved === 'ultra') {
      setQualityPreset(saved);
    }
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    window.localStorage.setItem(SCREEN_SHARE_QUALITY_KEY, qualityPreset);
  }, [qualityPreset]);

  useEffect(() => {
    if (!currentRoom) {
      router.replace('/watch-room');
      return;
    }

    if (currentRoom.roomType !== 'screen') {
      router.replace('/watch-room');
    }
  }, [currentRoom, router]);

  useEffect(() => {
    if (!screenRoom || screenRoom.roomType !== 'screen') return;

    const supportError = isOwner
      ? getScreenShareHostSupportError()
      : getScreenShareViewerSupportError();
    if (supportError) {
      showToast(`当前设备无法使用屏幕共享房间：${supportError}`, 'error');
      leaveRoom();
      router.replace('/watch-room');
    }
  }, [isOwner, leaveRoom, router, screenRoom?.id, screenRoom?.roomType]);

  useEffect(() => {
    if (!screenRoom || !isOwner) return;

    localStorage.setItem(WATCH_ROOM_NO_CONNECT_KEY, '1');
    localStorage.setItem(WATCH_ROOM_NO_CONNECT_TIMESTAMP_KEY, String(Date.now()));
    const heartbeat = window.setInterval(() => {
      localStorage.setItem(WATCH_ROOM_NO_CONNECT_TIMESTAMP_KEY, String(Date.now()));
    }, 30_000);
    const key = `${NEW_TAB_KEY_PREFIX}${screenRoom.id}`;
    if (!sessionStorage.getItem(key)) {
      sessionStorage.setItem(key, '1');
      openDetachedPage();
    }

    return () => {
      localStorage.removeItem(WATCH_ROOM_NO_CONNECT_KEY);
      localStorage.removeItem(WATCH_ROOM_NO_CONNECT_TIMESTAMP_KEY);
      window.clearInterval(heartbeat);
    };
  }, [isOwner, openDetachedPage, screenRoom?.id]);

  if (!screenRoom || screenRoom.roomType !== 'screen') {
    return null;
  }

  const handleLeave = () => {
    if (isOwner && isSharing) {
      stopSharing(true);
    }
    leaveRoom();
    router.push('/watch-room');
  };

  const captureSettingsText = captureSettings
    ? [
        captureSettings.width && captureSettings.height
          ? `${captureSettings.width}x${captureSettings.height}`
          : '分辨率未知',
        captureSettings.frameRate ? `${Math.round(captureSettings.frameRate)} fps` : '帧率未知',
      ].join(' / ')
    : '未开始';


  return (
    <PageLayout activePath='/watch-room'>
      <div className='f1-room-screen f1-screen-reference'>
        <div className='f1-screen-workspace'>
          <aside className='f1-screen-navigation' aria-label='观影室导航'>
            <Link href='/watch-room'><Users size={18} />观影室大厅</Link>
            <a href='#screen-overview' aria-current='location'><MonitorPlay size={18} />当前观影室</a>
            <a href='#screen-controls'><Settings2 size={18} />共享控制</a>
            <a href='#screen-members'><Users size={18} />房间成员</a>
            <a href='#screen-chat'><MessageCircle size={18} />房间聊天</a>
            <div><Monitor size={16} /><strong>{screenRoom.name}</strong><span>{isSharing ? '正在屏幕共享' : '等待开始共享'}</span></div>
          </aside>
          <main className='f1-screen-main'>
            <header className='f1-screen-heading' id='screen-overview'>
              <span className='f1-screen-room-icon'><MonitorPlay size={26} /></span>
              <div className='f1-screen-room-name'><h1>{screenRoom.name}</h1><div><span>ID：{screenRoom.id}</span><span>{screenRoom.isPublic ? '公开房间' : '私密房间'}</span><span>{members.length} 人</span></div></div>
              <div className='f1-screen-heading-actions'>
                {isOwner && <Link href='/' target='_blank' rel='noreferrer' onClick={(event) => { event.preventDefault(); openDetachedPage(); }}>新开主页</Link>}
                <button type='button' onClick={handleLeave}><LogOut size={15} />离开房间</button>
              </div>
            </header>

            <div className='f1-screen-status' role='status'>
              <Monitor size={21} /><div><strong>{isSharing ? '正在屏幕共享' : '屏幕共享尚未开始'}</strong><span>房主：{screenRoom.ownerName}</span></div>
              {isOwner && <span className='f1-screen-capture'>实际采集：{captureSettingsText}</span>}
              <span className='f1-screen-connection' data-connected={watchRoom.isConnected}>{watchRoom.isConnected ? '房间已连接' : '连接中断'}</span>
              {watchRoom.reconnectFailed && <button type='button' onClick={() => { void watchRoom.manualReconnect().catch(() => showToast('重新连接失败，请稍后重试', 'error')); }}>重新连接</button>}
            </div>

            <div className='f1-screen-stage-grid'>
              <div className='f1-screen-stage'>
                <div className='f1-screen-video-heading'><span><i />共享画面{isOwner ? '（本机预览）' : ''}</span>{captureSettings && <span>{captureSettingsText}</span>}</div>
                <div className='f1-screen-video'>
                  {isOwner ? <video ref={localVideoRef} autoPlay muted playsInline controls /> : <video ref={remoteVideoRef} autoPlay playsInline controls />}
                  {!isSharing && <div className='f1-screen-waiting'><MonitorPlay size={42} /><h2>{isOwner ? '开始共享你的画面' : '等待房主开始共享'}</h2><p>{isOwner ? '选择浏览器标签页、窗口或整个屏幕。' : '房主开始共享后，画面会自动显示在这里。'}</p>{isOwner && <small>本页不要关闭；已尝试为你新开一个主页标签页方便继续浏览。</small>}</div>}
                </div>
              </div>
              <section className='f1-screen-members' id='screen-members'>
                <h2><Users size={17} />成员列表 <span>{members.length} 人</span></h2>
                <ul>{members.map((member) => <li key={member.id}>
                  <span className='f1-screen-avatar' aria-hidden='true'>{member.name.trim().charAt(0).toUpperCase() || '用'}</span>
                  <div><strong>{member.name}</strong><small>{member.isOwner ? '房主' : '房员'}</small></div>
                  {member.isOwner && <span className='f1-screen-owner-badge'>房主</span>}
                </li>)}</ul>
              </section>
            </div>

            <section className='f1-screen-controls' id='screen-controls' aria-label='屏幕共享控制'>
              <div className='f1-screen-controls-label'><Monitor size={18} /><span>屏幕共享控制<small>{isOwner ? '仅房主可操作' : '跟随房主共享'}</small></span></div>
              {isOwner ? <>
                <button type='button' className='f1-screen-start' onClick={() => startSharing()} disabled={isStarting || isSharing}>{isStarting ? '启动中…' : isSharing ? '共享中' : '开始共享'}</button>
                <button type='button' className='f1-screen-stop' onClick={() => stopSharing(true)} disabled={!isSharing}>停止屏幕共享</button>
                <label><span>共享画质</span><select value={qualityPreset} onChange={(event) => setQualityPreset(event.target.value as ScreenShareQualityPreset)} disabled={isStarting || isSharing}>{screenShareQualityOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</select></label>
              </> : <p>房员无需操作，房主开始共享后会自动显示画面。</p>}
              <button type='button' className='f1-screen-room-tools' onClick={() => window.dispatchEvent(new Event('apex-open-room-tools'))}><Mic size={16} />语音与房间工具</button>
              {error && <p className='f1-screen-error' role='alert'>{error}</p>}
              {isOwner && <p className='f1-screen-controls-help'>画质越高越清晰，但更依赖网络和设备性能。共享开始后不可切换。</p>}
            </section>

            <div className='f1-screen-bottom-grid'>
              <section className='f1-screen-chat' id='screen-chat'>
                <header><h2><MessageCircle size={16} />聊天</h2><button type='button' onClick={() => window.dispatchEvent(new Event('apex-open-room-tools'))}><Mic size={14} />语音工具</button></header>
                <div className='f1-screen-chat-messages' aria-live='polite'>
                  {watchRoom.chatMessages.length ? watchRoom.chatMessages.map((message) => <article key={message.id}>
                    <span className='f1-screen-avatar' aria-hidden='true'>{message.userName.trim().charAt(0).toUpperCase() || '用'}</span>
                    <div><header><strong>{message.userName}</strong><time>{new Date(message.timestamp).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })}</time></header><p>{message.content}</p></div>
                  </article>) : <p className='f1-screen-chat-empty'>还没有消息，和房间成员打个招呼吧。</p>}
                  <div ref={chatEndRef} />
                </div>
                <form onSubmit={(event) => { event.preventDefault(); const text = chatDraft.trim(); if (!text || !watchRoom.isConnected) return; watchRoom.sendChatMessage(text, 'text'); setChatDraft(''); }}>
                  <input value={chatDraft} onChange={(event) => setChatDraft(event.target.value)} placeholder='发送消息…' aria-label='房间聊天消息' maxLength={500} disabled={!watchRoom.isConnected} />
                  <button type='submit' aria-label='发送房间消息' disabled={!chatDraft.trim() || !watchRoom.isConnected}><Send size={17} /></button>
                </form>
              </section>
              <section className='f1-screen-room-info' id='screen-room-info'>
                <h2><Info size={16} />房间信息</h2>
                <dl><div><dt>房间类型</dt><dd>观影室 · 屏幕共享</dd></div><div><dt>房主</dt><dd>{screenRoom.ownerName}</dd></div><div><dt>创建时间</dt><dd>{new Date(screenRoom.createdAt).toLocaleString('zh-CN')}</dd></div>{screenRoom.description && <div><dt>房间说明</dt><dd>{screenRoom.description}</dd></div>}</dl>
                <p>建议使用桌面版 Chrome / Edge，并优先共享标签页。</p>
              </section>
            </div>
          </main>
        </div>
        {toast && <Toast {...toast} />}
      </div>
    </PageLayout>
  );
}
