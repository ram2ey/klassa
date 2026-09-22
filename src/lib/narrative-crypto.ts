import crypto from "node:crypto";
import { requireSecret } from "@/lib/runtime-config";

const ENCRYPTION_ALGORITHM = "aes-256-gcm";

function deriveEncryptionKey(passphrase: string): Buffer {
  return crypto.createHash("sha256").update(passphrase).digest();
}

export function encryptNarrative(
  plaintext: string,
  passphrase: string = requireSecret("SENSITIVE_RECORD_ENCRYPTION_KEY")
): { ciphertext: string; ivHex: string; authTagHex: string } {
  const key = deriveEncryptionKey(passphrase);
  const iv = crypto.randomBytes(12); // Standard 96-bit IV for AES-GCM
  const cipher = crypto.createCipheriv(ENCRYPTION_ALGORITHM, key, iv);

  let encrypted = cipher.update(plaintext, "utf8", "hex");
  encrypted += cipher.final("hex");
  const authTag = cipher.getAuthTag();

  return {
    ciphertext: encrypted,
    ivHex: iv.toString("hex"),
    authTagHex: authTag.toString("hex"),
  };
}

export function decryptNarrative(
  ciphertextHex: string,
  ivHex: string,
  authTagHex: string,
  passphrase: string = requireSecret("SENSITIVE_RECORD_ENCRYPTION_KEY")
): string {
  const key = deriveEncryptionKey(passphrase);
  const iv = Buffer.from(ivHex, "hex");
  const authTag = Buffer.from(authTagHex, "hex");

  const decipher = crypto.createDecipheriv(ENCRYPTION_ALGORITHM, key, iv);
  decipher.setAuthTag(authTag);

  let decrypted = decipher.update(ciphertextHex, "hex", "utf8");
  decrypted += decipher.final("utf8");
  return decrypted;
}

