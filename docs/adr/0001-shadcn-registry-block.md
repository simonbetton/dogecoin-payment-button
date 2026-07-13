# Distribute as one shadcn registry block

Consumers need editable source rather than a locked npm package. Shipping a single `dogecoin-payment-button` registry block copies the UI, derivation, discovery, and default BlockCypher checker into the host project so developers can modify behavior locally while still installing through the shadcn CLI.
