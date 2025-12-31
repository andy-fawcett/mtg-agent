/**
 * Mock Anthropic SDK to avoid API costs during testing
 *
 * This mock returns realistic responses without making actual API calls.
 * Use this for load tests and most integration tests to save money.
 *
 * For security/jailbreak tests, use the real SDK with a small number of calls.
 */

export const mockAnthropicResponse = {
  id: 'msg_test123',
  type: 'message' as const,
  role: 'assistant' as const,
  content: [
    {
      type: 'text' as const,
      text: 'Flying is a keyword ability in Magic: The Gathering that allows creatures to only be blocked by other creatures with flying or reach.',
    },
  ],
  model: 'claude-sonnet-4-5-20250929',
  stop_reason: 'end_turn' as const,
  usage: {
    input_tokens: 150,
    output_tokens: 50,
  },
};

export const createMockAnthropic = () => ({
  messages: {
    create: jest.fn().mockResolvedValue(mockAnthropicResponse),
  },
});

// Helper to enable/disable mocking
export const mockAnthropicSDK = (enable: boolean = true) => {
  if (enable) {
    jest.mock('@anthropic-ai/sdk', () => ({
      default: jest.fn(() => createMockAnthropic()),
    }));
  } else {
    jest.unmock('@anthropic-ai/sdk');
  }
};
