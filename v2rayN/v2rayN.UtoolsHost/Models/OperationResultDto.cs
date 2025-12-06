namespace v2rayN.UtoolsHost.Models;

public sealed class OperationResultDto
{
    public bool Success { get; init; }

    public string Message { get; init; } = string.Empty;

    public object? Payload { get; init; }

    public static OperationResultDto Ok(string message, object? payload = null)
    {
        return new OperationResultDto { Success = true, Message = message, Payload = payload };
    }

    public static OperationResultDto Fail(string message)
    {
        return new OperationResultDto { Success = false, Message = message };
    }
}
