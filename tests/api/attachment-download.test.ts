const mockDownloadFileAsync = jest.fn();
const mockDeleteFile = jest.fn();

jest.mock('expo-file-system', () => {
  class Directory {
    uri: string;
    exists = true;

    constructor(...parts: Array<{ uri?: string } | string>) {
      this.uri = parts.map((part) => (typeof part === 'string' ? part : part.uri)).join('/');
    }

    create() {}
  }

  class File {
    static downloadFileAsync(...args: unknown[]) {
      return mockDownloadFileAsync(...args);
    }
    uri: string;
    exists = false;
    size = 10;

    constructor(...parts: Array<{ uri?: string } | string>) {
      this.uri = parts.map((part) => (typeof part === 'string' ? part : part.uri)).join('/');
    }

    delete() {
      mockDeleteFile(this.uri);
    }
  }

  return { Directory, File, Paths: { cache: { uri: 'file:///cache' } } };
});

import { downloadSessionAttachment } from '../../src/api/devin/attachment-download';
import type { AuthProvider } from '../../src/auth/AuthProvider';
import type { SessionAttachment } from '../../src/api/devin/types';

const authHeaders = jest.fn(async () => ({ Authorization: 'Bearer redacted-test-key' }));
const orgPath = jest.fn(async () => '/v3/organizations/org-test');
const auth = { authHeaders, orgPath } as unknown as AuthProvider;

function attachment(url: string): SessionAttachment {
  return {
    attachment_id: 'attachment-1',
    name: 'screen.png',
    source: 'devin',
    url,
    content_type: 'image/png',
  };
}

describe('authenticated attachment downloads', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockDownloadFileAsync.mockImplementation(async (_url, destination) => ({
      ...destination,
      uri: destination.uri,
      size: 10,
      delete: () => mockDeleteFile(destination.uri),
    }));
  });

  it('converts web-app attachment URLs to the documented organization API endpoint', async () => {
    await downloadSessionAttachment(
      auth,
      attachment('https://app.devin.ai/attachments/id/screen.png'),
    );

    expect(authHeaders).toHaveBeenCalledTimes(1);
    expect(orgPath).toHaveBeenCalledTimes(1);
    expect(mockDownloadFileAsync).toHaveBeenCalledWith(
      'https://api.devin.ai/v3/organizations/org-test/attachments/id/screen.png',
      expect.anything(),
      expect.objectContaining({
        headers: { Authorization: 'Bearer redacted-test-key' },
        idempotent: true,
      }),
    );
  });

  it('preserves encoded attachment names when constructing the API endpoint', async () => {
    await downloadSessionAttachment(
      auth,
      attachment('https://app.devin.ai/attachments/id/demo%20video.mp4'),
    );

    expect(mockDownloadFileAsync).toHaveBeenCalledWith(
      'https://api.devin.ai/v3/organizations/org-test/attachments/id/demo%20video.mp4',
      expect.anything(),
      expect.objectContaining({ headers: { Authorization: 'Bearer redacted-test-key' } }),
    );
  });

  it('rejects unsupported web-app paths instead of sending the credential to them', async () => {
    await expect(
      downloadSessionAttachment(auth, attachment('https://app.devin.ai/other/id/screen.png')),
    ).rejects.toThrow('Attachment URL is not supported');

    expect(authHeaders).not.toHaveBeenCalled();
    expect(mockDownloadFileAsync).not.toHaveBeenCalled();
  });

  it('never forwards the provider credential to an arbitrary attachment host', async () => {
    await downloadSessionAttachment(auth, attachment('https://cdn.example.com/screen.png'));

    expect(authHeaders).not.toHaveBeenCalled();
    expect(orgPath).not.toHaveBeenCalled();
    expect(mockDownloadFileAsync).toHaveBeenCalledWith(
      'https://cdn.example.com/screen.png',
      expect.anything(),
      expect.objectContaining({ headers: undefined }),
    );
  });
});
