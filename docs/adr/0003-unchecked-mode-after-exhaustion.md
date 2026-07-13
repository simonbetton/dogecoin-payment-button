# Degrade to unchecked mode after discovery exhaustion

After twenty consecutive Used Address results (`0, 19, …, 361` with the default step), the selector displays the final known-used candidate and permanently enters Unchecked Mode for that component instance. Later openings increment by the Address Index Step without usage checks or payment-status UI. Provider failures are different: they show the next unchecked index once, then retry discovery on the next open.
