using System.Diagnostics;
using System.Drawing;
using System.Text;
using System.Text.Json;
using System.Text.Json.Serialization;
using Microsoft.Win32;
using QRCoder;

namespace DevinX.Connector.Windows;

internal static class Program
{
    [STAThread]
    private static void Main()
    {
        ApplicationConfiguration.Initialize();
        Application.Run(new ConnectorForm());
    }
}

internal sealed class ConnectorForm : Form
{
    private const int MaximumIpcLineCharacters = 16_384;
    private const string StartupValueName = "DevinX Connector";
    private const string ReleasePage = "https://github.com/fenner888/Devinx/releases/latest";
    private const string SetupGuide =
        "https://github.com/fenner888/Devinx/blob/main/docs/devinx-connector.md";
    private readonly Label statusLabel = new() { AutoSize = true, Font = new Font("Segoe UI", 18, FontStyle.Bold) };
    private readonly Label detailLabel = new() { AutoSize = true, ForeColor = Color.DimGray };
    private readonly PictureBox qrImage = new() { Width = 360, Height = 360, SizeMode = PictureBoxSizeMode.Zoom };
    private readonly Button regenerateButton = new() { Text = "Generate new code", AutoSize = true };
    private readonly CheckBox launchAtLogin = new() { Text = "Open DevinX Connector when I sign in", AutoSize = true };
    private readonly DataGridView devicesGrid = new()
    {
        AllowUserToAddRows = false,
        AllowUserToDeleteRows = false,
        AutoGenerateColumns = false,
        AutoSizeColumnsMode = DataGridViewAutoSizeColumnsMode.Fill,
        MultiSelect = false,
        RowHeadersVisible = false,
        Height = 220,
    };
    private readonly Button savePermissionsButton = new() { Text = "Save permissions", AutoSize = true };
    private readonly Button revokeButton = new() { Text = "Revoke selected iPhone", AutoSize = true };
    private readonly Button releasesButton = new() { Text = "Check official releases", AutoSize = true };
    private readonly Button helpButton = new() { Text = "Setup and uninstall help", AutoSize = true };
    private readonly NotifyIcon trayIcon = new() { Text = "DevinX Connector", Visible = true };
    private readonly SemaphoreSlim writeLock = new(1, 1);
    private Process? runtime;
    private bool exiting;

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
        var devicesTitle = new Label
        {
            Text = "Paired iPhones",
            AutoSize = true,
            Font = new Font("Segoe UI", 14, FontStyle.Bold),
            Margin = new Padding(0, 18, 0, 8),
        };
        var deviceActions = new FlowLayoutPanel { AutoSize = true, FlowDirection = FlowDirection.LeftToRight };
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
        launchAtLogin.CheckedChanged += (_, _) => SetLaunchAtLogin(launchAtLogin.Checked);
        FormClosing += HandleFormClosing;
        Shown += async (_, _) => await StartRuntimeAsync();

        var menu = new ContextMenuStrip();
        menu.Items.Add("Open DevinX Connector", null, (_, _) => RestoreWindow());
        menu.Items.Add("Quit DevinX Connector", null, async (_, _) => await ExitAsync());
        trayIcon.ContextMenuStrip = menu;
        trayIcon.Icon = SystemIcons.Application;
        trayIcon.DoubleClick += (_, _) => RestoreWindow();
        launchAtLogin.Checked = IsLaunchAtLoginEnabled();
        SetStatus("Starting…", "Checking Tailscale and Devin for Terminal");
    }

    private string ResourcePath(string name) => Path.Combine(AppContext.BaseDirectory, "Resources", name);

    private async Task StartRuntimeAsync()
    {
        var node = ResourcePath(Path.Combine("runtime", "node.exe"));
        var script = ResourcePath("connector-runtime.cjs");
        if (!File.Exists(node) || !File.Exists(script))
        {
            SetStatus("Connector runtime unavailable", "Reinstall DevinX Connector from the official signed release.");
            return;
        }

        runtime = new Process
        {
            StartInfo = new ProcessStartInfo
            {
                FileName = node,
                ArgumentList = { script },
                WorkingDirectory = AppContext.BaseDirectory,
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
        try
        {
            if (!runtime.Start()) throw new InvalidOperationException();
            _ = Task.Run(() => DrainErrorsAsync(runtime.StandardError));
            await ReadEventsAsync(runtime.StandardOutput);
        }
        catch
        {
            SetStatus("Connector runtime unavailable", "Confirm this is an official Windows package, then reopen it.");
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
                    connectorEvent.CliDetected == true
                        ? "Tailscale connected · Devin for Terminal detected"
                        : "Tailscale connected · Devin for Terminal unavailable");
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
        using var generator = new QRCodeGenerator();
        using var data = generator.CreateQrCode(payload, QRCodeGenerator.ECCLevel.M);
        var png = new PngByteQRCode(data).GetGraphic(8, drawQuietZones: true);
        using var stream = new MemoryStream(png, writable: false);
        var replacement = new Bitmap(stream);
        var prior = qrImage.Image;
        qrImage.Image = new Bitmap(replacement);
        prior?.Dispose();
        Array.Clear(png);
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

    private static bool IsLaunchAtLoginEnabled()
    {
        using var key = Registry.CurrentUser.OpenSubKey(@"Software\Microsoft\Windows\CurrentVersion\Run", writable: false);
        return key?.GetValue(StartupValueName) is string;
    }

    private static void SetLaunchAtLogin(bool enabled)
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
