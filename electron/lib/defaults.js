const DIRECT_DNS = 'https://dns.alidns.com/dns-query';
const REMOTE_DNS = 'https://cloudflare-dns.com/dns-query';
const BOOTSTRAP_DNS = '223.5.5.5';
const SPEED_TEST_URL = 'https://cachefly.cachefly.net/50mb.test';
const SPEED_PING_TEST_URL = 'https://www.google.com/generate_204';
const SINGBOX_DEFAULT_MUX = 'h2mux';
const DEFAULT_FRAGMENT = {
  Packets: 'tlshello',
  Length: '100-200',
  Interval: '10-20'
};

function detectLanguage() {
  const lang = process.env.LANG || process.env.LANGUAGE || '';
  if (lang.toLowerCase().startsWith('zh')) {
    return 'zh-Hans';
  }
  return 'en';
}

function getSystemProxyExceptions() {
  if (process.platform === 'win32') {
    return 'localhost;127.*;10.*;172.16.*;172.17.*;172.18.*;172.19.*;172.20.*;172.21.*;172.22.*;172.23.*;172.24.*;172.25.*;172.26.*;172.27.*;172.28.*;172.29.*;172.30.*;172.31.*;192.168.*';
  }
  return 'localhost,127.0.0.0/8,::1';
}

function createDefaultConfig() {
  return {
    IndexId: '',
    SubIndexId: '',
    RunningCoreType: 2,
    CoreBasicItem: {
      LogEnabled: false,
      Loglevel: 'warning',
      MuxEnabled: false,
      DefAllowInsecure: false,
      DefFingerprint: '',
      DefUserAgent: '',
      EnableFragment: false,
      EnableCacheFile4Sbox: true
    },
    Inbound: [
      {
        LocalPort: 10808,
        Protocol: 'socks',
        UdpEnabled: true,
        SniffingEnabled: true,
        DestOverride: ['http', 'tls'],
        RouteOnly: false,
        AllowLANConn: false,
        NewPort4LAN: false,
        User: '',
        Pass: '',
        SecondLocalPortEnabled: false
      }
    ],
    RoutingBasicItem: {
      DomainStrategy: 'AsIs',
      DomainStrategy4Singbox: '',
      RoutingIndexId: ''
    },
    KcpItem: {
      Mtu: 1350,
      Tti: 50,
      UplinkCapacity: 12,
      DownlinkCapacity: 100,
      ReadBufferSize: 2,
      WriteBufferSize: 2,
      Congestion: false
    },
    GrpcItem: {
      IdleTimeout: 60,
      HealthCheckTimeout: 20,
      PermitWithoutStream: false,
      InitialWindowsSize: 0
    },
    TunModeItem: {
      EnableTun: false,
      AutoRoute: true,
      StrictRoute: true,
      Stack: '',
      Mtu: 9000,
      EnableExInbound: false,
      EnableIPv6Address: false
    },
    GuiItem: {
      AutoRun: false,
      EnableStatistics: false,
      DisplayRealTimeSpeed: false,
      KeepOlderDedupl: false,
      AutoUpdateInterval: 0,
      TrayMenuServersLimit: 20,
      EnableHWA: false,
      EnableLog: true
    },
    MsgUIItem: {
      MainMsgFilter: '',
      AutoRefresh: true
    },
    UiItem: {
      EnableAutoAdjustMainLvColWidth: false,
      EnableUpdateSubOnlyRemarksExist: true,
      MainGirdHeight1: 0,
      MainGirdHeight2: 0,
      MainGirdOrientation: 0,
      ColorPrimaryName: '',
      CurrentTheme: '',
      CurrentLanguage: detectLanguage(),
      CurrentFontFamily: '',
      CurrentFontSize: 0,
      EnableDragDropSort: true,
      DoubleClick2Activate: true,
      AutoHideStartup: false,
      Hide2TrayWhenClose: true,
      ShowInTaskbar: true,
      MacOSShowInDock: true,
      MainColumnItem: [],
      WindowSizeItem: []
    },
    ConstItem: {
      SubConvertUrl: '',
      GeoSourceUrl: '',
      SrsSourceUrl: '',
      RouteRulesTemplateSourceUrl: ''
    },
    SpeedTestItem: {
      SpeedTestTimeout: 10,
      SpeedTestUrl: SPEED_TEST_URL,
      SpeedPingTestUrl: SPEED_PING_TEST_URL,
      MixedConcurrencyCount: 5,
      IPAPIUrl: ''
    },
    Mux4RayItem: {
      Concurrency: 8,
      XudpConcurrency: 16,
      XudpProxyUDP443: 'reject'
    },
    Mux4SboxItem: {
      Protocol: SINGBOX_DEFAULT_MUX,
      MaxConnections: 8,
      Padding: false
    },
    HysteriaItem: {
      UpMbps: 100,
      DownMbps: 100,
      HopInterval: 30
    },
    ClashUIItem: {
      RuleMode: 0,
      EnableIPv6: true,
      EnableMixinContent: false,
      ProxiesSorting: 0,
      ProxiesAutoRefresh: false,
      ProxiesAutoDelayTestInterval: 10,
      ConnectionsAutoRefresh: false,
      ConnectionsRefreshInterval: 2
    },
    SystemProxyItem: {
      SysProxyType: 0,
      SystemProxyExceptions: getSystemProxyExceptions(),
      NotProxyLocalAddress: true,
      SystemProxyAdvancedProtocol: '',
      CustomSystemProxyPacPath: '',
      CustomSystemProxyScriptPath: ''
    },
    WebDavItem: {
      Url: '',
      UserName: '',
      Password: '',
      DirName: ''
    },
    CheckUpdateItem: {
      CheckPreReleaseUpdate: false,
      SelectedCoreTypes: []
    },
    Fragment4RayItem: { ...DEFAULT_FRAGMENT },
    GlobalHotkeys: [],
    CoreTypeItem: [],
    SimpleDNSItem: {
      UseSystemHosts: false,
      AddCommonHosts: true,
      FakeIP: false,
      GlobalFakeIp: true,
      BlockBindingQuery: true,
      DirectDNS: DIRECT_DNS,
      RemoteDNS: REMOTE_DNS,
      BootstrapDNS: BOOTSTRAP_DNS,
      SingboxStrategy4Direct: '',
      SingboxStrategy4Proxy: '',
      Hosts: '',
      DirectExpectedIPs: ''
    }
  };
}

module.exports = {
  createDefaultConfig
};
