// GSM 03.38: extension characters occupy an escape plus one septet.
const gsmBasic = new Set(Array.from("@£$¥èéùìòÇ\nØø\rÅåΔ_ΦΓΛΩΠΨΣΘΞÆæßÉ !\"#¤%&'()*+,-./0123456789:;<=>?¡ABCDEFGHIJKLMNOPQRSTUVWXYZÄÖÑÜ§¿abcdefghijklmnopqrstuvwxyzäöñüà"));
const gsmExtended = new Set(Array.from("\f^{}\\[~]|€"));

export function countSmsSegments(message: string): number {
  if (!message.length) return 0;
  let septets = 0;
  for (const character of message) {
    if (gsmBasic.has(character)) septets++;
    else if (gsmExtended.has(character)) septets += 2;
    else {
      // UTF-16 code units account for both halves of supplementary characters.
      return message.length <= 70 ? 1 : Math.ceil(message.length / 67);
    }
  }
  return septets <= 160 ? 1 : Math.ceil(septets / 153);
}
