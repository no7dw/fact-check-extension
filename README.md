# Claim Evidence Layer

Chrome MV3 extension prototype for one-click claim checking on web articles.

Test source:

```text
https://mp.weixin.qq.com/s/JQXlB5QNuQc98XL8Ytu8kQ
```

## Interaction Model

```text
User clicks extension icon
        |
        v
Popup opens
        |
        +-- Analyze current page
        |       |
        |       v
        |   Extract visible article text
        |       |
        |       v
        |   OpenAI claim analysis
        |       |
        |       v
        |   Inject inline highlights
        |
        +-- Open test URL
        |       |
        |       v
        |   Open WeChat article in a new tab
        |
        +-- Analyze URL text directly
                |
                v
            Fetch URL HTML, strip tags, analyze text
```

## Page Overlay

```text
┌──────────────────────────────────────────────────────────────┐
│ Original article page                                         │
│                                                              │
│ 康波周期是由重大技术革命推动的长期经济周期... [Fact 8.2]     │
│                                                              │
│ AI浪潮是新一轮科技革命...                  [Opinion 6.8]     │
│                                                              │
│ 当前正处萧条尾声...                         [Theory 5.5]     │
│                                                              │
│                                      ┌──────────────────┐    │
│                                      │ Evidence Summary │    │
│                                      │ Fact       42%   │    │
│                                      │ Theory     24%   │    │
│                                      │ Opinion    19%   │    │
│                                      └──────────────────┘    │
└──────────────────────────────────────────────────────────────┘
```

## Visual Rules

Confidence uses color:

```text
8.5 - 10.0   green    high confidence
7.0 - 8.4    green    good confidence
5.0 - 6.9    yellow   medium / interpretive
3.0 - 4.9    orange   weak or disputed
0.0 - 2.9    red      unsupported or contradicted
```

Claim type uses font/underline:

```text
Fact              normal text + solid underline
Historical Fact   normal text + double underline
Statistic         monospace text
Theory            italic text
Opinion           serif text
Prediction        dashed underline
```

## Hover Card

```text
┌─────────────────────────────────────┐
│ AI浪潮是新一轮科技革命              │
├─────────────────────────────────────┤
│ Type: Opinion                       │
│ Confidence: 6.8 / 10                │
│ Consensus: Medium-Low               │
│ Verdict: Reasonable but unproven    │
│                                     │
│ • AI investment is growing          │
│ • Productivity impact remains mixed │
│                                     │
│ Click for references                │
└─────────────────────────────────────┘
```

## Click Detail

Click a claim or badge to open the Chrome side panel:

```text
┌───────────────────────────────┬──────────────────────────────┐
│ Web article                    │ Evidence side panel           │
│                               │                              │
│ AI浪潮是新一轮科技革命 [6.8]   │ Claim                         │
│                               │ AI浪潮是新一轮科技革命        │
│                               │                              │
│                               │ Type                          │
│                               │ Opinion + Prediction          │
│                               │                              │
│                               │ Confidence                    │
│                               │ ██████░░░░ 6.8 / 10           │
│                               │                              │
│                               │ Supporting Evidence           │
│                               │ 1. ...                        │
│                               │                              │
│                               │ Counter Evidence              │
│                               │ 1. ...                        │
│                               │                              │
│                               │ References                    │
│                               │ 1. Source URL                 │
└───────────────────────────────┴──────────────────────────────┘
```

## Bring Your Own Key

The extension uses BYOK.

1. Open the extension settings.
2. Paste an OpenAI API key.
3. Save.
4. Run page analysis.

The key is stored in `chrome.storage.local` and sent only as the `Authorization` header to the configured OpenAI endpoint.

## Load In Chrome

1. Open `chrome://extensions`.
2. Enable Developer mode.
3. Click `Load unpacked`.
4. Select this directory.
5. Pin the extension.
6. Open the WeChat test URL.
7. Click the extension icon and choose `Analyze current page`.

## Files

```text
manifest.json       MV3 permissions, content script, side panel
popup.html/js       One-click actions and test URL
options.html/js     BYOK settings
service_worker.js   OpenAI API call and tab orchestration
content_script.js   Text extraction, highlights, hover card
sidepanel.html/js   Claim evidence details
overlay.css         Page overlay styles
ui.css              Extension UI styles
```
# fact-check-extension
