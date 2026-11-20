export class BookSourceRequestError extends Error {
  readonly upstreamStatus: number;
  readonly code: string;
  constructor(status: number) {
    const message =
      status === 403
        ? '书源网站拒绝了服务器访问（403），可能需要验证或限制了服务器所在地区'
        : status === 429
        ? '书源网站请求过于频繁（429），请稍后再试'
        : status === 401
        ? '书源网站要求登录（401），当前规则未提供可用的登录信息'
        : status === 404
        ? '书源网站未找到该页面（404），目录地址可能已变更'
        : '书源网站返回异常状态（' + status + '）';
    super(message);
    this.name = 'BookSourceRequestError';
    this.upstreamStatus = status;
    this.code = status === 403 ? 'SOURCE_FORBIDDEN' : 'SOURCE_HTTP_ERROR';
  }
}

export class BookCatalogTargetError extends Error {
  readonly code = 'CATALOG_SOURCE_MISMATCH';
  constructor() {
    super('当前分类不属于这个书源，请重新选择分类');
    this.name = 'BookCatalogTargetError';
  }
}

export class BookRuleParseError extends Error {
  readonly code = 'SOURCE_RULE_PARSE_ERROR';
  constructor(message: string) {
    super(message);
    this.name = 'BookRuleParseError';
  }
}
