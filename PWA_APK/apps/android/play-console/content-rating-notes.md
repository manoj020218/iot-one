# Play Console — Content Rating questionnaire prep notes

Play's content rating is an interactive IARC questionnaire inside Play
Console (Policy → App content → Content ratings) — I can't fill it in for
you since it requires your account, but here's how the honest answers should
land for this app based on what it actually is and does:

- **Category**: Utility / productivity / IoT device management — not a game.
- **Violence, sexual content, profanity, gambling, controlled substances**:
  None — this app has no user-generated content feed, no chat between
  strangers, no in-app purchases of any of the above.
- **User-generated content / communication between users**: The School Bell
  push-to-talk feature streams a user's own mic audio to their **own**
  device on their **own** local network — it is not a chat feature between
  different app users, so it should not trigger the "users interact/share
  content" branch of the questionnaire. Answer that branch based on whether
  any feature lets one Jenix One account message or share content with a
  *different* account — if Home/member-sharing features do that (inviting
  another person to a Home), answer honestly for that feature instead.
- **Location**: The questionnaire may separately ask about location access
  — see `data-safety-notes.md`'s note on `ACCESS_FINE_LOCATION` being
  required for Wi-Fi SSID reading, not GPS use.
- **Ads**: None present in the app (checked, see `data-safety-notes.md`).

Expected result: this should qualify for the lowest content rating tier in
every region (e.g. "Everyone" / "3+" equivalent), but only the actual
questionnaire inside Play Console produces the real, submittable rating —
don't skip it even though the expected outcome is straightforward.
