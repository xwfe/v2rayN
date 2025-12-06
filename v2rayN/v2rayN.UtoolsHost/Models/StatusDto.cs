namespace v2rayN.UtoolsHost.Models;

public sealed class StatusDto
{
    public string? ActiveProfileId { get; init; }
    public string? ActiveProfileRemarks { get; init; }
    public string? ActiveProfileAddress { get; init; }
    public bool CoreRunning { get; init; }
    public int SocksPort { get; init; }
    public int StatePort { get; init; }
    public DateTimeOffset UpdatedAt { get; init; }
}
