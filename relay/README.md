# AI relay for Paper Out Loud

A tiny service that lets the app ask Claude for summaries and study notes. It keeps the Claude API key
private, and only people with the passcode can use it. It runs free on Cloudflare; you pay Anthropic for
what Claude uses: roughly 4 cents per paper summary.

## 1. Get a Claude API key (about 5 minutes)

1. Go to https://console.anthropic.com and sign up or sign in.
2. **Billing**: add a payment method and buy a little credit (for example $10).
3. **Limits**: set a monthly spend limit (for example $10) so costs can never surprise you.
4. **API keys**: choose *Create key*, name it `paper-out-loud`, and copy the key (it starts with `sk-ant-`).
   Keep it somewhere safe; you'll paste it in step 2.

## 2. Create the relay on Cloudflare (about 10 minutes)

1. Go to https://dash.cloudflare.com and sign up (the free plan is enough).
2. Open **Workers & Pages**, choose **Create**, then **Create Worker**. Name it `paper-out-loud-ai`, and choose **Deploy**.
3. Choose **Edit code**. Delete everything in the editor, paste in all of
   [`worker.js`](https://raw.githubusercontent.com/Mercury-Mind/paper-out-loud/main/relay/worker.js),
   and choose **Deploy**.
4. Go back to the worker, open **Settings**, then **Variables and secrets**, and add two, each as type **Secret**:
   - `ANTHROPIC_API_KEY`: the key from step 1
   - `APP_PASSCODE`: a long phrase only you choose, like `purple-otter-library-71`
5. Copy the worker's address, shown on its page, like `https://paper-out-loud-ai.yourname.workers.dev`.

## 3. Turn it on in the app

1. Open Paper Out Loud: https://mercury-mind.github.io/paper-out-loud/
2. Open **Settings**. Under **AI summaries**, enter the worker address and the passcode, then choose **Save and test**.
   It should say "Connected".
3. Choose **Copy a setup link** and send that link to anyone who should have AI summaries. Opening it on
   their phone or computer sets everything up, with nothing to type. Treat the link like a password.

## Optional settings (same place as the secrets, as plain text)

- `MODEL`: which Claude model to use. Default is `claude-sonnet-5`.
- `ALLOWED_ORIGINS`: only allow these sites to use the relay, for example `https://mercury-mind.github.io`.

## If something goes wrong

- **"didn't accept the passcode"**: the passcode in the app doesn't match `APP_PASSCODE`.
- **"API key isn't working"**: check the key and your credit at console.anthropic.com.
- **"Couldn't reach the AI relay"**: check the address, which must start with `https://`.
- To stop all use at once, delete the API key in the Anthropic console, or change `APP_PASSCODE`.
