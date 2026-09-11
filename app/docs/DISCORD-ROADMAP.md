# Discord launch plan

## Recommended first release

Keep the first Discord version intentionally small:

1. Enable Activities and retain Discord's managed Entry Point command. Discord opens the Activity and posts its standard launch message in the channel.
2. Authenticate the player with `identify` inside the Activity. Solo play must continue if Discord authentication fails.
3. Keep completed results private until the player chooses **Challenge your friends** from Results or History.
4. Create or reuse the stable challenge ID already stored by the challenge service.
5. Generate one branded result image and a quick Activity link for that challenge, then open Discord's native share chooser. The player selects the destination channel, DM, or group DM.
6. Anyone opening the link receives the same puzzle family and may choose difficulty. Their verified completion is added to the challenge service.
7. History loads comparison results from the challenge service. It does not scrape Discord messages.

This release does not need a bot user, a custom server/channel picker, message-history access, scheduled recaps, or a new account system.

## The result graphic

Avoid a single opaque score. The recommended card has:

- puzzle type, difficulty, and short challenge ID;
- the player's avatar or initials;
- active solve time;
- first-entry accuracy;
- hints, checks, reveals, and autofill status;
- an assistance label;
- a theme-aware 9×9 "solve trail" made from entry order and accuracy, never the solution itself;
- a **Play this puzzle** launch link.

For group comparisons, give each player a vertical trail or compact 9×9 tile with their strongest dimension called out: **precision**, **independent solve**, **hard mode**, or **pace**. This matches the product's "more than one kind of win" positioning better than ranking everyone by one number.

## Phase two: a living channel card

Add a guild-installed bot only when testing proves the group card is worth the extra permission and operational work.

When a user creates a channel challenge, store:

- Discord guild ID;
- Discord channel ID;
- Discord message ID;
- *doku challenge ID;
- creator Discord user ID;
- card status and update timestamp.

When another result is submitted, regenerate the comparison image and edit the known bot message. Debounce bursts of finishes so the card is not updated more than once every few seconds.

Proposed bot permissions, scoped to selected game channels:

- View Channel;
- Send Messages;
- Embed Links;
- Attach Files.

Do not request Administrator. Do not request Read Message History if the service stores the message ID it created. Use `applications.commands` for `/doku`, `/challenge`, and `/standings` style interactions.

## Accounts and history

Launch with two modes:

- **Guest:** browser-local preferences, unfinished puzzle, and history.
- **Continue with Discord:** one *doku profile keyed by Discord user ID, used on the website and automatically recognized inside the Activity.

This is enough for cross-device and cross-server history. Do not build email/password accounts or a *doku friend-discovery network. Discord already supplies the social context.

For channel-specific history, record the destination guild/channel when a bot posts a challenge or when a Discord interaction supplies that context. Show those results only when the current Discord context or authorized user permits it. A challenge may be shared again through the native share chooser to reach another server; a custom server/channel dropdown can remain parked unless users specifically need it.

## Parking lot

- daily or weekly opt-in recaps;
- server streaks based on at least one completed shared puzzle per local day;
- channel seasons and themed badges;
- a multi-server destination picker;
- scheduled challenge prompts;
- private leagues or teams;
- native *doku friends and discovery;
- anti-cheat or competitive leaderboards;
- user-selectable accent palettes for every visual theme.

## Developer Portal checklist

- Application ID: `1548073007950602303`.
- Enable Activities.
- Add the deployed origin as the Activity URL mapping.
- Keep the default Entry Point command while Discord should own the launch message.
- Add the production OAuth redirect URI used by `/api/discord/token`.
- Configure a Discord Provided Install Link with `applications.commands` for the first release.
- Add `bot` only when implementing the living channel card.
- Add an Interactions Endpoint URL before custom commands or message components are enabled.
- Test desktop, mobile, text channel, voice channel, DM limitations, revoked access, and a channel where the user cannot send messages.
