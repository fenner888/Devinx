import { Alert, Modal, Pressable, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as DocumentPicker from 'expo-document-picker';
import * as ImagePicker from 'expo-image-picker';
import { useTheme } from '@theme/index';

const MAX_ATTACHMENT_BYTES = 100 * 1024 * 1024;

export interface PickedAttachment {
  name: string;
  type: string;
  uri: string;
}

interface AttachmentPickerSheetProps {
  visible: boolean;
  onClose: () => void;
  onPick: (file: PickedAttachment) => void | Promise<void>;
}

function withinSizeLimit(size?: number): boolean {
  if (!size || size <= MAX_ATTACHMENT_BYTES) return true;
  Alert.alert('File too large', 'Attachments must be 100 MB or smaller.');
  return false;
}

export function AttachmentPickerSheet({ visible, onClose, onPick }: AttachmentPickerSheetProps) {
  const insets = useSafeAreaInsets();
  const { tokens } = useTheme();

  async function pickPhotoOrVideo() {
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images', 'videos'],
        quality: 1,
      });
      const asset = result.assets?.[0];
      if (result.canceled || !asset) {
        onClose();
        return;
      }
      onClose();
      if (!withinSizeLimit(asset.fileSize)) return;
      await onPick({
        name: asset.fileName ?? (asset.type === 'video' ? 'video.mov' : 'photo.jpg'),
        type: asset.mimeType ?? (asset.type === 'video' ? 'video/quicktime' : 'image/jpeg'),
        uri: asset.uri,
      });
    } catch (error) {
      onClose();
      Alert.alert(
        'Could not select media',
        error instanceof Error ? error.message : 'Unknown error',
      );
    }
  }

  async function pickFile() {
    try {
      const result = await DocumentPicker.getDocumentAsync({ copyToCacheDirectory: true });
      const asset = result.assets?.[0];
      if (result.canceled || !asset) {
        onClose();
        return;
      }
      onClose();
      if (!withinSizeLimit(asset.size)) return;
      await onPick({
        name: asset.name,
        type: asset.mimeType ?? 'application/octet-stream',
        uri: asset.uri,
      });
    } catch (error) {
      onClose();
      Alert.alert(
        'Could not select file',
        error instanceof Error ? error.message : 'Unknown error',
      );
    }
  }

  return (
    <Modal
      visible={visible}
      transparent
      statusBarTranslucent
      animationType="slide"
      onRequestClose={onClose}
    >
      <Pressable
        className="flex-1 bg-scrim justify-end"
        onPress={onClose}
        accessibilityLabel="Close attachment menu"
      >
        <View
          className="bg-surface2 rounded-t-sheet px-5 pt-4"
          style={{ paddingBottom: Math.max(insets.bottom, 16) }}
          accessibilityViewIsModal
        >
          <View className="flex-row items-center justify-between mb-3">
            <Text className="text-text-hi text-text17">Add attachment</Text>
            <Pressable
              onPress={onClose}
              accessibilityRole="button"
              accessibilityLabel="Close attachment menu"
            >
              <Ionicons name="close" size={20} color={tokens.textMid.hex} />
            </Pressable>
          </View>
          <Pressable
            className="flex-row items-center bg-surface1 rounded-card px-4 py-3 mb-2"
            onPress={pickPhotoOrVideo}
            accessibilityRole="button"
            accessibilityLabel="Choose photo or video"
          >
            <Ionicons name="images-outline" size={20} color={tokens.brandText.hex} />
            <Text className="text-text-hi text-text14 ml-3">Photo or video</Text>
          </Pressable>
          <Pressable
            className="flex-row items-center bg-surface1 rounded-card px-4 py-3 mb-2"
            onPress={pickFile}
            accessibilityRole="button"
            accessibilityLabel="Choose file"
          >
            <Ionicons name="document-attach-outline" size={20} color={tokens.brandText.hex} />
            <Text className="text-text-hi text-text14 ml-3">File</Text>
          </Pressable>
        </View>
      </Pressable>
    </Modal>
  );
}
