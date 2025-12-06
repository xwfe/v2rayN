using System.Reactive.Concurrency;
using Microsoft.Extensions.Logging;
using ReactiveUI;
using ServiceLib.Enums;
using ServiceLib.Handler;
using ServiceLib.Handler.SysProxy;
using ServiceLib.Manager;
using ServiceLib.Models;
using v2rayN.UtoolsHost.Infrastructure;
using v2rayN.UtoolsHost.Models;

namespace v2rayN.UtoolsHost.Services;

public sealed class HostRuntime : IAsyncDisposable
{
    private readonly LogBuffer _logBuffer;
    private readonly ILogger<HostRuntime> _logger;
    private Config? _config;
    private bool _coreRunning;
    private bool _initialized;
    private readonly SemaphoreSlim _coreSemaphore = new(1, 1);

    public HostRuntime(LogBuffer logBuffer, ILogger<HostRuntime> logger)
    {
        _logBuffer = logBuffer;
        _logger = logger;
    }

    public async Task InitializeAsync()
    {
        if (_initialized)
        {
            return;
        }

        ConfigureReactiveSchedulers();

        if (!AppManager.Instance.InitApp())
        {
            throw new InvalidOperationException("Failed to initialize v2rayN config");
        }

        AppManager.Instance.InitComponents();
        _config = AppManager.Instance.Config;

        await ConfigHandler.InitBuiltinDNS(_config);
        await ConfigHandler.InitBuiltinFullConfigTemplate(_config);
        await ProfileExManager.Instance.Init();
        await ProfileGroupItemManager.Instance.Init();
        await CoreManager.Instance.Init(_config, HandleCoreLogAsync);

        _initialized = true;
    }

    public async Task<StatusDto> GetStatusAsync()
    {
        var config = EnsureConfig();
        ProfileItem? profile = null;
        if (!string.IsNullOrEmpty(config.IndexId))
        {
            profile = await AppManager.Instance.GetProfileItem(config.IndexId);
        }

        return new StatusDto
        {
            ActiveProfileId = profile?.IndexId,
            ActiveProfileRemarks = profile?.Remarks,
            ActiveProfileAddress = profile == null ? null : $"{profile.Address}:{profile.Port}",
            CoreRunning = _coreRunning,
            SocksPort = AppManager.Instance.GetLocalPort(EInboundProtocol.socks),
            StatePort = AppManager.Instance.StatePort,
            UpdatedAt = DateTimeOffset.UtcNow
        };
    }

    public async Task<IReadOnlyList<ProfileSummaryDto>> GetProfilesAsync(string? query, string? subId)
    {
        var config = EnsureConfig();
        var filter = query ?? string.Empty;
        var resolvedSubId = string.IsNullOrEmpty(subId) ? config.SubIndexId ?? string.Empty : subId;

        var items = await AppManager.Instance.ProfileItems(resolvedSubId, filter)
                    ?? new List<ProfileItemModel>();

        return items.Select(ProfileSummaryDto.FromModel).ToList();
    }

    public async Task<OperationResultDto> ActivateProfileAsync(string indexId)
    {
        if (string.IsNullOrWhiteSpace(indexId))
        {
            return OperationResultDto.Fail("Profile id can not be empty.");
        }

        var config = EnsureConfig();
        if (string.Equals(config.IndexId, indexId, StringComparison.OrdinalIgnoreCase))
        {
            return OperationResultDto.Ok("Profile already active.");
        }

        var profile = await AppManager.Instance.GetProfileItem(indexId);
        if (profile is null)
        {
            return OperationResultDto.Fail("Profile not found.");
        }

        var ret = await ConfigHandler.SetDefaultServerIndex(config, indexId);
        if (ret != 0)
        {
            return OperationResultDto.Fail("Unable to set default profile.");
        }

        var reloadResult = await ReloadCoreAsync();
        if (!reloadResult.Success)
        {
            return reloadResult;
        }

        return OperationResultDto.Ok($"Activated {profile.GetSummary()}");
    }

    public async Task<OperationResultDto> ReloadCoreAsync()
    {
        await _coreSemaphore.WaitAsync();
        try
        {
            var config = EnsureConfig();
            var checks = await ActionPrecheckManager.Instance.Check(config.IndexId);
            if (checks.Count > 0)
            {
                var msg = string.Join(Environment.NewLine, checks);
                _logBuffer.Add(msg, LogLevel.Warning);
                return OperationResultDto.Fail(msg);
            }

            var node = await ConfigHandler.GetDefaultServer(config);
            if (node is null)
            {
                const string noNode = "No active server configured.";
                _logBuffer.Add(noNode, LogLevel.Warning);
                return OperationResultDto.Fail(noNode);
            }

            await CoreManager.Instance.LoadCore(node);
            await SysProxyHandler.UpdateSysProxy(config, false);

            _coreRunning = true;
            var summary = node.GetSummary();
            _logBuffer.Add($"Core reloaded with {summary}", LogLevel.Information);
            return OperationResultDto.Ok($"Core started: {summary}");
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Failed to reload core");
            _logBuffer.Add(ex.Message, LogLevel.Error);
            return OperationResultDto.Fail(ex.Message);
        }
        finally
        {
            _coreSemaphore.Release();
        }
    }

    public async Task<OperationResultDto> StopCoreAsync()
    {
        await _coreSemaphore.WaitAsync();
        try
        {
            await CoreManager.Instance.CoreStop();
            await SysProxyHandler.UpdateSysProxy(EnsureConfig(), true);
            _coreRunning = false;
            _logBuffer.Add("Core stopped.", LogLevel.Information);
            return OperationResultDto.Ok("Core stopped.");
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Failed to stop core");
            _logBuffer.Add(ex.Message, LogLevel.Error);
            return OperationResultDto.Fail(ex.Message);
        }
        finally
        {
            _coreSemaphore.Release();
        }
    }

    public IReadOnlyList<LogEntryDto> ReadLogs(long after)
    {
        return _logBuffer.Read(after);
    }

    public async ValueTask DisposeAsync()
    {
        if (!_initialized)
        {
            return;
        }

        try
        {
            await AppManager.Instance.AppExitAsync(false);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Failed to dispose host runtime");
        }
    }

    private static void ConfigureReactiveSchedulers()
    {
        if (RxApp.MainThreadScheduler != null && RxApp.MainThreadScheduler is not CurrentThreadScheduler)
        {
            return;
        }

        RxApp.MainThreadScheduler = new EventLoopScheduler(static action =>
        {
            var thread = new Thread(action)
            {
                IsBackground = true,
                Name = "v2rayN.UtoolsHost.Reactive"
            };
            return thread;
        });
    }

    private Config EnsureConfig()
    {
        return _config ?? throw new InvalidOperationException("Host runtime has not been initialized.");
    }

    private Task HandleCoreLogAsync(bool highlight, string message)
    {
        _logBuffer.Add(message, highlight ? LogLevel.Information : LogLevel.Debug);
        return Task.CompletedTask;
    }
}
