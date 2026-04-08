const CONFIG_TYPES = {
  1: 'VMess',
  2: 'Custom',
  3: 'Shadowsocks',
  4: 'SOCKS',
  5: 'VLESS',
  6: 'Trojan',
  7: 'Hysteria2',
  8: 'TUIC',
  9: 'WireGuard',
  10: 'HTTP',
  11: 'Anytls',
  101: 'Policy Group',
  102: 'Proxy Chain'
};

const CORE_TYPES = {
  1: 'v2fly',
  2: 'Xray',
  4: 'v2fly v5',
  13: 'mihomo',
  21: 'hysteria',
  22: 'naiveproxy',
  23: 'tuic',
  24: 'sing-box',
  25: 'juicity',
  26: 'hysteria2',
  27: 'brook',
  28: 'overtls',
  29: 'shadowquic',
  30: 'mieru',
  99: 'v2rayN'
};

const STREAM_SECURITY = {
  tls: 'TLS',
  reality: 'REALITY'
};

module.exports = {
  CONFIG_TYPES,
  CORE_TYPES,
  STREAM_SECURITY
};
