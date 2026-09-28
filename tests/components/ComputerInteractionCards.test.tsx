import { fireEvent, render } from '@testing-library/react-native';
import { ScrollView, Text, View } from 'react-native';

import type {
  ComputerElicitationInteraction,
  ComputerSessionPermission,
} from '../../src/auth/computerBridge';
import { ComputerElicitationCard } from '../../src/components/sessions/ComputerElicitationCard';
import { ComputerInteractionDock } from '../../src/components/sessions/ComputerInteractionDock';
import { ComputerPermissionCard } from '../../src/components/sessions/ComputerPermissionCard';
import { ComputerTerminalQuestionCard } from '../../src/components/sessions/ComputerTerminalQuestionCard';
import { ThemeProvider } from '../../src/theme/ThemeProvider';

const interaction: ComputerElicitationInteraction = {
  id: `interaction_${'Q'.repeat(43)}`,
  message: 'Which approach should I use?',
  fields: [
    {
      key: 'approach',
      type: 'single_select',
      title: 'Approach',
      required: true,
      allowOther: true,
      maxLength: 200,
      options: [
        { value: 'safe', label: 'Preserve the API' },
        { value: 'migrate', label: 'Migrate the API' },
      ],
    },
  ],
  createdAt: 1,
};

const permission: ComputerSessionPermission = {
  id: `permission_${'P'.repeat(43)}`,
  title: 'Run a command',
  command: 'git status --short',
  paths: ['src/index.ts'],
  decisions: ['allow_once', 'reject_once'],
  createdAt: 1,
  expiresAt: 2,
};

describe('local computer interaction cards', () => {
  it('clears free text when selecting an option and submits Other text when entered', () => {
    const onRespond = jest.fn();
    const screen = render(
      <ThemeProvider>
        <ComputerElicitationCard
          interaction={interaction}
          pending={false}
          onRespond={onRespond}
        />
      </ThemeProvider>,
    );
    const otherInput = screen.getByLabelText('Other answer: Approach');

    fireEvent.changeText(otherInput, 'Neither — list the files');
    expect(screen.getByLabelText('Approach: Preserve the API').props.accessibilityState.checked).toBe(
      false,
    );
    fireEvent.press(screen.getByLabelText('Approach: Preserve the API'));
    expect(screen.getByLabelText('Other answer: Approach').props.value).toBe('');

    fireEvent.changeText(screen.getByLabelText('Other answer: Approach'), 'Neither — list files');
    expect(screen.getByLabelText('Approach: Preserve the API').props.accessibilityState.checked).toBe(
      false,
    );
    fireEvent.press(screen.getByLabelText('Send answer to Devin'));

    expect(onRespond).toHaveBeenCalledWith({
      interactionId: interaction.id,
      action: 'accept',
      content: { approach: 'Neither — list files' },
    });
  });

  it('shows only permission decisions offered by the Connector', () => {
    const onRespond = jest.fn();
    const screen = render(
      <ThemeProvider>
        <ComputerPermissionCard
          permission={permission}
          pending={false}
          onRespond={onRespond}
        />
      </ThemeProvider>,
    );

    expect(screen.getByText('Devin wants to run a command')).toBeTruthy();
    expect(screen.getByLabelText('Deny command')).toBeTruthy();
    expect(screen.getByLabelText('Allow command once')).toBeTruthy();
    expect(screen.queryByLabelText('Allow command for this session')).toBeNull();
    fireEvent.press(screen.getByLabelText('Allow command once'));
    expect(onRespond).toHaveBeenCalledWith('allow_once');
  });

  it('renders the Terminal question as read-only and names the computer', () => {
    const screen = render(
      <ThemeProvider>
        <ComputerTerminalQuestionCard
          question={{
            question: 'Which files should I inspect?',
            header: 'Files',
            options: ['All files', 'Changed files'],
            multiSelect: false,
          }}
          computerName="My Mac"
        />
      </ThemeProvider>,
    );

    expect(screen.getByText('Which files should I inspect?')).toBeTruthy();
    expect(screen.getByText('Answer in Terminal on My Mac')).toBeTruthy();
    expect(screen.getByLabelText('All files').props.accessibilityState.disabled).toBe(true);
  });

  it('keeps an interaction card in the dock rather than the history scroll view', () => {
    const screen = render(
      <ThemeProvider>
        <View>
          <ScrollView testID="computer-session-history">
            <Text>History message</Text>
          </ScrollView>
          <ComputerInteractionDock bottom={160} maxHeight={360} onHeightChange={jest.fn()}>
            <ComputerElicitationCard
              interaction={interaction}
              pending={false}
              onRespond={jest.fn()}
            />
          </ComputerInteractionDock>
        </View>
      </ThemeProvider>,
    );
    let ancestor: ReturnType<typeof screen.getByText> | null =
      screen.getByText('Devin needs your input');
    let foundDock = false;
    let foundHistory = false;

    while (ancestor) {
      if (ancestor.props.testID === 'computer-interaction-dock') foundDock = true;
      if (ancestor.props.testID === 'computer-session-history') foundHistory = true;
      ancestor = ancestor.parent;
    }

    expect(foundDock).toBe(true);
    expect(foundHistory).toBe(false);
    expect(screen.getByTestId('computer-interaction-dock').props.style).toEqual({
      bottom: 160,
      maxHeight: 360,
    });
  });
});
