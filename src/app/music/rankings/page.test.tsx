import { act, cleanup, render, screen } from '@testing-library/react';
import type { ReactNode } from 'react';

import MusicRankingsPage from './page';

let mockParams = new URLSearchParams('source=wy');
const mockPush = jest.fn();

jest.mock('next/navigation', () => ({
  useRouter: () => ({ push: mockPush }),
  useSearchParams: () => mockParams,
}));
jest.mock('@/components/music/MusicPage', () => ({ __esModule: true, default: ({ children }: { children: ReactNode }) => <div>{children}</div> }));
jest.mock('@/components/music/MusicSwitch', () => ({ __esModule: true, default: () => null }));
jest.mock('@/components/music/SleeveCard', () => ({ __esModule: true, default: ({ name }: { name: string }) => <div>{name}</div> }));
jest.mock('@/components/music/MusicEmpty', () => ({
  __esModule: true,
  default: ({ title }: { title: string }) => <p>{title}</p>,
  MusicSleeveGridSkeleton: () => <p>正在加载</p>,
}));
jest.mock('@/components/music/tokens', () => ({ MUSIC_SLEEVE_GRID: 'grid' }));

const originalFetch = global.fetch;
let requests: Array<(response: Response) => void>;

beforeEach(() => {
  mockParams = new URLSearchParams('source=wy');
  requests = [];
  global.fetch = jest.fn(() => new Promise<Response>((resolve) => requests.push(resolve)));
});

afterEach(() => {
  cleanup();
  global.fetch = originalFetch;
});

function response(name: string): Response {
  return { ok: true, json: async () => ({ success: true, data: { list: [{ id: name, name }] } }) } as Response;
}

it('快速切换音源后，较晚返回的旧响应不能覆盖新榜单', async () => {
  const { rerender } = render(<MusicRankingsPage />);
  mockParams = new URLSearchParams('source=tx');
  rerender(<MusicRankingsPage />);

  await act(async () => { requests[1](response('QQ 新榜单')); });
  expect(await screen.findByText('QQ 新榜单')).toBeTruthy();
  await act(async () => { requests[0](response('网易旧榜单')); });
  expect(screen.getByText('QQ 新榜单')).toBeTruthy();
  expect(screen.queryByText('网易旧榜单')).toBeNull();
});

it('非成功响应结束加载并提供可理解的错误状态', async () => {
  render(<MusicRankingsPage />);
  await act(async () => { requests[0]({ ok: false } as Response); });
  expect(await screen.findByText('当前音源无法获取此榜单')).toBeTruthy();
  expect(screen.queryByText('正在加载')).toBeNull();
});
