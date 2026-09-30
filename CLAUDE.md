# D-SLIDE（リポジトリ名は kazukakushi のまま）

T.OF... のアプリ。https://t-of.github.io/kazukakushi/

- ルールは本部の `~/GitHub/tof/t-of.github.io/RULES.md` に従う（全アプリ共通）。ブランドは `docs/BRAND.md`。
- 直したら本部で `npm run audit:browser -- kazukakushi` を通す。
- 公開は本部の `docs/RELEASE.md` の手順。大きな作業は本部で Claude を起動すると、役割を分けて進められる。
- localStorage のキーは `kazukakushi.` で始める。SW のキャッシュ名は `kazukakushi-` で始める。
