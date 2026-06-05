import type { Carrier, ServerGeo } from './types';

const PROVINCES: Record<string, { code: string; name: string; aliases: string[] }> = {
  bj: { code: 'bj', name: '北京', aliases: ['beijing', '北京'] },
  sh: { code: 'sh', name: '上海', aliases: ['shanghai', '上海'] },
  tj: { code: 'tj', name: '天津', aliases: ['tianjin', '天津'] },
  cq: { code: 'cq', name: '重庆', aliases: ['chongqing', '重庆'] },
  gd: { code: 'gd', name: '广东', aliases: ['guangdong', '广东', 'guangzhou', 'shenzhen'] },
  js: { code: 'js', name: '江苏', aliases: ['jiangsu', '江苏', 'nanjing', 'suzhou'] },
  zj: { code: 'zj', name: '浙江', aliases: ['zhejiang', '浙江', 'hangzhou', 'ningbo'] },
  sd: { code: 'sd', name: '山东', aliases: ['shandong', '山东', 'jinan', 'qingdao'] },
  ha: { code: 'ha', name: '河南', aliases: ['henan', '河南', 'zhengzhou'] },
  hb: { code: 'hb', name: '湖北', aliases: ['hubei', '湖北', 'wuhan'] },
  hn: { code: 'hn', name: '湖南', aliases: ['hunan', '湖南', 'changsha'] },
  he: { code: 'he', name: '河北', aliases: ['hebei', '河北', 'shijiazhuang'] },
  sx: { code: 'sx', name: '陕西', aliases: ['shaanxi', '陕西', 'xian', "xi'an"] },
  sn: { code: 'sn', name: '山西', aliases: ['shanxi', '山西', 'taiyuan'] },
  sc: { code: 'sc', name: '四川', aliases: ['sichuan', '四川', 'chengdu'] },
  fj: { code: 'fj', name: '福建', aliases: ['fujian', '福建', 'fuzhou', 'xiamen'] },
  ah: { code: 'ah', name: '安徽', aliases: ['anhui', '安徽', 'hefei'] },
  jx: { code: 'jx', name: '江西', aliases: ['jiangxi', '江西', 'nanchang'] },
  ln: { code: 'ln', name: '辽宁', aliases: ['liaoning', '辽宁', 'shenyang', 'dalian'] },
  jl: { code: 'jl', name: '吉林', aliases: ['jilin', '吉林', 'changchun'] },
  hl: { code: 'hl', name: '黑龙江', aliases: ['heilongjiang', '黑龙江', 'harbin'] },
  gx: { code: 'gx', name: '广西', aliases: ['guangxi', '广西', 'nanning'] },
  yn: { code: 'yn', name: '云南', aliases: ['yunnan', '云南', 'kunming'] },
  gz: { code: 'gz', name: '贵州', aliases: ['guizhou', '贵州', 'guiyang'] },
  gs: { code: 'gs', name: '甘肃', aliases: ['gansu', '甘肃', 'lanzhou'] },
  nx: { code: 'nx', name: '宁夏', aliases: ['ningxia', '宁夏', 'yinchuan'] },
  qh: { code: 'qh', name: '青海', aliases: ['qinghai', '青海', 'xining'] },
  xj: { code: 'xj', name: '新疆', aliases: ['xinjiang', '新疆', 'urumqi'] },
  xz: { code: 'xz', name: '西藏', aliases: ['tibet', 'xizang', '西藏', 'lhasa'] },
  nm: { code: 'nm', name: '内蒙古', aliases: ['inner mongolia', 'neimenggu', '内蒙古', 'hohhot'] },
  hi: { code: 'hi', name: '海南', aliases: ['hainan', '海南', 'haikou'] }
};

export function detectServerGeo(request: Request): ServerGeo {
  const cf = request.cf as IncomingRequestCfProperties | undefined;
  const ip = request.headers.get('cf-connecting-ip') ?? '';
  const region = stringOrUndefined(cf?.region);
  const city = stringOrUndefined(cf?.city);
  const asOrganization = stringOrUndefined(cf?.asOrganization);
  const province = detectProvince(region, city);

  return {
    ip,
    country: stringOrUndefined(cf?.country),
    region,
    city,
    asn: typeof cf?.asn === 'number' ? cf.asn : undefined,
    asOrganization,
    province_code: province.code,
    province_name: province.name,
    carrier: detectCarrier(asOrganization)
  };
}

export function detectProvince(...values: Array<string | undefined>): { code: string; name: string } {
  const text = values.filter(Boolean).join(' ').toLowerCase();
  for (const province of Object.values(PROVINCES)) {
    if (province.aliases.some((alias) => text.includes(alias.toLowerCase()))) {
      return { code: province.code, name: province.name };
    }
  }
  return { code: 'unknown', name: '未知' };
}

export function detectCarrier(asOrganization?: string): Carrier {
  const text = (asOrganization ?? '').toLowerCase();
  if (text.includes('telecom') || text.includes('chinanet') || text.includes('ct')) {
    return 'ct';
  }
  if (text.includes('mobile') || text.includes('cmcc')) {
    return 'cm';
  }
  if (text.includes('unicom') || text.includes('cnc')) {
    return 'cu';
  }
  return 'other';
}

function stringOrUndefined(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim() ? value.trim() : undefined;
}
