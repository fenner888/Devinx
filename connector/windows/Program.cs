using System.Diagnostics;
using System.Drawing;
using System.Security.Cryptography;
using System.Text;
using System.Text.Json;
using System.Text.Json.Serialization;
using Microsoft.Win32;
using QRCoder;

namespace DevinX.Connector.Windows;

internal static class Program
{
    [STAThread]
    private static int Main(string[] args)
    {
        if (args.Length == 1 && args[0] == "--verify-qr-renderer")
        {
            return QrCodeRenderer.Verify() ? 0 : 1;
        }

        if (args.Length == 1 && args[0] == "--verify-runtime-launch")
        {
            return RuntimeBundle.VerifyLaunch() ? 0 : 1;
        }

        ApplicationConfiguration.Initialize();
        Application.Run(new ConnectorForm());
        return 0;
    }
}

internal sealed record StagedRuntime(string NodePath, string ScriptPath, string WorkingDirectory);

internal static class RuntimeBundle
{
    private static readonly string[] RequiredFiles =
    [
        "connector-runtime.cjs",
        "runtime/node.exe",
        "windows-dpapi-helper.exe",
    ];

    internal static StagedRuntime Stage()
    {
        var sourceRoot = Path.Combine(AppContext.BaseDirectory, "Resources");
        var localRootOverride = Environment.GetEnvironmentVariable("DEVINX_RUNTIME_STAGE_ROOT");
        var connectorRoot = string.IsNullOrWhiteSpace(localRootOverride)
            ? Path.Combine(
                Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData),
                "DevinX",
                "Connector")
            : Path.GetFullPath(localRootOverride);
        var runtimeRoot = Path.Combine(connectorRoot, "Runtime");
        var workingDirectory = Path.Combine(connectorRoot, "Data");

        ValidateSource(sourceRoot);
        Directory.CreateDirectory(runtimeRoot);
        Directory.CreateDirectory(workingDirectory);

        var expectedHashes = RequiredFiles.ToDictionary(
            relativePath => relativePath,
            relativePath => HashFile(Path.Combine(sourceRoot, relativePath)),
            StringComparer.OrdinalIgnoreCase);
        var fingerprint = Fingerprint(expectedHashes);
        var stagedRoot = Path.Combine(runtimeRoot, fingerprint);

        using (AcquireLock(runtimeRoot))
        {
            if (!VerifyStaged(stagedRoot, expectedHashes))
            {
                TryDeleteDirectory(stagedRoot);
                var temporaryRoot = Path.Combine(runtimeRoot, $".staging-{Guid.NewGuid():N}");
                try
                {
                    foreach (var relativePath in RequiredFiles)
                    {
                        var source = Path.Combine(sourceRoot, relativePath);
                        var destination = Path.Combine(temporaryRoot, relativePath);
                        Directory.CreateDirectory(Path.GetDirectoryName(destination)!);
                        File.Copy(source, destination, overwrite: false);
                    }
                    if (!VerifyStaged(temporaryRoot, expectedHashes))
                    {
                        throw new InvalidDataException("The staged Connector runtime failed integrity verification.");
                    }
                    Directory.Move(temporaryRoot, stagedRoot);
                }
                finally
                {
                    TryDeleteDirectory(temporaryRoot);
                }
            }

            CleanupOldVersions(runtimeRoot, fingerprint);
        }

        return new StagedRuntime(
            Path.Combine(stagedRoot, "runtime", "node.exe"),
            Path.Combine(stagedRoot, "connector-runtime.cjs"),
            workingDirectory);
    }

    internal static bool VerifyLaunch()
    {
        try
        {
            var staged = Stage();
            if (!RunProbe(staged.NodePath, ["--version"], staged.WorkingDirectory, [0])) return false;
            var helper = Path.Combine(Path.GetDirectoryName(staged.ScriptPath)!, "windows-dpapi-helper.exe");
            return RunProbe(helper, ["probe"], staged.WorkingDirectory, [0]);
        }
        catch
        {
            return false;
        }
    }

    private static bool RunProbe(
        string executable,
        IReadOnlyList<string> arguments,
        string workingDirectory,
        IReadOnlySet<int> acceptedExitCodes)
    {
        using var process = new Process
        {
            StartInfo = new ProcessStartInfo
            {
                FileName = executable,
                WorkingDirectory = workingDirectory,
                UseShellExecute = false,
                CreateNoWindow = true,
                RedirectStandardOutput = true,
                RedirectStandardError = true,
            },
        };
        foreach (var argument in arguments) process.StartInfo.ArgumentList.Add(argument);
        if (!process.Start()) return false;
        var outputTask = process.StandardOutput.ReadToEndAsync();
        var errorTask = process.StandardError.ReadToEndAsync();
        if (!process.WaitForExit(15_000))
        {
            process.Kill(entireProcessTree: true);
            return false;
        }
        Task.WaitAll([outputTask, errorTask], 5_000);
        return acceptedExitCodes.Contains(process.ExitCode);
    }

    private static void ValidateSource(string sourceRoot)
    {
        if (!Directory.Exists(sourceRoot)) throw new DirectoryNotFoundException();
        if (HasReparsePoint(sourceRoot)) throw new InvalidDataException();
        foreach (var relativePath in RequiredFiles)
        {
            var source = Path.Combine(sourceRoot, relativePath);
            if (!File.Exists(source) || HasReparsePoint(source)) throw new FileNotFoundException();
        }
    }

    private static bool VerifyStaged(string stagedRoot, IReadOnlyDictionary<string, string> hashes)
    {
        if (!Directory.Exists(stagedRoot) || HasReparsePoint(stagedRoot)) return false;
        var actualFiles = Directory
            .EnumerateFiles(stagedRoot, "*", SearchOption.AllDirectories)
            .Select(path => Path.GetRelativePath(stagedRoot, path).Replace('\\', '/'))
            .Order(StringComparer.OrdinalIgnoreCase)
            .ToArray();
        if (!actualFiles.SequenceEqual(RequiredFiles.Order(StringComparer.OrdinalIgnoreCase), StringComparer.OrdinalIgnoreCase))
        {
            return false;
        }
        foreach (var relativePath in RequiredFiles)
        {
            var path = Path.Combine(stagedRoot, relativePath);
            if (HasReparsePoint(path) || HashFile(path) != hashes[relativePath]) return false;
        }
        return true;
    }

    private static string Fingerprint(IReadOnlyDictionary<string, string> hashes)
    {
        var value = string.Join(
            "\n",
            hashes.OrderBy(item => item.Key, StringComparer.Ordinal).Select(item => $"{item.Key}:{item.Value}"));
        return Convert.ToHexStringLower(SHA256.HashData(Encoding.UTF8.GetBytes(value)));
    }

    private static string HashFile(string path)
    {
        using var stream = new FileStream(path, FileMode.Open, FileAccess.Read, FileShare.Read);
        return Convert.ToHexStringLower(SHA256.HashData(stream));
    }

    private static FileStream AcquireLock(string runtimeRoot)
    {
        var path = Path.Combine(runtimeRoot, ".stage.lock");
        for (var attempt = 0; attempt < 40; attempt++)
        {
            try
            {
                return new FileStream(path, FileMode.OpenOrCreate, FileAccess.ReadWrite, FileShare.None);
            }
            catch (IOException) when (attempt < 39)
            {
                Thread.Sleep(50);
            }
        }
        throw new IOException("The Connector runtime staging lock is unavailable.");
    }

    private static void CleanupOldVersions(string runtimeRoot, string currentFingerprint)
    {
        foreach (var directory in Directory.EnumerateDirectories(runtimeRoot))
        {
            var name = Path.GetFileName(directory);
            if (name.Equals(currentFingerprint, StringComparison.OrdinalIgnoreCase)) continue;
            if (name.StartsWith(".staging-", StringComparison.Ordinal)
                || name.Length == 64 && name.All(Uri.IsHexDigit))
            {
                TryDeleteDirectory(directory);
            }
        }
    }

    private static bool HasReparsePoint(string path) =>
        (File.GetAttributes(path) & FileAttributes.ReparsePoint) != 0;

    private static void TryDeleteDirectory(string path)
    {
        try
        {
            if (Directory.Exists(path)) Directory.Delete(path, recursive: true);
        }
        catch (IOException)
        {
        }
        catch (UnauthorizedAccessException)
        {
        }
    }
}

internal static class QrCodeRenderer
{
    private const int PixelsPerModule = 8;

    internal static Bitmap Render(string payload)
    {
        if (string.IsNullOrWhiteSpace(payload))
        {
            throw new ArgumentException("A pairing payload is required.", nameof(payload));
        }

        using var generator = new QRCodeGenerator();
        using var data = generator.CreateQrCode(payload, QRCodeGenerator.ECCLevel.M);
        using var qrCode = new QRCode(data);
        using var rendered = qrCode.GetGraphic(
            PixelsPerModule,
            Color.Black,
            Color.White,
            drawQuietZones: true);
        return new Bitmap(rendered);
    }

    internal static bool Verify()
    {
        using var bitmap = Render(
            "{\"version\":1,\"type\":\"pairing_offer\",\"url\":\"https://100.64.0.1:43110\",\"pairingId\":\"windows-qr-self-test\"}");
        if (bitmap.Width <= 0 || bitmap.Height <= 0) return false;

        var hasDarkPixel = false;
        var hasLightPixel = false;
        for (var y = 0; y < bitmap.Height && !(hasDarkPixel && hasLightPixel); y++)
        {
            for (var x = 0; x < bitmap.Width && !(hasDarkPixel && hasLightPixel); x++)
            {
                var pixel = bitmap.GetPixel(x, y);
                hasDarkPixel |= pixel.R < 32 && pixel.G < 32 && pixel.B < 32;
                hasLightPixel |= pixel.R > 223 && pixel.G > 223 && pixel.B > 223;
            }
        }

        return hasDarkPixel && hasLightPixel;
    }
}

internal sealed class ConnectorForm : Form
{
    private const int MaximumIpcLineCharacters = 16_384;
    private const string StartupTaskId = "DevinXConnectorStartup";
    private const string StartupValueName = "DevinX Connector";
    private const string ReleasePage = "https://apps.microsoft.com/detail/9N52Z3FVMFH8";
    private const string SetupGuide =
        "https://github.com/fenner888/Devinx/blob/main/docs/devinx-connector.md";
    private readonly Label statusLabel = new() { AutoSize = true, Font = new Font("Segoe UI", 18, FontStyle.Bold) };
    private readonly Label detailLabel = new() { AutoSize = true, ForeColor = Color.DimGray };
    private readonly PictureBox qrImage = new()
    {
        Width = 360,
        Height = 360,
        BackColor = Color.White,
        SizeMode = PictureBoxSizeMode.Zoom,
    };
    private readonly Button regenerateButton = new() { Text = "Generate new code", AutoSize = true };
    private readonly CheckBox launchAtLogin = new() { Text = "Open DevinX Connector when I sign in", AutoSize = true };
    private readonly Label devicesTitle = new()
    {
        Text = "Paired iPhones",
        AutoSize = true,
        Font = new Font("Segoe UI", 14, FontStyle.Bold),
        Margin = new Padding(0, 18, 0, 8),
        Visible = false,
    };
    private readonly DataGridView devicesGrid = new()
    {
        AllowUserToAddRows = false,
        AllowUserToDeleteRows = false,
        AutoGenerateColumns = false,
        AutoSizeColumnsMode = DataGridViewAutoSizeColumnsMode.Fill,
        MultiSelect = false,
        RowHeadersVisible = false,
        Height = 220,
        Visible = false,
    };
    private readonly FlowLayoutPanel deviceActions = new()
    {
        AutoSize = true,
        FlowDirection = FlowDirection.LeftToRight,
        Visible = false,
    };
    private readonly Button savePermissionsButton = new() { Text = "Save permissions", AutoSize = true };
    private readonly Button revokeButton = new() { Text = "Revoke selected iPhone", AutoSize = true };
    private readonly Button releasesButton = new() { Text = "Open Microsoft Store", AutoSize = true };
    private readonly Button helpButton = new() { Text = "Setup and uninstall help", AutoSize = true };
    private readonly NotifyIcon trayIcon = new() { Text = "DevinX Connector", Visible = true };
    private readonly SemaphoreSlim writeLock = new(1, 1);
    private Process? runtime;
    private bool exiting;
    private bool launchAtLoginInitializing = true;

    public ConnectorForm()
    {
        Text = "DevinX Connector";
        Width = 620;
        Height = 860;
        MinimumSize = new Size(560, 700);
        StartPosition = FormStartPosition.CenterScreen;
        Font = new Font("Segoe UI", 10);

        devicesGrid.Columns.Add(new DataGridViewTextBoxColumn { Name = "Name", HeaderText = "Paired iPhone", ReadOnly = true });
        devicesGrid.Columns.Add(new DataGridViewTextBoxColumn { Name = "Paired", HeaderText = "Paired", ReadOnly = true });
        devicesGrid.Columns.Add(new DataGridViewCheckBoxColumn { Name = "Read", HeaderText = "Read history" });
        devicesGrid.Columns.Add(new DataGridViewCheckBoxColumn { Name = "Send", HeaderText = "Send messages" });
        devicesGrid.Columns.Add(new DataGridViewCheckBoxColumn { Name = "Create", HeaderText = "Create sessions" });

        var heading = new Label
        {
            Text = "DevinX Connector",
            AutoSize = true,
            Font = new Font("Segoe UI", 24, FontStyle.Bold),
            Margin = new Padding(0, 0, 0, 8),
        };
        var privacy = new Label
        {
            Text = "Tailscale provides the private route. Connector verifies every iPhone request. Devin credentials stay on this PC.",
            AutoSize = true,
            MaximumSize = new Size(520, 0),
            ForeColor = Color.DimGray,
            Margin = new Padding(0, 0, 0, 18),
        };
        deviceActions.Controls.Add(savePermissionsButton);
        deviceActions.Controls.Add(revokeButton);
        var supportActions = new FlowLayoutPanel
        {
            AutoSize = true,
            FlowDirection = FlowDirection.LeftToRight,
            Margin = new Padding(0, 14, 0, 0),
        };
        supportActions.Controls.Add(releasesButton);
        supportActions.Controls.Add(helpButton);

        var content = new FlowLayoutPanel
        {
            Dock = DockStyle.Fill,
            FlowDirection = FlowDirection.TopDown,
            WrapContents = false,
            AutoScroll = true,
            Padding = new Padding(28),
        };
        content.Controls.Add(heading);
        content.Controls.Add(statusLabel);
        content.Controls.Add(detailLabel);
        content.Controls.Add(privacy);
        content.Controls.Add(qrImage);
        content.Controls.Add(regenerateButton);
        content.Controls.Add(devicesTitle);
        content.Controls.Add(devicesGrid);
        content.Controls.Add(deviceActions);
        content.Controls.Add(launchAtLogin);
        content.Controls.Add(supportActions);
        Controls.Add(content);

        regenerateButton.Click += async (_, _) => await SendCommandAsync(new { version = 1, type = "regenerate" });
        savePermissionsButton.Click += async (_, _) => await SaveSelectedPermissionsAsync();
        revokeButton.Click += async (_, _) => await RevokeSelectedDeviceAsync();
        releasesButton.Click += (_, _) => OpenOfficialPage(ReleasePage);
        helpButton.Click += (_, _) => OpenOfficialPage(SetupGuide);
        launchAtLogin.CheckedChanged += async (_, _) => await HandleLaunchAtLoginChangedAsync();
        FormClosing += HandleFormClosing;
        Shown += async (_, _) =>
        {
            await InitializeLaunchAtLoginAsync();
            await StartRuntimeAsync();
        };

        var menu = new ContextMenuStrip();
        menu.Items.Add("Open DevinX Connector", null, (_, _) => RestoreWindow());
        menu.Items.Add("Quit DevinX Connector", null, async (_, _) => await ExitAsync());
        trayIcon.ContextMenuStrip = menu;
        trayIcon.Icon = SystemIcons.Application;
        trayIcon.DoubleClick += (_, _) => RestoreWindow();
        SetStatus("Starting…", "Checking Tailscale and Devin for Terminal");
    }

    private async Task StartRuntimeAsync()
    {
        try
        {
            var staged = RuntimeBundle.Stage();
            runtime = new Process
            {
                StartInfo = new ProcessStartInfo
                {
                    FileName = staged.NodePath,
                    ArgumentList = { staged.ScriptPath },
                    WorkingDirectory = staged.WorkingDirectory,
                    UseShellExecute = false,
                    CreateNoWindow = true,
                    RedirectStandardInput = true,
                    RedirectStandardOutput = true,
                    RedirectStandardError = true,
                    StandardInputEncoding = Encoding.UTF8,
                    StandardOutputEncoding = Encoding.UTF8,
                },
                EnableRaisingEvents = true,
            };
            runtime.Exited += (_, _) => BeginInvoke(() => SetStatus("Needs attention", "The Connector runtime stopped. Quit and reopen DevinX Connector."));
            if (!runtime.Start()) throw new InvalidOperationException();
            _ = Task.Run(() => DrainErrorsAsync(runtime.StandardError));
            await ReadEventsAsync(runtime.StandardOutput);
        }
        catch
        {
            runtime?.Dispose();
            runtime = null;
            SetStatus("Connector runtime unavailable", "Update DevinX Connector from Microsoft Store, then reopen it.");
        }
    }

    private static async Task DrainErrorsAsync(StreamReader reader)
    {
        var buffer = new char[1024];
        while (await reader.ReadAsync(buffer.AsMemory()) > 0) Array.Clear(buffer);
    }

    private async Task ReadEventsAsync(StreamReader reader)
    {
        while (true)
        {
            var line = await reader.ReadLineAsync();
            if (line is null) break;
            if (string.IsNullOrEmpty(line) || line.Length > MaximumIpcLineCharacters) continue;
            ConnectorEvent? connectorEvent;
            try
            {
                connectorEvent = JsonSerializer.Deserialize<ConnectorEvent>(line);
            }
            catch (JsonException)
            {
                continue;
            }
            if (connectorEvent is not null) BeginInvoke(() => HandleEvent(connectorEvent));
        }
    }

    private void HandleEvent(ConnectorEvent connectorEvent)
    {
        switch (connectorEvent.Type)
        {
            case "ready":
                SetStatus(
                    "Ready to connect",
                    connectorEvent.CliDetected != true
                        ? "Tailscale connected · Install Devin for Terminal to access local sessions. Pairing is available."
                        : connectorEvent.SessionDiscoveryEnabled == true
                            ? "Tailscale connected · Devin for Terminal ready"
                            : "Tailscale connected · Devin for Terminal is starting. Pairing is available and sessions reconnect automatically.");
                break;
            case "pairing_offer" when !string.IsNullOrWhiteSpace(connectorEvent.Payload):
                RenderQr(connectorEvent.Payload);
                break;
            case "pairing_review" when connectorEvent.PairingId is not null:
                ReviewPairing(connectorEvent);
                break;
            case "pairing_complete":
                SetStatus("iPhone paired", "Review its permissions below.");
                break;
            case "devices":
                RenderDevices(connectorEvent.Devices ?? []);
                break;
            case "error":
                SetStatus("Needs attention", ErrorCopy(connectorEvent.Code));
                break;
        }
    }

    private void RenderQr(string payload)
    {
        try
        {
            var replacement = QrCodeRenderer.Render(payload);
            var prior = qrImage.Image;
            qrImage.Image = replacement;
            qrImage.Visible = true;
            qrImage.Invalidate();
            qrImage.Update();
            prior?.Dispose();
            SetStatus("Ready to connect", "Scan this pairing code with DevinX on your iPhone.");
        }
        catch (Exception)
        {
            qrImage.Image?.Dispose();
            qrImage.Image = null;
            SetStatus("Pairing code unavailable", "Generate a new code, then try again.");
        }
    }

    private void ReviewPairing(ConnectorEvent connectorEvent)
    {
        var choice = MessageBox.Show(
            this,
            $"Allow {connectorEvent.DeviceName ?? "this iPhone"} to discover local sessions? You can grant history, steering, and session creation separately after pairing.",
            "Pair this iPhone?",
            MessageBoxButtons.YesNo,
            MessageBoxIcon.Question);
        _ = SendCommandAsync(new
        {
            version = 1,
            type = choice == DialogResult.Yes ? "approve" : "deny",
            pairingId = connectorEvent.PairingId,
            allowSessionContent = choice == DialogResult.Yes,
        });
    }

    private void RenderDevices(IReadOnlyList<ConnectorDevice> devices)
    {
        devicesGrid.Rows.Clear();
        foreach (var device in devices.OrderByDescending(item => item.PairedAt))
        {
            var index = devicesGrid.Rows.Add(
                device.DeviceName,
                DateTimeOffset.FromUnixTimeMilliseconds(device.PairedAt).LocalDateTime.ToString("g"),
                device.AllowSessionContent,
                device.AllowSessionPrompt,
                device.AllowSessionCreate);
            devicesGrid.Rows[index].Tag = device.DeviceId;
            devicesGrid.Rows[index].ReadOnly = device.Status != "active";
        }
        var hasDevices = devices.Count > 0;
        devicesTitle.Visible = hasDevices;
        devicesGrid.Visible = hasDevices;
        deviceActions.Visible = hasDevices;
    }

    private async Task SaveSelectedPermissionsAsync()
    {
        var row = devicesGrid.CurrentRow;
        if (row?.Tag is not string deviceId) return;
        await SendCommandAsync(new
        {
            version = 1,
            type = "update_device",
            deviceId,
            allowSessionContent = Convert.ToBoolean(row.Cells["Read"].Value),
            allowSessionPrompt = Convert.ToBoolean(row.Cells["Send"].Value),
            allowSessionCreate = Convert.ToBoolean(row.Cells["Create"].Value),
        });
    }

    private async Task RevokeSelectedDeviceAsync()
    {
        var row = devicesGrid.CurrentRow;
        if (row?.Tag is not string deviceId) return;
        if (MessageBox.Show(this, "Revoke this iPhone?", "Confirm revocation", MessageBoxButtons.YesNo, MessageBoxIcon.Warning) != DialogResult.Yes) return;
        await SendCommandAsync(new { version = 1, type = "revoke_device", deviceId });
    }

    private async Task SendCommandAsync(object command)
    {
        var input = runtime?.StandardInput;
        if (input is null || runtime?.HasExited != false) return;
        var line = JsonSerializer.Serialize(command);
        if (line.Length > MaximumIpcLineCharacters) return;
        await writeLock.WaitAsync();
        try
        {
            await input.WriteLineAsync(line);
            await input.FlushAsync();
        }
        catch (IOException)
        {
            SetStatus("Needs attention", "The Connector runtime is unavailable.");
        }
        finally
        {
            writeLock.Release();
        }
    }

    private void SetStatus(string title, string detail)
    {
        statusLabel.Text = title;
        detailLabel.Text = detail;
    }

    private static string ErrorCopy(string? code) => code switch
    {
        "tailscale_unavailable" => "Connect this PC to Tailscale, then reopen Connector.",
        "unsupported_platform" => "This Windows version is not supported.",
        _ => "Connector could not start. Confirm Tailscale and Devin for Terminal are available.",
    };

    private void HandleFormClosing(object? sender, FormClosingEventArgs eventArgs)
    {
        if (exiting) return;
        if (eventArgs.CloseReason is CloseReason.WindowsShutDown
            or CloseReason.TaskManagerClosing
            or CloseReason.ApplicationExitCall)
        {
            exiting = true;
            trayIcon.Visible = false;
            return;
        }
        eventArgs.Cancel = true;
        Hide();
        trayIcon.ShowBalloonTip(1500, "DevinX Connector", "Connector remains available from the notification area.", ToolTipIcon.Info);
    }

    private void RestoreWindow()
    {
        Show();
        WindowState = FormWindowState.Normal;
        Activate();
    }

    private async Task ExitAsync()
    {
        exiting = true;
        await SendCommandAsync(new { version = 1, type = "shutdown" });
        if (runtime?.HasExited == false && !runtime.WaitForExit(2000)) runtime.Kill(entireProcessTree: true);
        trayIcon.Visible = false;
        Close();
        Application.Exit();
    }

    private async Task InitializeLaunchAtLoginAsync()
    {
        launchAtLoginInitializing = true;
        try
        {
            if (!IsPackaged())
            {
                launchAtLogin.Checked = IsRegistryLaunchAtLoginEnabled();
                return;
            }

            var startupTask = await global::Windows.ApplicationModel.StartupTask.GetAsync(StartupTaskId);
            launchAtLogin.Checked =
                startupTask.State == global::Windows.ApplicationModel.StartupTaskState.Enabled;
        }
        catch
        {
            launchAtLogin.Checked = false;
            launchAtLogin.Enabled = false;
            launchAtLogin.Text = "Open at sign in is unavailable for this installation";
        }
        finally
        {
            launchAtLoginInitializing = false;
        }
    }

    private async Task HandleLaunchAtLoginChangedAsync()
    {
        if (launchAtLoginInitializing) return;
        if (!IsPackaged())
        {
            SetRegistryLaunchAtLogin(launchAtLogin.Checked);
            return;
        }

        launchAtLoginInitializing = true;
        try
        {
            var startupTask = await global::Windows.ApplicationModel.StartupTask.GetAsync(StartupTaskId);
            if (!launchAtLogin.Checked)
            {
                startupTask.Disable();
                return;
            }

            var state = await startupTask.RequestEnableAsync();
            if (state == global::Windows.ApplicationModel.StartupTaskState.Enabled) return;

            launchAtLogin.Checked = false;
            var detail =
                state == global::Windows.ApplicationModel.StartupTaskState.DisabledByUser
                    ? "Windows has disabled this startup task. Re-enable DevinX Connector in Settings > Apps > Startup."
                    : "Windows could not enable DevinX Connector at sign in on this PC.";
            MessageBox.Show(
                this,
                detail,
                "Open at sign in",
                MessageBoxButtons.OK,
                MessageBoxIcon.Information);
        }
        catch
        {
            launchAtLogin.Checked = false;
            MessageBox.Show(
                this,
                "Windows could not update the startup setting. Reopen DevinX Connector and try again.",
                "Open at sign in",
                MessageBoxButtons.OK,
                MessageBoxIcon.Warning);
        }
        finally
        {
            launchAtLoginInitializing = false;
        }
    }

    private static bool IsPackaged()
    {
        try
        {
            return !string.IsNullOrWhiteSpace(
                global::Windows.ApplicationModel.Package.Current.Id.Name);
        }
        catch (InvalidOperationException)
        {
            return false;
        }
    }

    private static bool IsRegistryLaunchAtLoginEnabled()
    {
        using var key = Registry.CurrentUser.OpenSubKey(@"Software\Microsoft\Windows\CurrentVersion\Run", writable: false);
        return key?.GetValue(StartupValueName) is string;
    }

    private static void SetRegistryLaunchAtLogin(bool enabled)
    {
        using var key = Registry.CurrentUser.CreateSubKey(@"Software\Microsoft\Windows\CurrentVersion\Run", writable: true);
        if (enabled) key.SetValue(StartupValueName, $"\"{Application.ExecutablePath}\"");
        else key.DeleteValue(StartupValueName, throwOnMissingValue: false);
    }

    private static void OpenOfficialPage(string url)
    {
        try
        {
            Process.Start(new ProcessStartInfo { FileName = url, UseShellExecute = true });
        }
        catch
        {
            MessageBox.Show(
                "The official DevinX page could not be opened.",
                "DevinX Connector",
                MessageBoxButtons.OK,
                MessageBoxIcon.Warning);
        }
    }
}

internal sealed class ConnectorEvent
{
    [JsonPropertyName("type")] public string? Type { get; init; }
    [JsonPropertyName("payload")] public string? Payload { get; init; }
    [JsonPropertyName("cliDetected")] public bool? CliDetected { get; init; }
    [JsonPropertyName("sessionDiscoveryEnabled")] public bool? SessionDiscoveryEnabled { get; init; }
    [JsonPropertyName("pairingId")] public string? PairingId { get; init; }
    [JsonPropertyName("deviceName")] public string? DeviceName { get; init; }
    [JsonPropertyName("devices")] public List<ConnectorDevice>? Devices { get; init; }
    [JsonPropertyName("code")] public string? Code { get; init; }
}

internal sealed class ConnectorDevice
{
    [JsonPropertyName("deviceId")] public required string DeviceId { get; init; }
    [JsonPropertyName("deviceName")] public required string DeviceName { get; init; }
    [JsonPropertyName("pairedAt")] public long PairedAt { get; init; }
    [JsonPropertyName("status")] public required string Status { get; init; }
    [JsonPropertyName("allowSessionContent")] public bool AllowSessionContent { get; init; }
    [JsonPropertyName("allowSessionPrompt")] public bool AllowSessionPrompt { get; init; }
    [JsonPropertyName("allowSessionCreate")] public bool AllowSessionCreate { get; init; }
}
