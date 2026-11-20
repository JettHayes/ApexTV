import { notFound } from 'next/navigation';
import PersonalLibraryPage from '@/components/PersonalLibraryPage';

export default function MyPage({ params }: { params: { view: string } }) {
  if (!['favorites', 'history', 'watch-later'].includes(params.view))
    notFound();
  return <PersonalLibraryPage view={params.view} />;
}
