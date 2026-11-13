import { resolveSiteName } from './site-brand';

it.each([undefined, '', 'MoonTVPlus', 'PETRONAS TV', ' petronas tv ', 'ApexTV'])(
  '站点名称 %s 统一为 ApexTV',
  (name) => expect(resolveSiteName(name)).toBe('ApexTV')
);

it('保留后续手动设置的其他站点名', () => {
  expect(resolveSiteName(' 我的影库 ')).toBe('我的影库');
});
