# Dogecoin Payment

Installable UI and browser-safe derivation for accepting Dogecoin payments from a dedicated BIP44 account public key.

## Language

**Payment Address**: A mainnet Dogecoin P2PKH receive address shown to an end user so they can pay. _Avoid_: wallet address, invoice address

**Address Candidate**: A derived receive address at a specific address index that may be checked for prior use before display. _Avoid_: gap address, next address

**Used Address**: An Address Candidate with any confirmed or mempool transaction history (`final_n_tx > 0`). _Avoid_: spent address, dirty address

**Address Index Step**: The fixed distance between Address Candidates during discovery. Default is 19, producing the sequence `0, 19, 38, …`. _Avoid_: SKIP_GAP, gap limit

**Address Usage Checker**: A swappable function that reports whether an Address Candidate is a Used Address. _Avoid_: backend, explorer client

**Unchecked Mode**: A permanent degraded mode after discovery exhaustion where later openings increment the index without calling the Address Usage Checker. _Avoid_: gap exceeded mode, offline mode

**Account Public Key**: A BIP44 account-level extended public key at `m/44'/3'/0'`, encoded as `dgub` or `xpub`, used only for receive-address derivation. _Avoid_: master key, root xpub, wallet seed

**Mempool Watch**: A one-shot SSE session that waits for unconfirmed receiving outputs to a Payment Address, optionally filtered by `minValueBase`. _Avoid_: confirmation poll, websocket listener

**Appeared Payment**: A qualifying transaction observed in the mempool for the watched Payment Address. Treat as “seen,” not confirmed. _Avoid_: paid, settled, confirmed payment
