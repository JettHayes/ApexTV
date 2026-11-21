import BrandLogo from './BrandLogo';

/** 只负责账户页品牌展示，认证表单与背景配置仍由原页面管理。 */
export default function AuthBrandPanel() {
  return (
    <aside className='f1-auth-brand' aria-label='Apex TV'>
      <BrandLogo />
      <div className='f1-auth-message'>
        <span className='f1-auth-marker' aria-hidden='true' />
        <h2>每一次打开，<br />都有值得期待的内容。</h2>
        <p>从一部电影，到一首歌。<br />在这里，继续属于你的精彩。</p>
      </div>
      <div className='f1-auth-signature' aria-hidden='true'><span /><span /><span /></div>
    </aside>
  );
}
