'use client';

import { BackButton } from './BackButton';
import BrandLogo from './BrandLogo';
import { ThemeToggle } from './ThemeToggle';
import { UpdateNotification } from './UpdateNotification';
import { UserMenu } from './UserMenu';

const MobileHeader = ({ showBackButton = false }: { showBackButton?: boolean }) => (
  <header className='ptv-mobile-header fixed inset-x-0 top-0 z-[999] w-full border-b md:hidden' style={{ paddingTop: 'var(--safe-top)' }}>
    <div className='flex h-14 items-center gap-1 px-3'>
      {showBackButton && <BackButton />}
      <div className='min-w-0 flex-1'><BrandLogo /></div>
      <div className='flex shrink-0 items-center gap-1'>
        <ThemeToggle />
        <UserMenu />
        <UpdateNotification />
      </div>
    </div>
  </header>
);
export default MobileHeader;
