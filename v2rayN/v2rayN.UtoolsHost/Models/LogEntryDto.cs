namespace v2rayN.UtoolsHost.Models;

public sealed class LogEntryDto
{
    public long Id { get; init; }

    public DateTimeOffset Timestamp { get; init; }

    public string Level { get; init; } = string.Empty;

    public string Message { get; init; } = string.Empty;
}
