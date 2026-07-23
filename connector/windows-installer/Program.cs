using System.Diagnostics;
using System.IO.Compression;
using System.Reflection;
using System.Runtime.InteropServices;
using Microsoft.Win32;

namespace DevinX.Connector.WindowsInstaller;

internal static class Program
{
    private const string ProductName = "DevinX Connector";
    private const string ProductVersion = "0.1.0";
    private const string PayloadResourceName = "DevinXConnectorPayload.zip";
    private const string ApplicationExecutableName = "DevinX Connector.exe";
    private const string UninstallerExecutableName = "Uninstall DevinX Connector.exe";
    private const string DefaultStartupValueName = "DevinX Connector";
    private const string DefaultUninstallRegistryPath =
        @"Software\Microsoft\Windows\CurrentVersion\Uninstall\DevinX Connector";
    private const string VerificationUninstallRegistryPath =
        @"Software\Microsoft\Windows\CurrentVersion\Uninstall\DevinX Connector Verification";
    private const int MaximumPayloadEntries = 512;
    private const long MaximumPayloadBytes = 300L * 1024L * 1024L;

    private static readonly string? VerificationRoot = ResolveVerificationRoot();
    private static string StartupValueName =>
        VerificationRoot is null ? DefaultStartupValueName : "DevinX Connector Verification";
    private static string UninstallRegistryPath =>
        VerificationRoot is null ? DefaultUninstallRegistryPath : VerificationUninstallRegistryPath;
    private static string LocalAppData =>
        Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData);
    private static string InstallRoot =>
        VerificationRoot is null
            ? Path.Combine(LocalAppData, "Programs", ProductName)
            : Path.Combine(VerificationRoot, "Programs", ProductName);
    private static string StateRoot =>
        VerificationRoot is null
            ? Path.Combine(LocalAppData, "DevinX", "Connector")
            : Path.Combine(VerificationRoot, "State");
    private static string StartMenuShortcut =>
        VerificationRoot is null
            ? Path.Combine(
                Environment.GetFolderPath(Environment.SpecialFolder.Programs),
                $"{ProductName}.lnk")
            : Path.Combine(VerificationRoot, $"{ProductName}.lnk");

    [STAThread]
    private static int Main(string[] args)
    {
        if (!OperatingSystem.IsWindows()) return 2;
        ApplicationConfiguration.Initialize();

        InstallerOptions? options;
        try
        {
            options = InstallerOptions.Parse(args);
        }
        catch (ArgumentException)
        {
            return 2;
        }

        try
        {
            if (options.VerifyPayload)
            {
                VerifyPayload();
                return 0;
            }
            if (options.UninstallFinal)
            {
                UninstallFinal();
                return Succeed(options.Quiet, "DevinX Connector was removed from this Windows account.");
            }
            if (options.Uninstall)
            {
                BeginUninstall(options.Quiet);
                return 0;
            }
            if (!options.Quiet)
            {
                var choice = MessageBox.Show(
                    "Install DevinX Connector for this Windows account?\n\n"
                    + "Connector runs only when you open it or enable its visible launch-at-sign-in setting. "
                    + "It does not install an Administrator service.",
                    "Install DevinX Connector",
                    MessageBoxButtons.OKCancel,
                    MessageBoxIcon.Information);
                if (choice != DialogResult.OK) return 0;
            }

            Install(options.NoLaunch);
            return Succeed(options.Quiet, "DevinX Connector is installed and ready to open.");
        }
        catch
        {
            return Fail(
                options.Quiet,
                "DevinX Connector could not be installed safely. No credentials were requested or changed.");
        }
    }

    private static void Install(bool noLaunch)
    {
        StopInstalledConnector();
        var temporaryRoot = Path.Combine(
            Path.GetTempPath(),
            $"devinx-connector-install-{Guid.NewGuid():N}");
        var extractedRoot = Path.Combine(temporaryRoot, "payload");
        var replacementRoot = Path.Combine(temporaryRoot, "replacement");
        var backupRoot = Path.Combine(temporaryRoot, "backup");
        Directory.CreateDirectory(extractedRoot);

        try
        {
            var payloadRoot = ExtractPayload(extractedRoot);
            CopyDirectory(payloadRoot, replacementRoot);
            var application = Path.Combine(replacementRoot, ApplicationExecutableName);
            if (!File.Exists(application))
            {
                throw new InvalidDataException("The Connector application is missing.");
            }

            var parent = Path.GetDirectoryName(InstallRoot)
                ?? throw new InvalidOperationException("The install path is unavailable.");
            Directory.CreateDirectory(parent);
            if (Directory.Exists(InstallRoot)) Directory.Move(InstallRoot, backupRoot);
            try
            {
                Directory.Move(replacementRoot, InstallRoot);
                CopyCurrentInstaller();
                CreateStartMenuShortcut();
                RegisterUninstaller();
                if (Directory.Exists(backupRoot)) Directory.Delete(backupRoot, recursive: true);
            }
            catch
            {
                if (Directory.Exists(InstallRoot)) Directory.Delete(InstallRoot, recursive: true);
                if (Directory.Exists(backupRoot)) Directory.Move(backupRoot, InstallRoot);
                throw;
            }
        }
        finally
        {
            if (Directory.Exists(temporaryRoot)) Directory.Delete(temporaryRoot, recursive: true);
        }

        if (!noLaunch)
        {
            Process.Start(new ProcessStartInfo
            {
                FileName = Path.Combine(InstallRoot, ApplicationExecutableName),
                WorkingDirectory = InstallRoot,
                UseShellExecute = true,
            });
        }
    }

    private static string ExtractPayload(string destination)
    {
        using var payload = Assembly.GetExecutingAssembly()
            .GetManifestResourceStream(PayloadResourceName)
            ?? throw new InvalidDataException("The Connector payload is unavailable.");
        using var archive = new ZipArchive(payload, ZipArchiveMode.Read, leaveOpen: false);
        if (archive.Entries.Count is 0 or > MaximumPayloadEntries)
        {
            throw new InvalidDataException("The Connector payload is invalid.");
        }

        long totalBytes = 0;
        var topLevels = new HashSet<string>(StringComparer.OrdinalIgnoreCase);
        var destinationPrefix = Path.GetFullPath(destination) + Path.DirectorySeparatorChar;
        foreach (var entry in archive.Entries)
        {
            var normalized = entry.FullName.Replace('\\', '/');
            var segments = normalized.Split('/', StringSplitOptions.RemoveEmptyEntries);
            if (segments.Length == 0) continue;
            if (Path.IsPathRooted(normalized)
                || normalized.Contains(':', StringComparison.Ordinal)
                || segments.Any(segment => segment is "." or "..")
                || IsSymbolicLink(entry))
            {
                throw new InvalidDataException("The Connector payload contains an unsafe path.");
            }
            topLevels.Add(segments[0]);
            totalBytes = checked(totalBytes + entry.Length);
            if (totalBytes > MaximumPayloadBytes)
            {
                throw new InvalidDataException("The Connector payload is too large.");
            }

            var output = Path.GetFullPath(Path.Combine(destination, Path.Combine(segments)));
            if (!output.StartsWith(destinationPrefix, StringComparison.OrdinalIgnoreCase))
            {
                throw new InvalidDataException("The Connector payload escapes its install directory.");
            }
            if (normalized.EndsWith("/", StringComparison.Ordinal))
            {
                Directory.CreateDirectory(output);
                continue;
            }
            var parent = Path.GetDirectoryName(output)
                ?? throw new InvalidDataException("The Connector payload path is invalid.");
            Directory.CreateDirectory(parent);
            using var source = entry.Open();
            using var target = new FileStream(output, FileMode.CreateNew, FileAccess.Write, FileShare.None);
            source.CopyTo(target);
        }

        if (topLevels.Count != 1)
        {
            throw new InvalidDataException("The Connector payload has an invalid root.");
        }
        return Path.Combine(destination, topLevels.Single());
    }

    private static bool IsSymbolicLink(ZipArchiveEntry entry)
    {
        var unixMode = (entry.ExternalAttributes >> 16) & 0xF000;
        return unixMode == 0xA000;
    }

    private static void VerifyPayload()
    {
        var temporaryRoot = Path.Combine(
            Path.GetTempPath(),
            $"devinx-connector-verify-{Guid.NewGuid():N}");
        Directory.CreateDirectory(temporaryRoot);
        try
        {
            var root = ExtractPayload(temporaryRoot);
            foreach (var relativePath in new[]
            {
                ApplicationExecutableName,
                Path.Combine("Resources", "connector-runtime.cjs"),
                Path.Combine("Resources", "runtime", "node.exe"),
                Path.Combine("Resources", "windows-dpapi-helper.exe"),
                "LICENSE.txt",
            })
            {
                if (!File.Exists(Path.Combine(root, relativePath)))
                {
                    throw new InvalidDataException("The Connector payload is incomplete.");
                }
            }
        }
        finally
        {
            Directory.Delete(temporaryRoot, recursive: true);
        }
    }

    private static void CopyDirectory(string source, string destination)
    {
        Directory.CreateDirectory(destination);
        foreach (var directory in Directory.EnumerateDirectories(
            source,
            "*",
            SearchOption.AllDirectories))
        {
            Directory.CreateDirectory(Path.Combine(
                destination,
                Path.GetRelativePath(source, directory)));
        }
        foreach (var file in Directory.EnumerateFiles(source, "*", SearchOption.AllDirectories))
        {
            var target = Path.Combine(destination, Path.GetRelativePath(source, file));
            File.Copy(file, target, overwrite: false);
        }
    }

    private static void CopyCurrentInstaller()
    {
        var current = Environment.ProcessPath
            ?? throw new InvalidOperationException("The installer path is unavailable.");
        File.Copy(
            current,
            Path.Combine(InstallRoot, UninstallerExecutableName),
            overwrite: true);
    }

    private static void RegisterUninstaller()
    {
        using var key = Registry.CurrentUser.CreateSubKey(UninstallRegistryPath, writable: true);
        key.SetValue("DisplayName", ProductName);
        key.SetValue("DisplayVersion", ProductVersion);
        key.SetValue("Publisher", "DevinX");
        key.SetValue("InstallLocation", InstallRoot);
        key.SetValue("DisplayIcon", Path.Combine(InstallRoot, ApplicationExecutableName));
        key.SetValue(
            "UninstallString",
            $"\"{Path.Combine(InstallRoot, UninstallerExecutableName)}\" --uninstall");
        key.SetValue("NoModify", 1, RegistryValueKind.DWord);
        key.SetValue("NoRepair", 1, RegistryValueKind.DWord);
    }

    private static void CreateStartMenuShortcut()
    {
        var shortcut = (IShellLinkW)new ShellLink();
        shortcut.SetPath(Path.Combine(InstallRoot, ApplicationExecutableName));
        shortcut.SetWorkingDirectory(InstallRoot);
        shortcut.SetDescription("Open DevinX Connector");
        shortcut.SetIconLocation(Path.Combine(InstallRoot, ApplicationExecutableName), 0);
        ((IPersistFile)shortcut).Save(StartMenuShortcut, remember: false);
        Marshal.FinalReleaseComObject(shortcut);
    }

    private static void BeginUninstall(bool quiet)
    {
        var current = Environment.ProcessPath
            ?? throw new InvalidOperationException("The uninstaller path is unavailable.");
        var temporary = Path.Combine(
            Path.GetTempPath(),
            $"devinx-connector-uninstall-{Guid.NewGuid():N}.exe");
        File.Copy(current, temporary, overwrite: false);
        var startInfo = new ProcessStartInfo
        {
            FileName = temporary,
            UseShellExecute = true,
        };
        startInfo.ArgumentList.Add("--uninstall-final");
        if (quiet) startInfo.ArgumentList.Add("--quiet");
        Process.Start(startInfo);
    }

    private static void UninstallFinal()
    {
        StopInstalledConnector();
        using (var startup = Registry.CurrentUser.CreateSubKey(
            @"Software\Microsoft\Windows\CurrentVersion\Run",
            writable: true))
        {
            startup.DeleteValue(StartupValueName, throwOnMissingValue: false);
        }
        Registry.CurrentUser.DeleteSubKeyTree(UninstallRegistryPath, throwOnMissingSubKey: false);
        if (File.Exists(StartMenuShortcut)) File.Delete(StartMenuShortcut);
        if (Directory.Exists(InstallRoot)) Directory.Delete(InstallRoot, recursive: true);
        if (Directory.Exists(StateRoot)) Directory.Delete(StateRoot, recursive: true);
        DeleteEmptyParent(Path.GetDirectoryName(StateRoot));
        var current = Environment.ProcessPath;
        if (current is not null) MoveFileEx(current, null, MoveFileDelayUntilReboot);
    }

    private static void StopInstalledConnector()
    {
        var installedApplication = Path.GetFullPath(
            Path.Combine(InstallRoot, ApplicationExecutableName));
        foreach (var process in Process.GetProcessesByName("DevinX Connector"))
        {
            using (process)
            {
                string? path;
                try
                {
                    path = process.MainModule?.FileName;
                }
                catch
                {
                    continue;
                }
                if (!string.Equals(
                    path is null ? null : Path.GetFullPath(path),
                    installedApplication,
                    StringComparison.OrdinalIgnoreCase))
                {
                    continue;
                }
                process.Kill(entireProcessTree: true);
                if (!process.WaitForExit(5_000))
                {
                    throw new IOException("The existing Connector did not stop.");
                }
            }
        }
    }

    private static void DeleteEmptyParent(string? path)
    {
        if (path is not null
            && Directory.Exists(path)
            && !Directory.EnumerateFileSystemEntries(path).Any())
        {
            Directory.Delete(path);
        }
    }

    private static string? ResolveVerificationRoot()
    {
        var configured = Environment.GetEnvironmentVariable(
            "DEVINX_INSTALLER_VERIFICATION_ROOT");
        if (string.IsNullOrWhiteSpace(configured)) return null;

        var fullPath = Path.GetFullPath(configured)
            .TrimEnd(Path.DirectorySeparatorChar, Path.AltDirectorySeparatorChar);
        var temporaryRoot = Path.GetFullPath(Path.GetTempPath())
            .TrimEnd(Path.DirectorySeparatorChar, Path.AltDirectorySeparatorChar);
        if (!string.Equals(
                Path.GetDirectoryName(fullPath),
                temporaryRoot,
                StringComparison.OrdinalIgnoreCase)
            || !Path.GetFileName(fullPath).StartsWith(
                "devinx-windows-verify-",
                StringComparison.OrdinalIgnoreCase))
        {
            throw new InvalidOperationException(
                "The installer verification root must be a dedicated temporary directory.");
        }
        return fullPath;
    }

    private static int Succeed(bool quiet, string message)
    {
        if (!quiet) MessageBox.Show(message, ProductName, MessageBoxButtons.OK, MessageBoxIcon.Information);
        return 0;
    }

    private static int Fail(bool quiet, string message)
    {
        if (!quiet) MessageBox.Show(message, ProductName, MessageBoxButtons.OK, MessageBoxIcon.Error);
        return 1;
    }

    private const int MoveFileDelayUntilReboot = 0x4;

    [DllImport("kernel32.dll", CharSet = CharSet.Unicode, SetLastError = true)]
    [return: MarshalAs(UnmanagedType.Bool)]
    private static extern bool MoveFileEx(
        string existingFileName,
        string? newFileName,
        int flags);

    [ComImport]
    [Guid("00021401-0000-0000-C000-000000000046")]
    private sealed class ShellLink
    {
    }

    [ComImport]
    [InterfaceType(ComInterfaceType.InterfaceIsIUnknown)]
    [Guid("000214F9-0000-0000-C000-000000000046")]
    private interface IShellLinkW
    {
        void GetPath(IntPtr file, int maximumPath, IntPtr findData, uint flags);
        void GetIDList(out IntPtr itemIdentifierList);
        void SetIDList(IntPtr itemIdentifierList);
        void GetDescription(IntPtr name, int maximumName);
        void SetDescription([MarshalAs(UnmanagedType.LPWStr)] string name);
        void GetWorkingDirectory(IntPtr directory, int maximumPath);
        void SetWorkingDirectory([MarshalAs(UnmanagedType.LPWStr)] string directory);
        void GetArguments(IntPtr arguments, int maximumPath);
        void SetArguments([MarshalAs(UnmanagedType.LPWStr)] string arguments);
        void GetHotkey(out short hotkey);
        void SetHotkey(short hotkey);
        void GetShowCmd(out int showCommand);
        void SetShowCmd(int showCommand);
        void GetIconLocation(IntPtr iconPath, int iconPathLength, out int iconIndex);
        void SetIconLocation([MarshalAs(UnmanagedType.LPWStr)] string iconPath, int iconIndex);
        void SetRelativePath([MarshalAs(UnmanagedType.LPWStr)] string path, uint reserved);
        void Resolve(IntPtr windowHandle, uint flags);
        void SetPath([MarshalAs(UnmanagedType.LPWStr)] string path);
    }

    [ComImport]
    [InterfaceType(ComInterfaceType.InterfaceIsIUnknown)]
    [Guid("0000010b-0000-0000-C000-000000000046")]
    private interface IPersistFile
    {
        void GetClassID(out Guid classId);
        [PreserveSig] int IsDirty();
        void Load([MarshalAs(UnmanagedType.LPWStr)] string fileName, uint mode);
        void Save([MarshalAs(UnmanagedType.LPWStr)] string fileName, bool remember);
        void SaveCompleted([MarshalAs(UnmanagedType.LPWStr)] string fileName);
        void GetCurFile([MarshalAs(UnmanagedType.LPWStr)] out string fileName);
    }
}

internal sealed record InstallerOptions(
    bool Uninstall,
    bool UninstallFinal,
    bool VerifyPayload,
    bool Quiet,
    bool NoLaunch)
{
    public static InstallerOptions Parse(string[] args)
    {
        var known = new HashSet<string>(StringComparer.Ordinal)
        {
            "--install",
            "--uninstall",
            "--uninstall-final",
            "--verify-payload",
            "--quiet",
            "--no-launch",
        };
        if (args.Any(argument => !known.Contains(argument))) throw new ArgumentException();
        var operations = new[]
        {
            args.Contains("--install", StringComparer.Ordinal),
            args.Contains("--uninstall", StringComparer.Ordinal),
            args.Contains("--uninstall-final", StringComparer.Ordinal),
            args.Contains("--verify-payload", StringComparer.Ordinal),
        }.Count(value => value);
        if (operations > 1) throw new ArgumentException();
        return new InstallerOptions(
            args.Contains("--uninstall", StringComparer.Ordinal),
            args.Contains("--uninstall-final", StringComparer.Ordinal),
            args.Contains("--verify-payload", StringComparer.Ordinal),
            args.Contains("--quiet", StringComparer.Ordinal),
            args.Contains("--no-launch", StringComparer.Ordinal));
    }
}
