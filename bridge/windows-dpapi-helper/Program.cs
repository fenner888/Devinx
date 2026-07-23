using System.Runtime.InteropServices;
using System.Security.Cryptography;
using System.Security.Cryptography.X509Certificates;
using System.Text;
using System.Text.Json;

namespace DevinX.WindowsDpapiHelper;

internal static class Program
{
    private const int ItemNotFoundExitCode = 44;
    private const int MaximumSecretBytes = 1024 * 1024;
    private const uint CryptProtectUiForbidden = 0x1;
    private static readonly byte[] Entropy = Encoding.UTF8.GetBytes("com.devinx.connector.bridge-state-v1");

    private static string StatePath => Path.Combine(
        Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData),
        "DevinX",
        "Connector",
        "bridge-state-v1.dpapi");

    [STAThread]
    private static int Main(string[] args)
    {
        if (!OperatingSystem.IsWindows() || args.Length != 1)
        {
            return 2;
        }

        try
        {
            return args[0] switch
            {
                "get" => Get(),
                "set" => Set(),
                "delete" => Delete(),
                "generate-tls" => GenerateTlsIdentity(),
                _ => 2,
            };
        }
        catch
        {
            return 1;
        }
    }

    private static int Get()
    {
        if (!File.Exists(StatePath)) return ItemNotFoundExitCode;
        var protectedBytes = File.ReadAllBytes(StatePath);
        if (protectedBytes.Length == 0 || protectedBytes.Length > MaximumSecretBytes + 16_384)
        {
            CryptographicOperations.ZeroMemory(protectedBytes);
            return 1;
        }

        byte[]? plaintext = null;
        try
        {
            plaintext = Unprotect(protectedBytes);
            if (plaintext.Length == 0 || plaintext.Length > MaximumSecretBytes) return 1;
            using var output = Console.OpenStandardOutput();
            output.Write(plaintext, 0, plaintext.Length);
            output.WriteByte((byte)'\n');
            return 0;
        }
        finally
        {
            CryptographicOperations.ZeroMemory(protectedBytes);
            if (plaintext is not null) CryptographicOperations.ZeroMemory(plaintext);
        }
    }

    private static int Set()
    {
        byte[]? plaintext = null;
        byte[]? protectedBytes = null;
        string? temporaryPath = null;
        try
        {
            plaintext = ReadBoundedStandardInput();
            if (plaintext.Length == 0) return 1;
            protectedBytes = Protect(plaintext);
            var directory = Path.GetDirectoryName(StatePath);
            if (string.IsNullOrWhiteSpace(directory)) return 1;
            Directory.CreateDirectory(directory);
            temporaryPath = Path.Combine(directory, $".bridge-state-{Guid.NewGuid():N}.tmp");
            using (var stream = new FileStream(
                temporaryPath,
                FileMode.CreateNew,
                FileAccess.Write,
                FileShare.None,
                4096,
                FileOptions.WriteThrough))
            {
                stream.Write(protectedBytes, 0, protectedBytes.Length);
                stream.Flush(flushToDisk: true);
            }
            File.Move(temporaryPath, StatePath, overwrite: true);
            temporaryPath = null;
            return 0;
        }
        finally
        {
            if (temporaryPath is not null) File.Delete(temporaryPath);
            if (plaintext is not null) CryptographicOperations.ZeroMemory(plaintext);
            if (protectedBytes is not null) CryptographicOperations.ZeroMemory(protectedBytes);
        }
    }

    private static int Delete()
    {
        if (!File.Exists(StatePath)) return ItemNotFoundExitCode;
        File.Delete(StatePath);
        var directory = Path.GetDirectoryName(StatePath);
        if (directory is not null && Directory.Exists(directory) && !Directory.EnumerateFileSystemEntries(directory).Any())
        {
            Directory.Delete(directory);
        }
        return 0;
    }

    private static int GenerateTlsIdentity()
    {
        using var privateKey = RSA.Create(2048);
        var request = new CertificateRequest(
            "CN=DevinX Desktop Bridge",
            privateKey,
            HashAlgorithmName.SHA256,
            RSASignaturePadding.Pkcs1);
        request.CertificateExtensions.Add(
            new X509BasicConstraintsExtension(
                certificateAuthority: false,
                hasPathLengthConstraint: false,
                pathLengthConstraint: 0,
                critical: true));
        request.CertificateExtensions.Add(
            new X509KeyUsageExtension(
                X509KeyUsageFlags.DigitalSignature | X509KeyUsageFlags.KeyEncipherment,
                critical: true));
        var enhancedKeyUsages = new OidCollection
        {
            new Oid("1.3.6.1.5.5.7.3.1"),
        };
        request.CertificateExtensions.Add(
            new X509EnhancedKeyUsageExtension(enhancedKeyUsages, critical: true));

        var createdAt = DateTimeOffset.UtcNow;
        using var certificate = request.CreateSelfSigned(
            createdAt.AddMinutes(-1),
            createdAt.AddDays(365));
        var output = JsonSerializer.SerializeToUtf8Bytes(new
        {
            certificatePem = certificate.ExportCertificatePem(),
            privateKeyPem = privateKey.ExportPkcs8PrivateKeyPem(),
            createdAt = createdAt.ToUnixTimeMilliseconds(),
        });
        try
        {
            using var stdout = Console.OpenStandardOutput();
            stdout.Write(output, 0, output.Length);
            stdout.WriteByte((byte)'\n');
            return 0;
        }
        finally
        {
            CryptographicOperations.ZeroMemory(output);
        }
    }

    private static byte[] ReadBoundedStandardInput()
    {
        using var input = Console.OpenStandardInput();
        using var buffer = new MemoryStream();
        var chunk = new byte[8192];
        try
        {
            while (true)
            {
                var read = input.Read(chunk, 0, chunk.Length);
                if (read == 0) break;
                if (buffer.Length + read > MaximumSecretBytes) throw new InvalidDataException();
                buffer.Write(chunk, 0, read);
            }
            return buffer.ToArray();
        }
        finally
        {
            CryptographicOperations.ZeroMemory(chunk);
        }
    }

    private static byte[] Protect(byte[] plaintext)
    {
        using var input = DataBlob.FromBytes(plaintext);
        using var entropy = DataBlob.FromBytes(Entropy);
        if (!CryptProtectData(
            ref input.Value,
            "DevinX Connector protected state",
            ref entropy.Value,
            IntPtr.Zero,
            IntPtr.Zero,
            CryptProtectUiForbidden,
            out var output))
        {
            throw new CryptographicException(Marshal.GetLastWin32Error());
        }
        return CopyAndFree(output);
    }

    private static byte[] Unprotect(byte[] protectedBytes)
    {
        using var input = DataBlob.FromBytes(protectedBytes);
        using var entropy = DataBlob.FromBytes(Entropy);
        if (!CryptUnprotectData(
            ref input.Value,
            IntPtr.Zero,
            ref entropy.Value,
            IntPtr.Zero,
            IntPtr.Zero,
            CryptProtectUiForbidden,
            out var output))
        {
            throw new CryptographicException(Marshal.GetLastWin32Error());
        }
        return CopyAndFree(output);
    }

    private static byte[] CopyAndFree(NativeDataBlob blob)
    {
        try
        {
            if (blob.Size <= 0 || blob.Size > MaximumSecretBytes + 16_384) throw new CryptographicException();
            var result = new byte[blob.Size];
            Marshal.Copy(blob.Data, result, 0, blob.Size);
            return result;
        }
        finally
        {
            if (blob.Data != IntPtr.Zero) LocalFree(blob.Data);
        }
    }

    [StructLayout(LayoutKind.Sequential)]
    private struct NativeDataBlob
    {
        public int Size;
        public IntPtr Data;
    }

    private sealed class DataBlob : IDisposable
    {
        public NativeDataBlob Value;

        private DataBlob(byte[] bytes)
        {
            Value = new NativeDataBlob
            {
                Size = bytes.Length,
                Data = Marshal.AllocHGlobal(bytes.Length),
            };
            Marshal.Copy(bytes, 0, Value.Data, bytes.Length);
        }

        public static DataBlob FromBytes(byte[] bytes) => new(bytes);

        public void Dispose()
        {
            if (Value.Data == IntPtr.Zero) return;
            var zeros = new byte[Value.Size];
            Marshal.Copy(zeros, 0, Value.Data, zeros.Length);
            Marshal.FreeHGlobal(Value.Data);
            Value = default;
        }
    }

    [DllImport("crypt32.dll", SetLastError = true, CharSet = CharSet.Unicode)]
    [return: MarshalAs(UnmanagedType.Bool)]
    private static extern bool CryptProtectData(
        ref NativeDataBlob dataIn,
        string description,
        ref NativeDataBlob optionalEntropy,
        IntPtr reserved,
        IntPtr promptStruct,
        uint flags,
        out NativeDataBlob dataOut);

    [DllImport("crypt32.dll", SetLastError = true)]
    [return: MarshalAs(UnmanagedType.Bool)]
    private static extern bool CryptUnprotectData(
        ref NativeDataBlob dataIn,
        IntPtr description,
        ref NativeDataBlob optionalEntropy,
        IntPtr reserved,
        IntPtr promptStruct,
        uint flags,
        out NativeDataBlob dataOut);

    [DllImport("kernel32.dll")]
    private static extern IntPtr LocalFree(IntPtr memory);
}
