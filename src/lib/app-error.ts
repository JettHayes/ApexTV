/* Shared, browser/server-safe error descriptions. Never log raw response bodies or credentials. */
export interface AppErrorInfo {
  code: string;
  context: string;
  message: string;
  reason: string;
  hint: string;
  status?: number;
  upstreamStatus?: number;
  originalCode?: string;
  details?: string;
  cancelled?: boolean;
}

type ErrorRecord = Record<string, unknown>;
const record = (value: unknown): ErrorRecord => value && typeof value === 'object' ? value as ErrorRecord : {};
const numericStatus = (value: unknown): number | undefined => {
  const number = Number(value);
  return Number.isInteger(number) && number >= 400 && number <= 599 ? number : undefined;
};

export function redactErrorText(value: unknown): string {
  return String(value ?? '')
    .replace(/\b(Cookie|Set-Cookie|Authorization)\s*:\s*[^\r\n]*/gi, '$1: [已隐藏]')
    .replace(/Bearer\s+[^\s,;]+/gi, 'Bearer [已隐藏]')
    .replace(/("(?:api[_-]?key|access[_-]?token|refresh[_-]?token|owner[_-]?token|client[_-]?secret|secret|password|credential|token|session(?:[_-]?id)?|cookie|authorization|sign(?:ature)?|密钥|令牌)"\s*:\s*)("(?:\\.|[^"\\])*"|[^,}\s]+)/gi, '$1"[已隐藏]"')
    .replace(/((?:api[_-]?key|access[_-]?token|refresh[_-]?token|owner[_-]?token|client[_-]?secret|secret|password|credential|token|session(?:[_-]?id)?|cookie|authorization|sign(?:ature)?|签名|密钥|令牌)\s*[:=]\s*)[^\s,;&]+/gi, '$1[已隐藏]')
    .replace(/\beyJ[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\b/g, '[JWT已隐藏]')
    .replace(/https?:\/\/[^\s<>"']+/gi, '[地址已隐藏]')
    .replace(/<[^>]*>/g, '')
    .slice(0, 600);
}

const httpReasons: Record<number, [string, string]> = {
  400: ['请求参数不符合接口要求', '请检查填写内容或重新打开该页面。'],
  401: ['当前请求未通过身份验证', '请重新登录；若问题来自上游服务，请检查对应服务的授权配置。'],
  403: ['服务拒绝了当前访问', '请检查账户权限或上游访问限制；仅凭此状态不能确定是否为链接过期。'],
  404: ['请求的接口或资源不存在', '资源可能已移除或地址发生变化，请刷新列表、检查源地址或切换来源。'],
  405: ['接口不接受当前请求方式', '请刷新页面；持续出现时需检查接口与部署版本是否一致。'],
  408: ['服务等待请求超时', '请稍后重试，或切换网络与来源。'],
  409: ['当前数据状态与操作发生冲突', '请刷新最新数据后重新操作，避免覆盖其他修改。'],
  410: ['请求的资源已被移除', '请更新列表或选择其他来源。'],
  413: ['提交的内容超过服务大小限制', '请缩小文件或分批提交。'],
  415: ['服务不支持当前内容或媒体格式', '请换用支持的文件格式或播放协议。'],
  422: ['提交内容未通过校验', '请检查必填项、字段格式和选项值。'],
  428: ['操作缺少所需的前置条件或配置版本', '请刷新最新配置后重新操作。'],
  429: ['请求过于频繁或服务配额已用尽', '请稍后重试；持续出现时检查服务配额。'],
  500: ['服务处理请求时发生内部异常', '请稍后重试；管理员可根据错误代码检查服务端日志。'],
  502: ['本站未能从上游服务获得有效响应', '请稍后重试或检查对应来源的连接与配置。'],
  503: ['服务暂时不可用或受到访问限制', '请稍后重试；持续出现时检查服务状态。'],
  504: ['网关等待上游服务响应超时', '请稍后重试或更换响应更快的来源。'],
};

export function isRequestCancelled(error: unknown): boolean {
  const item = record(error);
  const timeout = /timeout|timed out|超时|ETIMEDOUT/i.test([item.message, item.code, record(item.cause).code].join(' '));
  return !timeout && (item.name === 'AbortError' || item.code === 'ERR_CANCELED' || item.cancelled === true);
}

export function normalizeAppError(error: unknown, context = '操作'): AppErrorInfo {
  context = redactErrorText(context);
  if (error instanceof AppRequestError) return { ...error.info, context: context === '操作' ? error.info.context : context };
  const outer = record(error);
  const inner = record(outer.error);
  const cause = record(outer.cause);
  const item: ErrorRecord = { ...cause, ...inner, ...outer, message: outer.message ?? inner.message, name: outer.name ?? inner.name };
  const raw = typeof error === 'string' ? error : String(item.message || (typeof item.error === 'string' ? item.error : inner.message) || '');
  const details = redactErrorText([raw, item.details, item.name, cause.code].filter(Boolean).join(' · ') || '未提供底层错误信息');
  const upstreamStatus = numericStatus(item.upstreamStatus);
  const status = numericStatus(item.status) || numericStatus(item.statusCode) || numericStatus(item.httpStatus);
  const embeddedStatus = raw.match(/(?:HTTP(?:错误)?|状态码|请求失败|status(?: code)?|returned)\s*[:：(]?\s*([45]\d{2})\b/i)?.[1];
  const effectiveStatus = upstreamStatus || status || numericStatus(embeddedStatus);
  const suppliedCode = String(item.code ?? raw.match(/（([A-Z][A-Z0-9_]{2,70})(?:[ /）])/)?.[1] ?? raw.match(/\bcode\s*[:：=]\s*([A-Za-z0-9_-]{1,40})/i)?.[1] ?? '').trim();
  let code = /^[A-Za-z][A-Za-z0-9_.:-]{0,69}$/.test(suppliedCode) ? suppliedCode : /^-?\d{1,12}$/.test(suppliedCode) ? 'BUSINESS_' + suppliedCode : effectiveStatus ? 'HTTP_' + effectiveStatus : 'UNKNOWN_ERROR';
  let reason = '操作未能完成，当前信息不足以确定具体原因';
  let hint = '可以重试；若持续出现，请展开技术详情并联系管理员。';
  if (code.startsWith('BUSINESS_')) reason = '接口报告业务处理失败（业务码 ' + suppliedCode + '）';
  const text = [raw, item.name, suppliedCode, item.details, cause.code].join(' ');
  if (/Loading chunk|ChunkLoadError|dynamically imported module|Failed to fetch dynamically/i.test(text)) {
    code = 'PAGE_ASSET_LOAD_FAILED'; reason = '页面所需的脚本或样式资源未能加载'; hint = '请刷新页面；若持续出现，请检查部署产物与浏览器缓存是否一致。';
  } else if (/Cannot read propert|is not a function|is not defined|Minified React error|Server Components render|Hydration/i.test(text)) {
    code = 'CLIENT_RUNTIME_ERROR'; reason = '页面代码执行发生异常，当前操作未能完成'; hint = '请重试；持续出现时将错误代码提供给管理员排查。';
  }
  if (isRequestCancelled(error)) {
    return { code: 'REQUEST_CANCELLED', context, message: '请求已取消', reason: '当前请求已主动取消', hint: '无需处理。', cancelled: true };
  }
  if (effectiveStatus) {
    [reason, hint] = httpReasons[effectiveStatus] || ['服务返回异常状态（' + effectiveStatus + '）', '请重试，并根据该状态检查服务或来源。'];
    if (upstreamStatus) reason = '上游' + reason;
  } else if (/timeout|timed out|ETIMEDOUT|ECONNABORTED|TimeoutError|超时/i.test(text)) {
    code = 'REQUEST_TIMEOUT'; reason = '等待服务响应超时'; hint = '请稍后重试，或更换网络和来源。';
  } else if (/ENOTFOUND|EAI_AGAIN|getaddrinfo|no such host/i.test(text)) {
    code = 'DNS_LOOKUP_FAILED'; reason = '服务器无法解析目标服务的域名'; hint = '请检查服务地址与服务器 DNS 配置。';
  } else if (/ECONNREFUSED/i.test(text)) {
    code = 'CONNECTION_REFUSED'; reason = '目标服务拒绝建立连接'; hint = '请检查目标服务是否启动，以及地址和端口是否正确。';
  } else if (/ECONNRESET|socket hang up|connection.*closed/i.test(text)) {
    code = 'CONNECTION_INTERRUPTED'; reason = '连接在完成请求前中断'; hint = '请重试；若频繁发生，请检查上游服务和网络。';
  } else if (/certificate|CERT_|TLS|SSL/i.test(text)) {
    code = 'TLS_CONNECTION_FAILED'; reason = '安全连接或证书验证失败'; hint = '请检查服务证书及服务器时间，不要关闭证书验证。';
  } else if (/UNIQUE constraint failed|SQLITE_CONSTRAINT_UNIQUE|constraint failed.*2067/i.test(text)) {
    code = 'DATABASE_CONFLICT'; reason = '当前数据与已有记录发生唯一性冲突'; hint = '请检查是否已添加相同记录，或刷新后重试。';
  } else if (/QuotaExceededError|ENOSPC|disk.*full/i.test(text)) {
    code = 'STORAGE_FULL'; reason = '当前设备或服务的可用存储空间不足'; hint = '请检查对应设备或服务的剩余空间与存储配额。';
  } else if (/ENOENT/i.test(text)) {
    code = 'FILE_NOT_FOUND'; reason = '操作所需的文件不存在'; hint = '请检查文件是否已移除，以及服务端路径配置是否正确。';
  } else if (/st invalid|token.*expired|invalid.*token|refresh token expired/i.test(text)) {
    code = 'UPSTREAM_AUTH_INVALID'; reason = '上游服务报告登录凭据无效或已过期'; hint = '请更新对应服务的授权信息后重试。';
  } else if (/JSON|Unexpected token|Unexpected end|SyntaxError/i.test(text)) {
    code = 'INVALID_RESPONSE'; reason = '服务返回内容无法按预期格式解析'; hint = '可能返回了错误页面或接口格式发生变化，请检查来源和部署版本。';
  } else if (/NotAllowedError|PermissionDeniedError/i.test(text)) {
    code = 'BROWSER_PERMISSION_DENIED'; reason = '浏览器未允许当前操作'; hint = '播放可能需要先点击页面；设备访问请检查相应权限。';
  } else if (/NotSupportedError|MEDIA_ERR_SRC_NOT_SUPPORTED/i.test(text)) {
    code = 'MEDIA_NOT_SUPPORTED'; reason = '当前浏览器不支持该媒体格式或操作'; hint = '请更换播放协议、线路或浏览器。';
  } else if (/MEDIA_ERR_DECODE|decode.*error/i.test(text)) {
    code = 'MEDIA_DECODE_FAILED'; reason = '浏览器无法解码当前媒体内容'; hint = '请切换格式或线路，也可尝试外部播放器。';
  } else if (/Failed to fetch|fetch failed|NetworkError|Load failed|network request failed/i.test(text)) {
    code = 'NETWORK_ERROR'; reason = '未能与服务完成通信，具体原因尚未确认'; hint = '请检查连接后重试；仅凭此错误无法区分断网、跨域或服务不可达。';
  }
  const chinese = /[\u4e00-\u9fff]/.test(raw);
  // A source-specific Chinese description is more precise than a generic status summary.
  if (chinese && !/<(?:html|!doctype)/i.test(raw)) {
    reason = redactErrorText(raw).replace(/^\[[A-Z0-9_ /:-]+\]\s*/, '');
    if (code === 'UNKNOWN_ERROR') code = 'OPERATION_FAILED';
  }
  const original = String(item.originalCode ?? suppliedCode);
  const originalCode = original !== code && /^[A-Za-z0-9_.:-]{1,70}$/.test(original) ? original : undefined;
  const suppliedHint = typeof item.hint === 'string' && /[\u4e00-\u9fff]/.test(item.hint) ? redactErrorText(item.hint) : undefined;
  return { code, context, message: reason, reason, hint: suppliedHint || hint, status: status || numericStatus(embeddedStatus), upstreamStatus, originalCode, details };
}

export class AppRequestError extends Error {
  readonly info: AppErrorInfo;
  readonly code: string;
  readonly status?: number;
  readonly upstreamStatus?: number;
  constructor(error: unknown, context = '请求') {
    const info = normalizeAppError(error, context);
    super(info.message);
    this.name = 'AppRequestError';
    this.info = info;
    this.code = info.code;
    this.status = info.status;
    this.upstreamStatus = info.upstreamStatus;
    Object.setPrototypeOf(this, AppRequestError.prototype);
  }
}

export function formatAppError(error: unknown, context = '操作'): string {
  if (typeof error === 'string' && /失败：.+（[^）]*[A-Z_][^）]*）/.test(error)) return redactErrorText(error);
  const info = normalizeAppError(error, context);
  if (info.cancelled) return '';
  const codes = [info.code, info.status ? 'HTTP ' + info.status : '', info.upstreamStatus ? '上游 HTTP ' + info.upstreamStatus : '', info.originalCode ? '原始代码 ' + info.originalCode : ''].filter(Boolean);
  return info.context + '失败：' + info.reason + '（' + Array.from(new Set(codes)).join(' / ') + '）。' + info.hint;
}

const recentlyReported = new Map<string, number>();
export function reportAppError(error: unknown, context = '操作', options?: { level?: 'warn' | 'error' }): AppErrorInfo {
  const info = normalizeAppError(error, context);
  if (info.cancelled) return info;
  const key = info.context + ':' + info.code + ':' + info.reason;
  const now = Date.now();
  if (now - (recentlyReported.get(key) || 0) < 5000) return info;
  if (recentlyReported.size >= 200) recentlyReported.clear();
  recentlyReported.set(key, now);
  console[options?.level || (info.status && info.status < 500 ? 'warn' : 'error')]('[ApexTV][' + info.context + '][' + info.code + '] ' + info.reason, {
    操作: info.context, 错误代码: info.code, 本站状态码: info.status,
    上游状态码: info.upstreamStatus, 原始代码: info.originalCode, 原因: info.reason, 处理建议: info.hint, 技术详情: info.details,
  });
  return info;
}

function responseContext(response: Response, context: string): string {
  if (!['请求', '电视端', '管理设置', '内容操作', '数据同步'].includes(context) || !response.url) return context;
  const admin: Record<string, string> = { config:'配置读取', site:'站点配置', user:'用户管理', users:'用户管理', 'user-devices':'设备管理', source:'视频源配置', 'source-script':'视频源脚本', category:'分类配置', live:'电视直播配置', 'web-live':'网络直播配置', openlist:'OpenList 配置', emby:'Emby 配置', xiaoya:'小雅配置', ai:'AI 配置', music:'音乐配置', opds:'电子书配置', suwayomi:'漫画配置', theme:'个性化配置', email:'邮件配置', telegram:'Telegram 配置', 'data_migration':'数据迁移', 'config_file':'配置文件', 'config_subscription':'配置订阅', 'anime-subscription':'追番订阅', netdisk:'网盘配置', reload:'重载配置', reset:'重置配置' };
  const services: Record<string, string> = { search:'影视搜索', 'source-detail':'视频详情', live:'电视直播', emby:'Emby 媒体库', openlist:'OpenList 媒体库', books:'电子书', manga:'漫画', favorites:'收藏', playrecords:'播放记录', 'personal-library':'观看计划', 'auth':'登录验证' };
  try { const parts = new URL(response.url).pathname.split('/'); const label = parts[2] === 'admin' ? admin[parts[3]] : services[parts[2]]; return label ? context + ' · ' + label : context; } catch { return context; }
}

export async function readJsonResponse<T = unknown>(response: Response, context = '请求'): Promise<T> {
  context = responseContext(response, context);
  let text: string;
  try { text = await response.text(); } catch (cause) { throw new AppRequestError({ status: response.ok ? undefined : response.status, code: 'RESPONSE_READ_FAILED', message: '读取服务响应时连接中断', details: record(cause).message }, context); }
  let data: unknown;
  try { data = text ? JSON.parse(text) : undefined; }
  catch {
    throw new AppRequestError({ status: response.ok ? undefined : response.status, code: response.ok ? 'INVALID_RESPONSE' : 'HTTP_' + response.status, message: response.ok ? '服务返回的内容不是有效 JSON 数据' : '', details: '响应类型：' + (response.headers.get('content-type') || '未知') }, context);
  }
  const payload = record(data);
  const error = record(payload.error);
  if (!response.ok || payload.success === false || payload.ok === false || numericStatus(payload.code) || (payload.error && payload.data === undefined && payload.list === undefined && payload.results === undefined)) {
    throw new AppRequestError({ ...payload, ...error, status: response.ok ? undefined : response.status, code: error.code ?? payload.code, message: error.message || (typeof payload.error === 'string' ? payload.error : payload.message) || '', upstreamStatus: payload.upstreamStatus || error.upstreamStatus, details: error.details || payload.details }, context);
  }
  if (data === undefined) throw new AppRequestError({ code: 'EMPTY_RESPONSE', message: '服务未返回预期的数据' }, context);
  return data as T;
}

export async function requestJson<T = unknown>(url: string, init?: RequestInit, context = '请求'): Promise<T> {
  try { return await readJsonResponse<T>(await fetch(url, init), context); }
  catch (error) { if (isRequestCancelled(error)) throw error; throw error instanceof AppRequestError ? error : new AppRequestError(error, context); }
}

/** Safe API error envelope; transport status and upstream status remain separate. */
export function appErrorPayload(error: unknown, context = '服务请求', status = 500) {
  const info = normalizeAppError(error, context);
  return { error: info.reason, code: info.code, status, upstreamStatus: info.upstreamStatus, originalCode: info.originalCode, hint: info.hint, details: info.details };
}
