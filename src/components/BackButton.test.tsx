import { fireEvent, render, screen } from '@testing-library/react';

import { BackButton, recordNavigation } from './BackButton';

const mockBack = jest.fn();
const mockPush = jest.fn();
jest.mock('next/navigation', () => ({ useRouter: () => ({ back: mockBack, push: mockPush }) }));

it('保留站内后退，并在返回访问起点后恢复站内兜底', () => {
  window.history.replaceState({}, '', '/entry');
  recordNavigation('/entry');
  render(<BackButton />);
  fireEvent.click(screen.getByRole('button', { name: '返回' }));
  expect(mockPush).toHaveBeenLastCalledWith('/');

  window.history.pushState({}, '', '/search?q=test');
  recordNavigation('/search');
  window.history.pushState({}, '', '/play?id=1');
  recordNavigation('/play');
  fireEvent.click(screen.getByRole('button', { name: '返回' }));
  expect(mockBack).toHaveBeenCalledTimes(1);

  window.history.replaceState({}, '', '/entry');
  window.dispatchEvent(new PopStateEvent('popstate'));
  recordNavigation('/entry');
  fireEvent.click(screen.getByRole('button', { name: '返回' }));
  expect(mockBack).toHaveBeenCalledTimes(1);
  expect(mockPush).toHaveBeenCalledTimes(2);
});
