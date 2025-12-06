using Microsoft.AspNetCore.Http.Json;
using v2rayN.UtoolsHost.Infrastructure;
using v2rayN.UtoolsHost.Models;
using v2rayN.UtoolsHost.Services;

var options = HostRuntimeOptions.FromArgs(args);

var builder = WebApplication.CreateBuilder(new WebApplicationOptions
{
    Args = args,
    ContentRootPath = Directory.GetCurrentDirectory()
});

builder.Logging.ClearProviders();
builder.Logging.AddSimpleConsole(o =>
{
    o.SingleLine = true;
    o.TimestampFormat = "HH:mm:ss ";
});

builder.Services.Configure<JsonOptions>(o => o.SerializerOptions.WriteIndented = false);

builder.Services.AddSingleton(options);
builder.Services.AddSingleton<LogBuffer>();
builder.Services.AddSingleton<HostRuntime>();
builder.Services.AddCors(policy =>
    policy.AddDefaultPolicy(cfg => cfg.AllowAnyOrigin().AllowAnyHeader().AllowAnyMethod()));

var app = builder.Build();

app.Urls.Clear();
app.Urls.Add(options.BuildUrl());

var runtime = app.Services.GetRequiredService<HostRuntime>();
await runtime.InitializeAsync();

app.Lifetime.ApplicationStopping.Register(() =>
{
    runtime.DisposeAsync().AsTask().GetAwaiter().GetResult();
});

app.UseCors();

app.MapGet("/api/status", async (HostRuntime runtime) => Results.Ok(await runtime.GetStatusAsync()));

app.MapGet("/api/profiles", async (string? q, string? subId, HostRuntime runtime) =>
{
    var profiles = await runtime.GetProfilesAsync(q, subId);
    return Results.Ok(profiles);
});

app.MapPost("/api/profiles/{indexId}/activate", async (string indexId, HostRuntime runtime) =>
{
    var result = await runtime.ActivateProfileAsync(indexId);
    return result.Success ? Results.Ok(result) : Results.BadRequest(result);
});

app.MapPost("/api/core/reload", async (HostRuntime runtime) =>
{
    var result = await runtime.ReloadCoreAsync();
    return result.Success ? Results.Ok(result) : Results.BadRequest(result);
});

app.MapPost("/api/core/stop", async (HostRuntime runtime) =>
{
    var result = await runtime.StopCoreAsync();
    return result.Success ? Results.Ok(result) : Results.BadRequest(result);
});

app.MapGet("/api/logs", (long? after, HostRuntime runtime) => Results.Ok(runtime.ReadLogs(after ?? 0)));

app.MapGet("/", () => Results.Redirect("/api/status"));

await app.RunAsync();
