using System.Collections.Concurrent;
using Microsoft.Extensions.Logging;
using v2rayN.UtoolsHost.Models;

namespace v2rayN.UtoolsHost.Infrastructure;

public sealed class LogBuffer
{
    private readonly ConcurrentQueue<LogEntryDto> _entries = new();
    private readonly int _maxEntries;
    private long _cursor;

    public LogBuffer(int maxEntries = 400)
    {
        _maxEntries = Math.Max(100, maxEntries);
    }

    public void Add(string? message, LogLevel level = LogLevel.Information)
    {
        if (string.IsNullOrWhiteSpace(message))
        {
            return;
        }

        var entry = new LogEntryDto
        {
            Id = Interlocked.Increment(ref _cursor),
            Timestamp = DateTimeOffset.UtcNow,
            Level = level.ToString(),
            Message = message.Trim()
        };

        _entries.Enqueue(entry);
        Trim();
    }

    public IReadOnlyList<LogEntryDto> Read(long after)
    {
        if (after <= 0)
        {
            return _entries.ToArray();
        }

        return _entries.Where(entry => entry.Id > after).ToArray();
    }

    private void Trim()
    {
        while (_entries.Count > _maxEntries && _entries.TryDequeue(out _))
        {
        }
    }
}
