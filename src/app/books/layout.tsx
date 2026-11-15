import BooksLayout from '@/components/books/BooksLayout';
import './reader.css';

export default function Layout({ children }: { children: React.ReactNode }) {
  return <BooksLayout>{children}</BooksLayout>;
}
