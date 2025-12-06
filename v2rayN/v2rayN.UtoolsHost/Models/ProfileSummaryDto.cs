using ServiceLib.Models;

namespace v2rayN.UtoolsHost.Models;

public sealed class ProfileSummaryDto
{
    public string IndexId { get; init; } = string.Empty;
    public string Remarks { get; init; } = string.Empty;
    public string Address { get; init; } = string.Empty;
    public int Port { get; init; }
    public string? Network { get; init; }
    public string? StreamSecurity { get; init; }
    public string? SubRemarks { get; init; }
    public bool IsActive { get; init; }
    public string ConfigType { get; init; } = string.Empty;
    public string? Delay { get; init; }
    public string? Speed { get; init; }

    public static ProfileSummaryDto FromModel(ProfileItemModel model)
    {
        return new ProfileSummaryDto
        {
            IndexId = model.IndexId,
            Remarks = model.Remarks,
            Address = model.Address,
            Port = model.Port,
            Network = model.Network,
            StreamSecurity = model.StreamSecurity,
            SubRemarks = model.SubRemarks,
            IsActive = model.IsActive,
            ConfigType = model.ConfigType.ToString(),
            Delay = model.DelayVal,
            Speed = model.SpeedVal
        };
    }
}
