import ErrorRecoveryView from '@/components/ErrorRecoveryView';
export default function NotFound() {
  return <ErrorRecoveryView error={{ status: 404, code: 'PAGE_NOT_FOUND', message: '当前页面不存在，链接可能有误或页面已移除', hint: '请检查地址，或返回首页继续浏览。' }} context='打开页面' />;
}
