import { Interface } from 'ethers';
const erc20 = new Interface(['event Transfer(address indexed from,address indexed to,uint256 value)']);
const lower = value => String(value || '').toLowerCase();
/** Read only successful logs emitted by this token, for this wallet. */
export function walletTransfer(receipt, token, wallet) {
  let received = 0n, sent = 0n;
  if (Number(receipt?.status) !== 1 || !wallet) return {received, sent, net: 0n};
  for (const log of receipt.logs || []) {
    if (lower(log.address) !== lower(token)) continue;
    try {
      const event = erc20.parseLog(log);
      if (!event || event.name !== 'Transfer') continue;
      if (lower(event.args.to) === lower(wallet)) received += event.args.value;
      if (lower(event.args.from) === lower(wallet)) sent += event.args.value;
    } catch { /* Other events are not token payments. */ }
  }
  return {received, sent, net: received - sent};
}
