# llm.summarize

Summarizes text with deterministic extractive summarization.

## Capability

`llm.summarize` splits input text into sentences, takes the first configured number of sentences, and optionally truncates the summary by character count.

## Input

| Field | Required | Type | Description |
| --- | --- | --- | --- |
| `text` | Yes | string | Text to summarize. This commonly references an upstream output such as `{{steps.read.output.content}}` or `{{steps.prompt.output.text}}`. |

## Output

| Field | Type | Description |
| --- | --- | --- |
| `summary` | string | Generated summary text. |
| `sentenceCount` | number | Number of sentences detected in the source text, or configured mock sentence count. |

## Config

| Field | Type | Description |
| --- | --- | --- |
| `providerId` | string | Optional node-level provider override. When set, `modelId` must also be set. |
| `modelId` | string | Optional node-level model override for the selected provider. |
| `maxSentences` | number | Maximum number of sentences to include. Defaults to `3`. Minimum `1`. |
| `maxChars` | number | Optional maximum summary length. Minimum `1`. |

## Mock Config

Mock mode is enabled with `config.mock.enabled: true`.

| Field | Type | Description |
| --- | --- | --- |
| `mock.enabled` | boolean | Enables deterministic mock output. |
| `mock.summary` | string | Summary returned as `output.summary`. Defaults to an empty string. |
| `mock.sentenceCount` | number | Optional sentence count. Defaults to the number of sentences in `mock.summary`. |

## YAML

~~~yaml
steps:
  - id: summarize
    type: llm.summarize
    input:
      text: "First sentence. Second sentence. Third sentence."
    config:
      maxSentences: 2
~~~

## Connected YAML

~~~yaml
steps:
  - id: prompt
    type: llm.prompt
    input:
      prompt: "Write a short implementation plan."

  - id: summarize
    type: llm.summarize
    input:
      text: "{{steps.prompt.output.text}}"
    config:
      maxSentences: 2
~~~

## Mock YAML

~~~yaml
steps:
  - id: summarize
    type: llm.summarize
    input:
      text: "{{steps.prompt.output.text}}"
    config:
      mock:
        enabled: true
        summary: "Mocked summary."
        sentenceCount: 1
~~~
