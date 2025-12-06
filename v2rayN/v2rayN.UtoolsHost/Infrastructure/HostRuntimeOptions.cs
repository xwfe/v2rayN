namespace v2rayN.UtoolsHost.Infrastructure;

public sealed class HostRuntimeOptions
{
    public const int DefaultPort = 47721;

    private HostRuntimeOptions(int port)
    {
        Port = port;
    }

    public int Port { get; }

    public static HostRuntimeOptions FromArgs(string[] args)
    {
        var port = DefaultPort;

        if (Environment.GetEnvironmentVariable("V2RAYN_UTOOLS_PORT") is { Length: > 0 } envPort
            && int.TryParse(envPort, out var parsedEnv))
        {
            port = parsedEnv;
        }

        foreach (var arg in args)
        {
            if (arg.StartsWith("--port=", StringComparison.OrdinalIgnoreCase))
            {
                var value = arg[("--port=".Length)..];
                if (int.TryParse(value, out var parsedArg))
                {
                    port = parsedArg;
                }
                break;
            }
        }

        port = Math.Clamp(port, 1024, 65535);
        return new HostRuntimeOptions(port);
    }

    public string BuildUrl() => $"http://127.0.0.1:{Port}";
}
